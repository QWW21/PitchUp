#!/usr/bin/env bash
# e14.sh — create all E14 Analytics issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E14 — Analytics")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E14 — Analytics' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E14 — Analytics)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E14-01 — Backend: GET /manager/analytics/revenue — revenue time series
# ─────────────────────────────────────────────────────────────────────────────
title="[E14-01] [Backend] GET /manager/analytics/revenue — revenue time series"
read -r -d '' body << 'BODY' || true
## Summary
Aggregate booking revenue for the authenticated manager's company by day/week/month. Powers the revenue chart on the manager analytics dashboard.

## Reference
- PRD §13.1 Manager Analytics — Revenue

## File to create
`apps/web/src/app/api/v1/manager/analytics/revenue/route.ts` — GET

## Query params
```
period    string   "7d" | "30d" | "90d" | "12m"   default: "30d"
pitchId?  string   filter to specific pitch
```

## Implementation
```typescript
export async function GET(req: NextRequest) {
  const manager = await requireRole(req, 'MANAGER');
  const company = await getCompanyForManager(manager.id);
  const { period, pitchId } = RevenueQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const { from, groupBy } = periodToRange(period);
  // groupBy: "7d"→day, "30d"→day, "90d"→week, "12m"→month

  const rows = await prisma.$queryRaw<RevenueRow[]>`
    SELECT
      DATE_TRUNC(${groupBy}, b."startTime") AS period,
      SUM(b."totalAmount")                  AS gross,
      SUM(b."platformFee")                  AS fees,
      SUM(b."totalAmount" - b."platformFee") AS payout,
      COUNT(*)::int                          AS bookings
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    WHERE
      p."companyId" = ${company.id}
      AND b.status IN ('COMPLETED', 'CONFIRMED')
      AND b."startTime" >= ${from}
      ${pitchId ? Prisma.sql`AND b."pitchId" = ${pitchId}` : Prisma.empty}
    GROUP BY DATE_TRUNC(${groupBy}, b."startTime")
    ORDER BY period ASC
  `;

  return NextResponse.json({
    period,
    groupBy,
    data: rows.map((r) => ({
      period:   r.period.toISOString(),
      gross:    Number(r.gross),
      fees:     Number(r.fees),
      payout:   Number(r.payout),
      bookings: r.bookings,
    })),
  });
}
```

## periodToRange helper
```typescript
function periodToRange(period: string): { from: Date; groupBy: string } {
  const now = new Date();
  switch (period) {
    case '7d':  return { from: subDays(now, 7),   groupBy: 'day'   };
    case '30d': return { from: subDays(now, 30),  groupBy: 'day'   };
    case '90d': return { from: subDays(now, 90),  groupBy: 'week'  };
    case '12m': return { from: subMonths(now, 12), groupBy: 'month' };
    default:    return { from: subDays(now, 30),  groupBy: 'day'   };
  }
}
```

## Response shape
```typescript
{
  period:  "30d",
  groupBy: "day",
  data: [
    { period: "2025-07-01T00:00:00Z", gross: 45000, fees: 2250, payout: 42750, bookings: 10 },
    { period: "2025-07-02T00:00:00Z", gross: 30000, fees: 1500, payout: 28500, bookings: 7 },
    // ...
  ]
}
```

## Acceptance Criteria
- [ ] All 4 periods return correct date-truncated rows
- [ ] Only COMPLETED + CONFIRMED bookings included
- [ ] `payout = gross - fees` always correct
- [ ] `pitchId` filter scopes to single pitch
- [ ] Manager cannot access another company's data
- [ ] Empty periods return 0-value rows (filled in client, not server)

## Edge Cases
- No bookings in range → `data: []` (client fills gaps with 0)
- `pitchId` belongs to different company → excluded (not 403)
- Timezone: all aggregation in UTC

## Definition of Done
- [ ] Route created using `$queryRaw` with `DATE_TRUNC`
- [ ] `periodToRange` utility in `apps/web/src/lib/analytics/`
- [ ] Integration test for all 4 period values
BODY

create_issue "$title" "$body" '["backend","epic:e14","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E14-02 — Backend: GET /manager/analytics/occupancy — occupancy heatmap data
# ─────────────────────────────────────────────────────────────────────────────
title="[E14-02] [Backend] GET /manager/analytics/occupancy — occupancy heatmap data"
read -r -d '' body << 'BODY' || true
## Summary
Return booking occupancy rates by day-of-week × hour-of-day for all pitches (or a specific pitch). Powers the 7×24 heatmap grid on the analytics dashboard.

## Reference
- PRD §13.2 Occupancy Heatmap

## File to create
`apps/web/src/app/api/v1/manager/analytics/occupancy/route.ts` — GET

## Query params
```
period    string   "30d" | "90d"   default: "30d"
pitchId?  string   optional
```

## Implementation
```typescript
export async function GET(req: NextRequest) {
  const manager = await requireRole(req, 'MANAGER');
  const company = await getCompanyForManager(manager.id);
  const { period, pitchId } = OccupancyQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const from = period === '90d' ? subDays(new Date(), 90) : subDays(new Date(), 30);

  // Count booked slots per (dayOfWeek, hourOfDay)
  const rows = await prisma.$queryRaw<OccupancyRow[]>`
    SELECT
      EXTRACT(DOW  FROM b."startTime")::int AS day_of_week,   -- 0=Sun
      EXTRACT(HOUR FROM b."startTime")::int AS hour_of_day,
      COUNT(*)::int                          AS booked_count
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    WHERE
      p."companyId" = ${company.id}
      AND b.status IN ('COMPLETED', 'CONFIRMED', 'NO_SHOW')
      AND b."startTime" >= ${from}
      ${pitchId ? Prisma.sql`AND b."pitchId" = ${pitchId}` : Prisma.empty}
    GROUP BY day_of_week, hour_of_day
  `;

  // Calculate max slots available per (dayOfWeek, hour) across the period
  // for percentage normalisation — derived from pitch availability schedule
  const totalWeeks = period === '90d' ? 13 : 4;
  const pitchCount = pitchId ? 1 : await prisma.pitch.count({ where: { companyId: company.id, isActive: true } });

  // Build 7×24 grid initialised to 0
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const row of rows) {
    const maxSlots = totalWeeks * pitchCount;
    grid[row.day_of_week][row.hour_of_day] = Math.min(
      100,
      Math.round((row.booked_count / maxSlots) * 100)
    );
  }

  return NextResponse.json({ grid }); // grid[dayOfWeek][hourOfDay] = 0-100 percentage
}
```

## Response shape
```typescript
{
  grid: number[][];  // [7][24] — occupancy percentage 0–100
  // grid[0] = Sunday, grid[1] = Monday, ... grid[6] = Saturday
  // grid[i][h] = % of available slots booked at hour h on day i
}
```

## Acceptance Criteria
- [ ] Returns 7×24 grid always (even for hours with no data → 0)
- [ ] Values clamped 0–100
- [ ] Only COMPLETED, CONFIRMED, NO_SHOW included
- [ ] Manager scoped to own company
- [ ] `pitchId` filter works

## Edge Cases
- Company has 0 active pitches → grid all zeros
- Single pitch with only Mon-Fri availability → Sat/Sun cells stay 0

## Definition of Done
- [ ] Route returns correct `grid` shape
- [ ] Integration test with known booking data verifies cell values
BODY

create_issue "$title" "$body" '["backend","epic:e14","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E14-03 — Backend: GET /manager/analytics/pitches — per-pitch performance table
# ─────────────────────────────────────────────────────────────────────────────
title="[E14-03] [Backend] GET /manager/analytics/pitches — per-pitch performance table"
read -r -d '' body << 'BODY' || true
## Summary
Return a summary row for each pitch in the company — bookings count, revenue, occupancy rate, avg rating, cancellation rate, no-show rate — for the analytics pitch performance table.

## Reference
- PRD §13.3 Pitch Performance Table

## File to create
`apps/web/src/app/api/v1/manager/analytics/pitches/route.ts` — GET

## Query params
```
period    string   "7d" | "30d" | "90d" | "12m"   default: "30d"
```

## Implementation
```typescript
export async function GET(req: NextRequest) {
  const manager = await requireRole(req, 'MANAGER');
  const company = await getCompanyForManager(manager.id);
  const { period } = PitchPerformanceQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  const { from } = periodToRange(period);

  const pitches = await prisma.pitch.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true, size: true, surface: true, isActive: true },
  });

  const stats = await Promise.all(
    pitches.map(async (pitch) => {
      const [totals] = await prisma.$queryRaw<PitchStats[]>`
        SELECT
          COUNT(*)                                           AS total,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')       AS completed,
          COUNT(*) FILTER (WHERE status = 'CANCELLED')       AS cancelled,
          COUNT(*) FILTER (WHERE status = 'NO_SHOW')         AS no_shows,
          COALESCE(SUM(b."totalAmount") FILTER (WHERE status IN ('COMPLETED','CONFIRMED')), 0) AS revenue,
          COALESCE(AVG(r.rating), 0)                         AS avg_rating
        FROM "Booking" b
        LEFT JOIN "Review" r ON r."bookingId" = b.id
        WHERE b."pitchId" = ${pitch.id}
          AND b."startTime" >= ${from}
      `;

      const total     = Number(totals.total);
      const completed = Number(totals.completed);
      return {
        pitchId:          pitch.id,
        name:             pitch.name,
        isActive:         pitch.isActive,
        revenue:          Number(totals.revenue),
        totalBookings:    total,
        completedBookings: completed,
        cancellationRate: total > 0 ? Math.round((Number(totals.cancelled) / total) * 100) : 0,
        noShowRate:       total > 0 ? Math.round((Number(totals.no_shows)  / total) * 100) : 0,
        avgRating:        Number(totals.avg_rating).toFixed(1),
      };
    })
  );

  return NextResponse.json({ data: stats });
}
```

## Response shape
```typescript
{
  data: Array<{
    pitchId:           string;
    name:              string;
    isActive:          boolean;
    revenue:           number;   // pence
    totalBookings:     number;
    completedBookings: number;
    cancellationRate:  number;   // 0–100
    noShowRate:        number;   // 0–100
    avgRating:         string;   // "4.2"
  }>
}
```

## Acceptance Criteria
- [ ] One row per pitch (including inactive pitches)
- [ ] All metrics computed over the selected period
- [ ] `cancellationRate` = cancelled / total × 100 (0 if no bookings)
- [ ] `avgRating` is "0.0" when no reviews
- [ ] Manager scoped to own company

## Edge Cases
- Pitch with 0 bookings in period → all rates 0, revenue 0, avgRating "0.0"
- Period with many pitches → `Promise.all` runs queries concurrently

## Definition of Done
- [ ] Route created
- [ ] Integration test: 2 pitches with known bookings → correct metrics
BODY

create_issue "$title" "$body" '["backend","epic:e14","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E14-04 — Backend: GET /manager/analytics/summary — KPI summary cards
# ─────────────────────────────────────────────────────────────────────────────
title="[E14-04] [Backend] GET /manager/analytics/summary — KPI summary cards"
read -r -d '' body << 'BODY' || true
## Summary
Single endpoint returning the top-level KPI numbers for the analytics dashboard header cards: total revenue, total bookings, occupancy rate, avg rating, and % change vs prior period.

## Reference
- PRD §13.4 KPI Summary Cards

## File to create
`apps/web/src/app/api/v1/manager/analytics/summary/route.ts` — GET

## Query params
```
period    string   "7d" | "30d" | "90d" | "12m"   default: "30d"
pitchId?  string   optional
```

## Implementation
```typescript
export async function GET(req: NextRequest) {
  const manager = await requireRole(req, 'MANAGER');
  const company = await getCompanyForManager(manager.id);
  const { period, pitchId } = SummaryQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const { from, priorFrom } = periodToRangeWithPrior(period);
  // priorFrom = from - period (same length window before current period)

  const [current, prior] = await Promise.all([
    fetchPeriodStats(company.id, from, new Date(), pitchId),
    fetchPeriodStats(company.id, priorFrom, from, pitchId),
  ]);

  const pctChange = (curr: number, prev: number) =>
    prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);

  return NextResponse.json({
    revenue: {
      value:  current.revenue,
      change: pctChange(current.revenue, prior.revenue),
    },
    bookings: {
      value:  current.bookings,
      change: pctChange(current.bookings, prior.bookings),
    },
    occupancy: {
      value:  current.occupancyPct,
      change: pctChange(current.occupancyPct, prior.occupancyPct),
    },
    avgRating: {
      value:  current.avgRating,
      change: pctChange(current.avgRating * 10, prior.avgRating * 10),
    },
    noShowRate: {
      value:  current.noShowRate,
      change: pctChange(current.noShowRate, prior.noShowRate),
    },
  });
}
```

## Response shape
```typescript
{
  revenue:    { value: 450000, change: 12   },   // change = % vs prior period, null if no prior data
  bookings:   { value: 38,     change: -5   },
  occupancy:  { value: 67,     change: 4    },   // percentage
  avgRating:  { value: 4.3,    change: null },
  noShowRate: { value: 3,      change: -1   },   // percentage
}
```

## KPI card change indicator
- `change > 0` → green arrow up
- `change < 0` → red arrow down (for revenue/bookings/occupancy/rating); green for noShowRate
- `change = null` → no indicator (no prior period data)

## Acceptance Criteria
- [ ] All 5 KPIs computed for current period
- [ ] Prior period comparison uses same-length window immediately before
- [ ] `change: null` when prior period has 0 data (avoid division by zero)
- [ ] Revenue/bookings/occupancy/rating: higher = green; noShowRate: lower = green (inverted)
- [ ] Manager scoped to company

## Edge Cases
- New company with <1 period of data → `change: null` for all
- `pitchId` scopes both current and prior periods
- `12m` period: prior = 12 months before that (i.e. 24m ago)

## Definition of Done
- [ ] Route created
- [ ] `pctChange` handles div-by-zero → null
- [ ] Integration test: known data → correct change %
BODY

create_issue "$title" "$body" '["backend","epic:e14","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E14-05 — Backend: GET /manager/analytics/export — CSV data export
# ─────────────────────────────────────────────────────────────────────────────
title="[E14-05] [Backend] GET /manager/analytics/export — full analytics CSV export"
read -r -d '' body << 'BODY' || true
## Summary
Server-side CSV export of all booking data for the selected period. Used when the client-side booking list export (E11-06) is insufficient — this exports enriched analytics data including revenue splits, occupancy flags, and trust scores.

## Reference
- PRD §13.5 Analytics Export

## File to create
`apps/web/src/app/api/v1/manager/analytics/export/route.ts` — GET

## Query params
```
period    string   "7d" | "30d" | "90d" | "12m"   default: "30d"
pitchId?  string   optional
```

## Implementation
```typescript
export async function GET(req: NextRequest) {
  const manager = await requireRole(req, 'MANAGER');
  const company = await getCompanyForManager(manager.id);
  const { period, pitchId } = ExportQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  const { from } = periodToRange(period);

  const bookings = await prisma.booking.findMany({
    where: {
      pitch: { companyId: company.id },
      startTime: { gte: from },
      ...(pitchId && { pitchId }),
    },
    orderBy: { startTime: 'desc' },
    include: {
      pitch:  { select: { name: true, size: true } },
      player: { select: { displayName: true } },
    },
    take: 10_000,  // cap — warn in response header if truncated
  });

  const headers = [
    'BookingID','Date','StartTime','EndTime','Pitch','PitchSize',
    // No player tier column: PRD §9.1 keeps the trust score away from
    // managers, and a CSV leaves the platform entirely.
    'PlayerName','Status','GrossPence','FeePence',
    'PayoutPence','TeamSize','HasShirts',
  ];

  const rows = bookings.map((b) => [
    b.id,
    format(b.startTime, 'yyyy-MM-dd'),
    format(b.startTime, 'HH:mm'),
    format(b.endTime,   'HH:mm'),
    b.pitch.name,
    b.pitch.size,
    b.player.displayName,
    b.status,
    b.totalAmount,
    b.platformFee,
    b.totalAmount - b.platformFee,
    b.teamSize,
    b.shirts ? 'Yes' : 'No',
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const truncated = bookings.length === 10_000;
  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv',
      'Content-Disposition': `attachment; filename="analytics-${period}-${format(new Date(), 'yyyyMMdd')}.csv"`,
      ...(truncated && { 'X-Truncated': 'true' }),
    },
  });
}
```

## Acceptance Criteria
- [ ] Returns `Content-Type: text/csv` with `Content-Disposition` attachment header
- [ ] All 14 columns present
- [ ] CSV values properly escaped (double-quote any field containing commas/quotes)
- [ ] Capped at 10,000 rows; `X-Truncated: true` header when hit
- [ ] `pitchId` filter works
- [ ] Manager cannot export another company's data

## Edge Cases
- 0 bookings in period → CSV with headers only
- Player name contains comma → escaped correctly
- `period = "12m"` with 10,001 rows → returns 10,000 + truncation header

## Definition of Done
- [ ] Route created
- [ ] CSV escaping unit tested with special chars
- [ ] Browser download tested (filename correct)
BODY

create_issue "$title" "$body" '["backend","epic:e14","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E14-06 — Web: Analytics dashboard layout + KPI summary cards
# ─────────────────────────────────────────────────────────────────────────────
title="[E14-06] [Web] /manager/analytics — dashboard layout + KPI summary cards"
read -r -d '' body << 'BODY' || true
## Summary
Analytics dashboard page with period selector, pitch filter, and 5 KPI summary cards at the top. Period and pitch filter controls are shared across all chart sections.

## Reference
- PRD §13 Manager Analytics
- UIUX_SPEC.md §Analytics Dashboard

## Files to create
- `apps/web/src/app/(manager)/manager/analytics/page.tsx`
- `apps/web/src/app/(manager)/manager/analytics/KpiCard.tsx`
- `apps/web/src/app/(manager)/manager/analytics/AnalyticsFilters.tsx`

## Page layout
```
┌────────────────────────────────────────────────────────────────────┐
│ Analytics                    [Pitch: All ▾]  [Period: 30d ▾]       │
├─────────────┬─────────────┬─────────────┬─────────────┬────────────┤
│ Revenue     │ Bookings    │ Occupancy   │ Avg Rating  │ No-show    │
│ £4,275.00   │ 38          │ 67%         │ ★ 4.3       │ 3%         │
│ ↑ 12%       │ ↓ 5%        │ ↑ 4%        │ —           │ ↓ 1%       │
├─────────────┴─────────────┴─────────────┴─────────────┴────────────┤
│ [Revenue Chart]            [Occupancy Heatmap]                     │
├────────────────────────────────────────────────────────────────────┤
│ [Pitch Performance Table]                                          │
│                                          [Export CSV ↓]            │
└────────────────────────────────────────────────────────────────────┘
```

## KpiCard component
```tsx
type KpiCardProps = {
  label:     string;
  value:     string;           // pre-formatted: "£4,275.00", "38", "67%", "★ 4.3"
  change:    number | null;    // % change from prior period
  invertGood?: boolean;        // true for no-show rate (lower = green)
};

export function KpiCard({ label, value, change, invertGood = false }: KpiCardProps) {
  const isPositive = change !== null && (invertGood ? change < 0 : change > 0);
  const isNegative = change !== null && (invertGood ? change > 0 : change < 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {change !== null ? (
        <p className={cn('mt-1 text-sm font-medium flex items-center gap-1',
          isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
        )}>
          {isPositive ? <ArrowUpIcon className="h-3 w-3" /> : isNegative ? <ArrowDownIcon className="h-3 w-3" /> : null}
          {Math.abs(change)}% vs prev period
        </p>
      ) : (
        <p className="mt-1 text-sm text-gray-400">No prior data</p>
      )}
    </div>
  );
}
```

## AnalyticsFilters component
```tsx
// Renders period selector + pitch dropdown
// Stores selection in URL params: ?period=30d&pitchId=xxx
// On change: updates URL → triggers refetch in all chart hooks via queryKey dependency
export function AnalyticsFilters() {
  const [period,  setPeriod]  = useAnalyticsParam('period',  '30d');
  const [pitchId, setPitchId] = useAnalyticsParam('pitchId', '');

  const { data: pitches } = useQuery(['manager-pitches'], fetchManagerPitches);

  return (
    <div className="flex gap-3">
      <Select value={pitchId} onChange={setPitchId} options={[{ value: '', label: 'All pitches' }, ...pitchOptions]} />
      <Select value={period}  onChange={setPeriod}  options={PERIOD_OPTIONS} />
    </div>
  );
}

const PERIOD_OPTIONS = [
  { value: '7d',  label: 'Last 7 days'   },
  { value: '30d', label: 'Last 30 days'  },
  { value: '90d', label: 'Last 90 days'  },
  { value: '12m', label: 'Last 12 months' },
];
```

## useAnalyticsSummary hook
```typescript
export function useAnalyticsSummary(period: string, pitchId?: string) {
  return useQuery({
    queryKey: ['analytics-summary', period, pitchId],
    queryFn:  () => fetchAnalyticsSummary(period, pitchId),
    staleTime: 5 * 60_000,  // 5 min — analytics doesn't need to be live
  });
}
```

## Acceptance Criteria
- [ ] 5 KPI cards render with values and change indicators
- [ ] Revenue uses `£` + 2dp formatting
- [ ] No-show rate change: red when higher, green when lower (invertGood)
- [ ] Period/pitch filters in URL params — shareable links
- [ ] Changing filter refetches all dashboard sections (via shared query key)
- [ ] Loading state: skeleton placeholders for each card

## Edge Cases
- `change: null` → "No prior data" subtext, no arrow
- All KPIs 0 → cards show "£0.00", "0", etc. — no NaN/undefined
- Manager with no bookings → all cards show 0

## Definition of Done
- [ ] Page + KpiCard + AnalyticsFilters created
- [ ] Skeleton loading states
- [ ] Period filter updates URL param
BODY

create_issue "$title" "$body" '["frontend","web","epic:e14","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E14-07 — Web: Revenue chart (Recharts area chart)
# ─────────────────────────────────────────────────────────────────────────────
title="[E14-07] [Web] Analytics — revenue area chart with Recharts"
read -r -d '' body << 'BODY' || true
## Summary
Interactive area chart showing gross revenue, fees, and payout over the selected period. Uses Recharts. Supports toggling each series on/off via legend click.

## Reference
- PRD §13.1 Revenue Chart
- UIUX_SPEC.md §Analytics Revenue Chart

## Files to create
- `apps/web/src/app/(manager)/manager/analytics/RevenueChart.tsx`

## Implementation
```tsx
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

type RevenueChartProps = {
  data:    RevenueDataPoint[];   // from GET /manager/analytics/revenue
  groupBy: 'day' | 'week' | 'month';
};

export function RevenueChart({ data, groupBy }: RevenueChartProps) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const formatted = data.map((d) => ({
    ...d,
    label:   formatAxisLabel(d.period, groupBy),
    gross:   d.gross / 100,   // pence → pounds
    fees:    d.fees  / 100,
    payout:  d.payout / 100,
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={formatted}>
          <defs>
            <linearGradient id="gradGross"  x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#16A34A" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#16A34A" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="gradPayout" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#6366F1" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => `£${v}`} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number, name: string) => [`£${value.toFixed(2)}`, name]}
          />
          <Legend
            onClick={(e) => setHidden((h) => ({ ...h, [e.dataKey]: !h[e.dataKey] }))}
          />
          {!hidden.gross  && <Area dataKey="gross"  name="Gross"   stroke="#16A34A" fill="url(#gradGross)"  />}
          {!hidden.fees   && <Area dataKey="fees"   name="Fees"    stroke="#F97316" fill="none" strokeDasharray="4 2" />}
          {!hidden.payout && <Area dataKey="payout" name="Payout"  stroke="#6366F1" fill="url(#gradPayout)" />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

## X-axis label formatting
```typescript
function formatAxisLabel(isoDate: string, groupBy: 'day' | 'week' | 'month'): string {
  const d = parseISO(isoDate);
  if (groupBy === 'day')   return format(d, 'MMM d');    // "Aug 4"
  if (groupBy === 'week')  return format(d, 'MMM d');    // week start
  if (groupBy === 'month') return format(d, 'MMM yyyy'); // "Aug 2025"
  return isoDate;
}
```

## Gap filling (client-side)
```typescript
// Server returns only non-zero periods
// Client fills missing days with 0 before passing to chart
function fillGaps(data: RevenueDataPoint[], period: string): RevenueDataPoint[] {
  const { from, groupBy } = periodToRange(period);
  const allPeriods = generatePeriodLabels(from, new Date(), groupBy);
  const dataMap = new Map(data.map((d) => [d.period, d]));
  return allPeriods.map((p) => dataMap.get(p) ?? { period: p, gross: 0, fees: 0, payout: 0, bookings: 0 });
}
```

## Acceptance Criteria
- [ ] 3 series: Gross (green), Fees (orange dashed), Payout (purple)
- [ ] Legend click toggles series
- [ ] Tooltip shows £ values formatted to 2dp
- [ ] X-axis labels correct for each groupBy
- [ ] Missing days filled with 0 (no gaps in line)
- [ ] Chart height: 280px

## Edge Cases
- 0 data points in range → empty chart with "No data for this period" overlay
- Single data point → chart renders single dot (Recharts handles)

## Definition of Done
- [ ] Component created using Recharts
- [ ] Gap filling works for all 4 periods
- [ ] Legend toggle tested
BODY

create_issue "$title" "$body" '["frontend","web","epic:e14","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E14-08 — Web: Occupancy heatmap grid
# ─────────────────────────────────────────────────────────────────────────────
title="[E14-08] [Web] Analytics — occupancy heatmap grid"
read -r -d '' body << 'BODY' || true
## Summary
7-column × 24-row heatmap grid showing booking occupancy by day-of-week and hour. Each cell colour-coded by occupancy percentage using a green gradient.

## Reference
- PRD §13.2 Occupancy Heatmap
- UIUX_SPEC.md §Occupancy Heatmap

## File to create
`apps/web/src/app/(manager)/manager/analytics/OccupancyHeatmap.tsx`

## Layout
```
        Mon  Tue  Wed  Thu  Fri  Sat  Sun
 07:00  ░░░  ░░░  ▓▓▓  ░░░  ░░░  ▒▒▒  ░░░
 08:00  ▒▒▒  ░░░  ███  ▒▒▒  ░░░  ███  ░░░
 ...
 22:00  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░
```

## Cell colour scale
```typescript
// Green gradient: 0% = white, 100% = primary-600 (#16A34A)
function cellColor(pct: number): string {
  if (pct === 0)    return '#ffffff';
  if (pct < 25)     return '#dcfce7';  // green-100
  if (pct < 50)     return '#86efac';  // green-300
  if (pct < 75)     return '#4ade80';  // green-400
  if (pct < 90)     return '#22c55e';  // green-500
  return              '#16A34A';       // primary-600
}
```

## Implementation
```tsx
const DAYS    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS   = Array.from({ length: 17 }, (_, i) => i + 7); // 07–23

export function OccupancyHeatmap({ grid }: { grid: number[][] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Occupancy by Time</h3>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-12" />
              {DAYS.map((d) => (
                <th key={d} className="w-10 text-center font-medium text-gray-500 pb-1">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour}>
                <td className="pr-2 text-right text-gray-400 w-12">{`${hour}:00`}</td>
                {DAYS.map((_, dayIdx) => {
                  const pct = grid[dayIdx]?.[hour] ?? 0;
                  return (
                    <td
                      key={dayIdx}
                      title={`${DAYS[dayIdx]} ${hour}:00 — ${pct}% occupied`}
                      style={{ backgroundColor: cellColor(pct) }}
                      className="w-10 h-6 border border-white rounded-sm cursor-default"
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Colour legend */}
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <span>0%</span>
        {['#dcfce7','#86efac','#4ade80','#22c55e','#16A34A'].map((c) => (
          <span key={c} style={{ backgroundColor: c }} className="inline-block w-6 h-3 rounded" />
        ))}
        <span>100%</span>
      </div>
    </div>
  );
}
```

## Hours shown: 07:00–23:00 (17 rows)
Hours outside this range excluded from display even if API returns them (early morning bookings are rare).

## Acceptance Criteria
- [ ] 7 columns (Sun–Sat), 17 rows (07–23)
- [ ] Cell background uses correct colour for each % bucket
- [ ] Tooltip on hover: "{Day} {hour}:00 — {pct}% occupied"
- [ ] Legend shows colour scale
- [ ] 0% cells show white (not green)
- [ ] Responsive: horizontal scroll on small screens

## Edge Cases
- `grid` missing day/hour → treat as 0 (optional chaining)
- All cells 0 → all white (valid empty state with legend still shown)
- pct > 100 → clamp cell to primary-600 colour (shouldn't happen but defensive)

## Definition of Done
- [ ] Component renders correctly with mock grid data
- [ ] Colour scale visually distinct across all 5 buckets
- [ ] Tooltip accessible (title attribute)
BODY

create_issue "$title" "$body" '["frontend","web","epic:e14","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E14-09 — Web: Pitch performance table + CSV export button
# ─────────────────────────────────────────────────────────────────────────────
title="[E14-09] [Web] Analytics — pitch performance table + CSV export button"
read -r -d '' body << 'BODY' || true
## Summary
Sortable table showing per-pitch analytics metrics. "Export CSV" button triggers server-side CSV download from `GET /manager/analytics/export`. Located below the charts.

## Reference
- PRD §13.3–13.5

## Files to create
- `apps/web/src/app/(manager)/manager/analytics/PitchPerformanceTable.tsx`

## Table columns
| Column | Width | Format |
|--------|-------|--------|
| Pitch | 160px | Name + isActive badge |
| Revenue | 100px | £XX.XX right-aligned |
| Bookings | 90px | Number right-aligned |
| Occupancy | 90px | —  (not per-pitch, use "—") |
| Avg Rating | 100px | ★ X.X or "—" if 0 reviews |
| Cancellation | 110px | XX% with colour bar |
| No-show | 90px | XX% with colour bar |

## Implementation
```tsx
export function PitchPerformanceTable({
  data,
  period,
  pitchId,
}: {
  data:    PitchPerformanceRow[];
  period:  string;
  pitchId: string;
}) {
  const [sortKey, setSortKey] = useState<keyof PitchPerformanceRow>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey] as number;
    const vb = b[sortKey] as number;
    return sortDir === 'desc' ? vb - va : va - vb;
  });

  const handleSort = (key: keyof PitchPerformanceRow) => {
    if (key === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Pitch Performance</h3>
        <ExportCsvButton period={period} pitchId={pitchId} />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <SortableHeader label="Pitch"        sortKey="name"             current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortableHeader label="Revenue"      sortKey="revenue"          current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortableHeader label="Bookings"     sortKey="totalBookings"    current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortableHeader label="Avg Rating"   sortKey="avgRating"        current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortableHeader label="Cancellation" sortKey="cancellationRate" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortableHeader label="No-show"      sortKey="noShowRate"       current={sortKey} dir={sortDir} onClick={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.pitchId} className="border-b hover:bg-gray-50">
              <td className="py-2">{row.name} {!row.isActive && <span className="ml-1 text-xs text-gray-400">(inactive)</span>}</td>
              <td className="text-right">£{(row.revenue / 100).toFixed(2)}</td>
              <td className="text-right">{row.totalBookings}</td>
              <td className="text-right">{Number(row.avgRating) > 0 ? `★ ${row.avgRating}` : '—'}</td>
              <td className="text-right"><RateBadge value={row.cancellationRate} /></td>
              <td className="text-right"><RateBadge value={row.noShowRate} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## RateBadge
```tsx
// Colour thresholds: 0–9% green, 10–19% amber, 20%+ red
function RateBadge({ value }: { value: number }) {
  const color = value < 10 ? 'text-green-600' : value < 20 ? 'text-amber-600' : 'text-red-600';
  return <span className={color}>{value}%</span>;
}
```

## ExportCsvButton
```tsx
// GET /manager/analytics/export?period=30d&pitchId=xxx
// Response: Content-Disposition: attachment → browser auto-downloads
async function handleExport() {
  const url = buildExportUrl(period, pitchId);
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.headers.get('X-Truncated')) {
    toast.warning('Export limited to 10,000 rows. Apply a shorter period for full data.');
  }
  const blob     = await res.blob();
  const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'analytics.csv';
  downloadBlob(blob, filename);
}
```

## Acceptance Criteria
- [ ] Table sortable by all numeric columns
- [ ] Sort toggles asc/desc on second click
- [ ] Default sort: revenue descending
- [ ] `RateBadge` uses correct colours
- [ ] Export button triggers download
- [ ] Truncation toast shown when `X-Truncated: true`
- [ ] Inactive pitches labelled "(inactive)"

## Definition of Done
- [ ] Table with sort created
- [ ] Export button triggers correct API call and browser download
- [ ] Empty state (0 pitches): "No pitch data for this period"
BODY

create_issue "$title" "$body" '["frontend","web","epic:e14","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E14-10 — Mobile: Analytics overview screen (manager)
# ─────────────────────────────────────────────────────────────────────────────
title="[E14-10] [Mobile] Manager analytics overview screen"
read -r -d '' body << 'BODY' || true
## Summary
Mobile analytics screen for managers showing the 5 KPI summary cards and a simplified revenue bar chart. No heatmap on mobile (too dense). Links to pitch performance list.

## Reference
- PRD §13 Analytics (mobile subset)
- UIUX_SPEC.md §Mobile Analytics

## Files to create
- `apps/mobile/src/screens/manager/ManagerAnalyticsScreen.tsx`
- `apps/mobile/src/components/analytics/MobileKpiCard.tsx`
- `apps/mobile/src/components/analytics/MobileRevenueChart.tsx`
- `apps/mobile/src/hooks/useManagerAnalytics.ts`

## useManagerAnalytics hook
```typescript
export function useManagerAnalytics(period: string) {
  const summary   = useQuery({ queryKey: ['analytics-summary', period],   queryFn: () => fetchAnalyticsSummary(period)   });
  const revenue   = useQuery({ queryKey: ['analytics-revenue', period],   queryFn: () => fetchAnalyticsRevenue(period)   });
  return { summary, revenue };
}
```

## Screen layout
```
┌──────────────────────────┐
│ ≡  Analytics         [⚙] │
├──────────────────────────┤
│ [7d] [30d] [90d] [12m]   │  ← period chips
├──────────────────────────┤
│ ┌────────┐ ┌────────┐    │
│ │Revenue │ │Bookings│    │
│ │£4,275  │ │ 38     │    │
│ │↑ 12%   │ │ ↓ 5%   │    │
│ └────────┘ └────────┘    │
│ ┌────────┐ ┌────────┐    │
│ │Occupncy│ │Rating  │    │
│ │  67%   │ │  ★4.3  │    │
│ │  ↑ 4%  │ │   —    │    │
│ └────────┘ └────────┘    │
│ ┌─────────────────────┐  │
│ │ No-show Rate  3%    │  │
│ │ ↓ 1% (improved)     │  │
│ └─────────────────────┘  │
├──────────────────────────┤
│ REVENUE (bar chart)       │
│ ████                      │
│  ██                       │
│    ███                    │
│ Aug1 Aug2 Aug3...         │
├──────────────────────────┤
│ [View Pitch Performance →]│
└──────────────────────────┘
```

## MobileKpiCard
```typescript
// 2-column grid card
// Props: label, value, change, invertGood
// change > 0 → ↑ green (or red if invertGood)
// change < 0 → ↓ red  (or green if invertGood)
// change null → "—"
// Height: fixed 80px
```

## MobileRevenueChart
- Use `react-native-svg` + manual bar chart (no Recharts on mobile)
- Show gross revenue only (simplify from 3 series)
- Max 14 bars for 30d (group by 2 days); 7 bars for 7d (1 per day); 12 bars for 12m (1 per month)
- Bars height proportional to max value in period
- Tap bar → show tooltip: "{label}: £{value}"

```typescript
export function MobileRevenueChart({ data, groupBy }: MobileRevenueChartProps) {
  const max = Math.max(...data.map((d) => d.gross), 1);
  const BAR_WIDTH  = 20;
  const CHART_H    = 120;
  const CHART_W    = (BAR_WIDTH + 4) * data.length;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={CHART_W} height={CHART_H + 20}>
        {data.map((d, i) => {
          const barH = Math.max(2, (d.gross / max) * CHART_H);
          return (
            <G key={i} onPress={() => showTooltip(d)}>
              <Rect
                x={i * (BAR_WIDTH + 4)}
                y={CHART_H - barH}
                width={BAR_WIDTH}
                height={barH}
                fill="#16A34A"
                rx={3}
              />
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
}
```

## Pitch Performance link
- Tappable row at bottom: "Pitch Performance →"
- Navigates to `ManagerPitchPerformanceScreen` (simple list, no sortable table)
- Shows each pitch: name, revenue, bookings, avg rating in a card

## Acceptance Criteria
- [ ] 5 KPI cards show correct values + change indicators
- [ ] Period chips update all cards + chart
- [ ] Bar chart scrolls horizontally when many bars
- [ ] Tap bar shows tooltip with value
- [ ] "Pitch Performance" link navigates correctly
- [ ] `staleTime: 5 min` — doesn't refetch on every tab focus

## Edge Cases
- 0 bookings in period → all cards 0, chart empty with "No data" label
- 12m period bar chart: 12 bars (one per month)

## Definition of Done
- [ ] Screen and components created
- [ ] Bar chart renders on device
- [ ] Period chip selection working
BODY

create_issue "$title" "$body" '["mobile","epic:e14","type:feature"]' "$MILESTONE"

echo ""
echo "✓ E14 — Analytics (10 issues created)"
