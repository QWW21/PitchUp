#!/usr/bin/env bash
# e11.sh — create all E11 Manager: Booking Mgmt issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E11 — Manager: Booking Mgmt")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E11 — Manager: Booking Mgmt' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E11 — Manager: Booking Mgmt)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E11-01 — Backend: GET /manager/bookings — paginated booking list with filters
# ─────────────────────────────────────────────────────────────────────────────
title="[E11-01] [Backend] GET /manager/bookings — paginated booking list with filters"
read -r -d '' body << 'BODY' || true
## Summary
Fetch bookings across all pitches owned by the authenticated manager's company. Supports rich filtering by pitch, status, date range, player name, and cursor-based pagination. Powers both the booking list table and calendar data feed.

## Reference
- PRD §9.1 Manager Booking List

## File to create
`apps/web/src/app/api/v1/manager/bookings/route.ts` — GET

## Query Params
```
pitchId?     string   filter to specific pitch
status?      string   PENDING | CONFIRMED | CANCELLED | COMPLETED | NO_SHOW
dateFrom?    string   ISO date (inclusive)
dateTo?      string   ISO date (inclusive)
search?      string   player display name / email (ILIKE, min 2 chars)
cursor?      string   last booking ID for next page
limit?       number   default 20, max 100
```

## Implementation
```typescript
// apps/web/src/app/api/v1/manager/bookings/route.ts
export async function GET(req: NextRequest) {
  const manager = await requireRole(req, 'MANAGER');
  const company = await prisma.company.findUniqueOrThrow({
    where: { managerId: manager.id },
    select: { id: true },
  });

  const { pitchId, status, dateFrom, dateTo, search, cursor, limit = 20 } =
    BookingListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  const where: Prisma.BookingWhereInput = {
    pitch: { companyId: company.id },
    ...(pitchId && { pitchId }),
    ...(status && { status: status as BookingStatus }),
    ...(dateFrom && { startTime: { gte: new Date(dateFrom) } }),
    ...(dateTo && { endTime: { lte: new Date(`${dateTo}T23:59:59Z`) } }),
    ...(search && {
      player: {
        OR: [
          { displayName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
    }),
    ...(cursor && { id: { lt: cursor } }),
  };

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startTime: 'desc' },
    take: Number(limit) + 1,
    include: {
      pitch: { select: { id: true, name: true } },
      player: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });

  const hasMore = bookings.length > Number(limit);
  if (hasMore) bookings.pop();

  return NextResponse.json({
    data: bookings,
    nextCursor: hasMore ? bookings.at(-1)!.id : null,
  });
}
```

## Schema (packages/shared)
```typescript
// packages/shared/src/schemas/manager.ts
export const BookingListQuerySchema = z.object({
  pitchId:  z.string().uuid().optional(),
  status:   z.enum(['PENDING','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search:   z.string().min(2).max(100).optional(),
  cursor:   z.string().optional(),
  limit:    z.coerce.number().min(1).max(100).default(20),
});
```

## Acceptance Criteria
- [ ] Only returns bookings for pitches belonging to authenticated manager's company
- [ ] All 6 filter params work independently and in combination
- [ ] `search` on player name uses case-insensitive ILIKE
- [ ] `dateFrom` filters `startTime >= dateFrom 00:00:00`; `dateTo` filters `endTime <= dateTo 23:59:59`
- [ ] Cursor pagination: `nextCursor` is last item ID when more exist, null otherwise
- [ ] Attempting access with non-MANAGER role returns 403
- [ ] Manager with no company yet returns 404

## Edge Cases
- `search` < 2 chars → 400 validation error
- `dateFrom` > `dateTo` → 400
- `limit` > 100 → clamp to 100
- Pitch belongs to different company → excluded (not 403)

## Definition of Done
- [ ] Route file created
- [ ] All filter combinations return correct results in integration test
- [ ] No player PII (email) exposed when `search` not used in response
BODY

create_issue "$title" "$body" '["backend","epic:e11","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E11-02 — Backend: GET /manager/bookings/calendar — calendar event feed
# ─────────────────────────────────────────────────────────────────────────────
title="[E11-02] [Backend] GET /manager/bookings/calendar — calendar event feed"
read -r -d '' body << 'BODY' || true
## Summary
Return all bookings for a given week (or month) as calendar events, grouped by pitch. Used by the web calendar view. Returns lightweight events (no full player detail) to keep payload small.

## Reference
- PRD §9.2 Manager Calendar View

## File to create
`apps/web/src/app/api/v1/manager/bookings/calendar/route.ts` — GET

## Query Params
```
week    string   ISO week start date (Monday), e.g. "2025-08-04"   [required]
pitchId string   filter to single pitch (optional)
```

## Response Shape
```typescript
type CalendarEvent = {
  id:          string;
  pitchId:     string;
  pitchName:   string;
  pitchColor:  string;  // hex color assigned to pitch for visual distinction
  startTime:   string;  // ISO
  endTime:     string;  // ISO
  status:      BookingStatus;
  playerName:  string;  // displayName only — no email in calendar
  totalAmount: number;
};

// Response
{ events: CalendarEvent[] }
```

## Implementation
```typescript
export async function GET(req: NextRequest) {
  const manager = await requireRole(req, 'MANAGER');
  const company = await prisma.company.findUniqueOrThrow({
    where: { managerId: manager.id },
    select: { id: true },
  });

  const { week, pitchId } = CalendarQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const weekStart = startOfWeek(parseISO(week), { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(weekStart, { weekStartsOn: 1 });

  const bookings = await prisma.booking.findMany({
    where: {
      pitch: { companyId: company.id },
      ...(pitchId && { pitchId }),
      startTime: { gte: weekStart },
      endTime:   { lte: addDays(weekEnd, 1) },
      status:    { not: 'CANCELLED' },
    },
    orderBy: { startTime: 'asc' },
    include: {
      pitch:  { select: { id: true, name: true, calendarColor: true } },
      player: { select: { displayName: true } },
    },
  });

  return NextResponse.json({ events: bookings.map(toCalendarEvent) });
}
```

## Pitch Calendar Colors
- Assign deterministic color from palette of 8 on `Pitch` creation
- Store as `calendarColor String @default("#6366F1")` on Pitch model
- Colors: `["#6366F1","#F97316","#16A34A","#EAB308","#EC4899","#14B8A6","#8B5CF6","#EF4444"]`

## Acceptance Criteria
- [ ] `week` param required; missing → 400
- [ ] Only returns non-CANCELLED bookings
- [ ] Response contains `pitchColor` for each event
- [ ] Events sorted by `startTime` ascending
- [ ] Filter by `pitchId` works correctly
- [ ] Week boundary: Mon 00:00:00 → Sun 23:59:59 UTC

## Edge Cases
- `week` is not a Monday → normalize to Monday of that week
- Week with no bookings → `{ events: [] }`
- Pitch has CANCELLED booking → excluded from calendar

## Schema Addition
```prisma
model Pitch {
  // ...existing fields...
  calendarColor String @default("#6366F1")
}
```

## Definition of Done
- [ ] Route created, returns correct week range
- [ ] `calendarColor` migration added
- [ ] Boundary test: bookings straddling midnight are included
BODY

create_issue "$title" "$body" '["backend","epic:e11","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E11-03 — Backend: GET /manager/bookings/:id — booking detail
# ─────────────────────────────────────────────────────────────────────────────
title="[E11-03] [Backend] GET /manager/bookings/:id — manager booking detail"
read -r -d '' body << 'BODY' || true
## Summary
Full booking detail for a specific booking — for the manager's booking detail panel/page. Includes player info, payment breakdown, status history, and linked review. Scope-checked to manager's company.

## Reference
- PRD §9.3 Manager Booking Detail

## File to create
`apps/web/src/app/api/v1/manager/bookings/[bookingId]/route.ts` — GET

## Response Shape
```typescript
type ManagerBookingDetail = {
  id:             string;
  pitch:          { id: string; name: string; };
  player: {
    id:           string;
    displayName:  string;
    avatarUrl:    string | null;
    // PRD §9.1: "Score is not visible to managers directly (to avoid
     // discrimination)". The platform enforces the Poor and Suspended tiers
     // at booking time; a manager sees behaviour, not a score.
     totalBookings: number;
    totalBookings: number;       // bookings with this manager's company
    noShowCount:   number;
  };
  startTime:      string;
  endTime:        string;
  status:         BookingStatus;
  totalAmount:    number;
  platformFee:    number;
  managerPayout:  number;        // totalAmount - platformFee
  teamSize:       number;
  shirts:         ShirtSelection[];
  statusHistory:  BookingStatusEvent[];
  review:         ReviewSnippet | null;
  stripePaymentIntentId: string;
  createdAt:      string;
};
```

## Implementation
```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  const manager = await requireRole(req, 'MANAGER');
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: params.bookingId },
    include: {
      pitch:        { select: { id: true, name: true, company: { select: { managerId: true } } } },
      player:       true,
      statusEvents: { orderBy: { createdAt: 'asc' } },
      review:       { select: { id: true, rating: true, comment: true, createdAt: true } },
    },
  });

  if (booking.pitch.company.managerId !== manager.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const noShowCount = await prisma.booking.count({
    where: { playerId: booking.playerId, status: 'NO_SHOW' },
  });
  const totalBookings = await prisma.booking.count({
    where: { playerId: booking.playerId, pitch: { companyId: booking.pitch.company.managerId } },
  });

  return NextResponse.json(toManagerBookingDetail(booking, noShowCount, totalBookings));
}
```

## Acceptance Criteria
- [ ] Manager cannot access booking from another company → 403
- [ ] `managerPayout = totalAmount - platformFee` computed server-side
- [ ] `player.noShowCount` counts NO_SHOW bookings globally (not just this pitch)
- [ ] `player.totalBookings` counts bookings at THIS company only
- [ ] `statusHistory` ordered chronologically
- [ ] Review present only when booking has been reviewed

## Edge Cases
- Booking not found → 404
- Booking belongs to different manager's company → 403 (not 404)

## Definition of Done
- [ ] Route created with correct ownership check
- [ ] `managerPayout` always equals `totalAmount - platformFee`
- [ ] Integration test covering 403 cross-company access
BODY

create_issue "$title" "$body" '["backend","epic:e11","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E11-04 — Backend: POST /manager/bookings/:id/no-show — mark no-show
# ─────────────────────────────────────────────────────────────────────────────
title="[E11-04] [Backend] POST /manager/bookings/:id/no-show — mark player no-show"
read -r -d '' body << 'BODY' || true
## Summary
Allow manager to mark a booking as NO_SHOW after the scheduled start time. Triggers trust score penalty event (via `applyTrustEvent` — implemented in E12) and optionally charges a no-show fee via Stripe. Transitions booking from CONFIRMED → NO_SHOW.

## Reference
- PRD §9.4 No-Show Flow
- E12-01 (applyTrustEvent — implement stub call, full engine in E12)

## File to create
`apps/web/src/app/api/v1/manager/bookings/[bookingId]/no-show/route.ts` — POST

## Business Rules
1. Booking must be in `CONFIRMED` status
2. Current time must be ≥ `startTime` (cannot mark no-show before slot begins)
3. Window to mark no-show: up to 4 hours after `startTime` (prevent abuse)
4. One no-show event per booking (idempotency: if already NO_SHOW return 200)
5. Charges no-show fee only if `pitch.noShowFeeEnabled = true` AND player has a saved payment method
6. No-show fee amount = `pitch.noShowFeeAmount` (Prisma field, default 0)

## Implementation
```typescript
export async function POST(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  const manager = await requireRole(req, 'MANAGER');
  const booking = await getBookingForManager(params.bookingId, manager.id);

  if (booking.status === 'NO_SHOW') {
    return NextResponse.json({ success: true, alreadyMarked: true });
  }

  const now = new Date();
  if (now < booking.startTime) {
    return NextResponse.json(
      { error: 'Cannot mark no-show before slot starts' },
      { status: 422 }
    );
  }
  const cutoff = addHours(booking.startTime, 4);
  if (now > cutoff) {
    return NextResponse.json(
      { error: 'No-show window expired (4 hours after start)' },
      { status: 422 }
    );
  }
  if (booking.status !== 'CONFIRMED') {
    return NextResponse.json(
      { error: `Cannot mark no-show: booking is ${booking.status}` },
      { status: 422 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: 'NO_SHOW' },
    });
    await tx.bookingStatusEvent.create({
      data: { bookingId: booking.id, status: 'NO_SHOW', actorId: manager.id },
    });
    // Trust penalty stub — full engine implemented in E12
    await applyTrustEventStub(tx, booking.playerId, 'NO_SHOW', booking.id);
  });

  // Charge no-show fee if configured (fire-and-forget, log errors)
  if (booking.pitch.noShowFeeEnabled && booking.pitch.noShowFeeAmount > 0) {
    chargeNoShowFee(booking).catch((err) =>
      console.error('[no-show-fee] charge failed', booking.id, err.message)
    );
  }

  return NextResponse.json({ success: true });
}
```

## Stub for E12 integration
```typescript
// apps/web/src/lib/trust/stub.ts
// TODO: replace with real applyTrustEvent in E12
export async function applyTrustEventStub(
  tx: PrismaClient,
  userId: string,
  event: 'NO_SHOW',
  bookingId: string
) {
  await tx.trustEvent.create({
    data: { userId, event, bookingId, delta: -10, processed: false },
  });
}
```

## Schema additions
```prisma
model Pitch {
  noShowFeeEnabled Boolean @default(false)
  noShowFeeAmount  Int     @default(0)  // pence/cents
}

model TrustEvent {
  id        String   @id @default(cuid())
  userId    String
  event     String
  bookingId String?
  delta     Int
  processed Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

## Acceptance Criteria
- [ ] Transition CONFIRMED → NO_SHOW only
- [ ] Returns 422 if before `startTime`
- [ ] Returns 422 if more than 4 hours after `startTime`
- [ ] Idempotent: second call when already NO_SHOW returns `{ success: true, alreadyMarked: true }`
- [ ] `TrustEvent` row created with `delta: -10, processed: false`
- [ ] `BookingStatusEvent` row created
- [ ] No-show fee charge is fire-and-forget (failure doesn't roll back status update)

## Edge Cases
- No-show fee charge fails → booking still becomes NO_SHOW, error logged
- Player has no saved payment method → skip fee charge, do not error
- Concurrent no-show calls → second tx fails at unique constraint → 409

## Definition of Done
- [ ] Route created with all business rule checks
- [ ] Prisma migration for `noShowFeeEnabled`, `noShowFeeAmount`, `TrustEvent`
- [ ] Unit tests for time window validation
BODY

create_issue "$title" "$body" '["backend","epic:e11","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E11-05 — Backend: POST /manager/bookings/:id/complete — mark completed
# ─────────────────────────────────────────────────────────────────────────────
title="[E11-05] [Backend] POST /manager/bookings/:id/complete + GET /manager/pitches/:id/availability-gaps"
read -r -d '' body << 'BODY' || true
## Summary
Two small backend endpoints needed by the manager booking management flow:
1. `POST /manager/bookings/:id/complete` — manually mark a CONFIRMED booking as COMPLETED (for past bookings that the system didn't auto-complete)
2. `GET /manager/pitches/:id/availability-gaps` — return time slots where the pitch is available but has no booking, for a given date (used by "quick book" assistant in E11-08)

## Files to create
- `apps/web/src/app/api/v1/manager/bookings/[bookingId]/complete/route.ts`
- `apps/web/src/app/api/v1/manager/pitches/[pitchId]/availability-gaps/route.ts`

## Complete Endpoint
```typescript
// POST /manager/bookings/:id/complete
export async function POST(req, { params }) {
  const manager = await requireRole(req, 'MANAGER');
  const booking = await getBookingForManager(params.bookingId, manager.id);

  if (!['CONFIRMED'].includes(booking.status)) {
    return NextResponse.json(
      { error: `Cannot complete booking in status ${booking.status}` },
      { status: 422 }
    );
  }
  if (new Date() < booking.endTime) {
    return NextResponse.json(
      { error: 'Booking has not ended yet' },
      { status: 422 }
    );
  }

  await prisma.$transaction([
    prisma.booking.update({ where: { id: booking.id }, data: { status: 'COMPLETED' } }),
    prisma.bookingStatusEvent.create({
      data: { bookingId: booking.id, status: 'COMPLETED', actorId: manager.id },
    }),
  ]);

  return NextResponse.json({ success: true });
}
```

## Availability Gaps Endpoint
```typescript
// GET /manager/pitches/:id/availability-gaps?date=2025-08-12
export async function GET(req, { params }) {
  const manager = await requireRole(req, 'MANAGER');
  // verify pitch ownership
  const pitch = await getPitchForManager(params.pitchId, manager.id);

  const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .parse(Object.fromEntries(req.nextUrl.searchParams));

  const dayStart = startOfDay(parseISO(date));
  const dayEnd   = endOfDay(dayStart);

  // fetch pitch schedule for day-of-week
  const dow = getDay(dayStart); // 0=Sun
  const schedule = pitch.availability.find((a) => a.dayOfWeek === dow);
  if (!schedule || !schedule.isOpen) return NextResponse.json({ gaps: [] });

  const openSlots  = generateSlots(schedule.openTime, schedule.closeTime, pitch.slotDurationMinutes);
  const booked     = await prisma.booking.findMany({
    where: {
      pitchId: pitch.id,
      startTime: { gte: dayStart },
      endTime:   { lte: dayEnd },
      status:    { in: ['PENDING', 'CONFIRMED'] },
    },
    select: { startTime: true, endTime: true },
  });

  const gaps = openSlots.filter((slot) =>
    !booked.some((b) => intervalsOverlap(slot, b))
  );

  return NextResponse.json({ gaps });
}
```

## Acceptance Criteria
**Complete:**
- [ ] Only CONFIRMED bookings can be completed
- [ ] Only after `endTime` has passed
- [ ] Creates `BookingStatusEvent`

**Availability Gaps:**
- [ ] Returns only free slots (not PENDING or CONFIRMED overlap)
- [ ] Respects pitch schedule for day-of-week
- [ ] Returns `[]` if pitch is closed that day

## Definition of Done
- [ ] Both routes created
- [ ] `generateSlots` utility in `packages/shared`
- [ ] Gap detection correctly excludes pending bookings
BODY

create_issue "$title" "$body" '["backend","epic:e11","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E11-06 — Web: Manager Booking List page — /manager/bookings
# ─────────────────────────────────────────────────────────────────────────────
title="[E11-06] [Web] /manager/bookings — booking list page with filters and export"
read -r -d '' body << 'BODY' || true
## Summary
Full-featured booking list page for managers. Table with filters (pitch, status, date range, player search), pagination, and CSV export. Clicking a row opens the booking detail panel.

## Reference
- PRD §9.1 Manager Booking List
- UIUX_SPEC.md §Manager Booking List

## Files to create / modify
- `apps/web/src/app/(manager)/manager/bookings/page.tsx`
- `apps/web/src/app/(manager)/manager/bookings/BookingTable.tsx`
- `apps/web/src/app/(manager)/manager/bookings/BookingFilters.tsx`
- `apps/web/src/app/(manager)/manager/bookings/BookingDetailPanel.tsx`

## Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│ Bookings                                         [Export CSV]        │
├─────────────────────────────────────────────────────────────────────┤
│ [Pitch ▾] [Status ▾] [From ____] [To ____] [🔍 Search player...]   │
├────────────────────────────────────────────────────────────────────-┤
│ Date/Time      │ Player        │ Pitch    │ Status   │ Amount │ …   │
│ ───────────────┼───────────────┼──────────┼──────────┼────────┼──── │
│ Aug 12 14:00   │ Ali Hassan    │ Pitch A  │ CONFIRMED│ £45.00 │ [▶] │
│ Aug 11 10:00   │ Sara Malik    │ Pitch B  │ COMPLETED│ £30.00 │ [▶] │
│ ...                                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ [← Prev]  Page 1 of 12  [Next →]             20 per page           │
└─────────────────────────────────────────────────────────────────────┘
```

## BookingTable columns
| Column      | Width | Notes                                           |
|-------------|-------|-------------------------------------------------|
| Date/Time   | 160px | "Aug 12, 14:00–16:00"                           |
| Player      | 160px | Avatar 28px + displayName                       |
| Pitch       | 120px | Pitch name                                      |
| Status      | 110px | `<StatusBadge>` with colour                     |
| Amount      | 90px  | `£XX.XX` right-aligned                          |
| Actions     | 44px  | [▶] opens detail panel                          |

## StatusBadge colours
```typescript
const STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING:   'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100  text-green-800',
  CANCELLED: 'bg-gray-100   text-gray-600',
  COMPLETED: 'bg-blue-100   text-blue-800',
  NO_SHOW:   'bg-red-100    text-red-800',
};
```

## Booking Detail Panel
- 480px right-side panel (not full page modal)
- Slides in from right with `translate-x-full → translate-x-0` (150ms)
- Contains: player info, booking times, amount breakdown, status timeline, action buttons (Mark No-Show, Mark Complete)
- Closes on Escape or clicking overlay

## CSV Export
```typescript
// Client-side export — fetch all pages then generate CSV
async function exportCSV(filters: BookingFilters) {
  // fetch up to 10,000 rows (limit=100, iterate cursor)
  const rows = await fetchAllBookings(filters, 100);
  const csv = [
    ['Date','Start','End','Player','Pitch','Status','Amount','Fee','Payout'],
    ...rows.map(bookingToCSVRow),
  ].map((r) => r.join(',')).join('\n');
  downloadFile(csv, `bookings-${formatDate(new Date())}.csv`, 'text/csv');
}
```

## Filters
- **Pitch dropdown**: populated from `GET /manager/pitches` — "All pitches" default
- **Status dropdown**: all 5 statuses + "All" default
- **Date range**: two `<input type="date">` fields
- **Search**: debounced 400ms, triggers when ≥ 2 chars or cleared

## Acceptance Criteria
- [ ] Table renders with all 6 columns
- [ ] All 4 filters work and persist in URL query params
- [ ] Pagination loads next page via cursor
- [ ] Detail panel opens on row click / action button
- [ ] CSV export includes all bookings matching current filters (not just current page)
- [ ] No-Show and Complete actions in panel call respective endpoints
- [ ] Table re-fetches after action completes

## Edge Cases
- Empty state (no bookings for filters): "No bookings found" illustration
- CSV export with 0 results: shows toast "No bookings to export"
- Network error during export: toast "Export failed, try again"

## Definition of Done
- [ ] Page and all components created
- [ ] Filters persist in URL (shareable links)
- [ ] Detail panel keyboard accessible (Escape closes)
- [ ] CSV export tested with 100+ rows
BODY

create_issue "$title" "$body" '["frontend","web","epic:e11","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E11-07 — Web: Manager Calendar view — /manager/bookings/calendar
# ─────────────────────────────────────────────────────────────────────────────
title="[E11-07] [Web] /manager/bookings/calendar — weekly calendar view"
read -r -d '' body << 'BODY' || true
## Summary
A 7-column weekly calendar grid showing all bookings as colour-coded event blocks. Manager can navigate weeks, filter by pitch, and click an event to open the booking detail panel.

## Reference
- PRD §9.2 Manager Calendar View
- UIUX_SPEC.md §Manager Calendar

## Files to create
- `apps/web/src/app/(manager)/manager/bookings/calendar/page.tsx`
- `apps/web/src/app/(manager)/manager/bookings/calendar/WeeklyCalendar.tsx`
- `apps/web/src/app/(manager)/manager/bookings/calendar/CalendarEvent.tsx`

## Layout
```
┌───────────────────────────────────────────────────────────────────────┐
│  [< Prev Week]  Mon 4 Aug — Sun 10 Aug 2025  [Next Week >]  [Pitch ▾] │
├──────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│      │  Mon 4   │  Tue 5   │  Wed 6   │  Thu 7   │  Fri 8   │  Sat 9  │
│ 08:00│          │          │  ██████  │          │          │         │
│ 08:30│          │          │  ██████  │          │          │         │
│ 09:00│  ██████  │          │          │  ██████  │          │  ██████ │
│  ...                                                                    │
│ 22:00│          │          │          │          │          │         │
└──────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

## Implementation approach
- Grid rows: 30-min slots from 07:00–23:00 (32 rows)
- CSS Grid: `grid-template-rows: repeat(32, 48px)` (48px per 30 min slot)
- Events positioned absolutely within column using `gridRowStart` / `gridRowEnd`
- Duration calculation: `Math.ceil(durationMinutes / 30)` rows
- Click event: `onEventClick(booking)` → opens detail panel from E11-06

## CalendarEvent component
```typescript
type CalendarEventProps = {
  event:   CalendarEvent;
  onClick: (event: CalendarEvent) => void;
};

export function CalendarEvent({ event, onClick }: CalendarEventProps) {
  const durationRows = Math.ceil(
    differenceInMinutes(parseISO(event.endTime), parseISO(event.startTime)) / 30
  );
  const startRow = slotIndex(event.startTime); // 0 = 07:00

  return (
    <button
      style={{ gridRowStart: startRow + 1, gridRowSpan: durationRows }}
      className="rounded-md p-1 text-xs text-white text-left overflow-hidden w-full"
      style={{ backgroundColor: event.pitchColor }}
      onClick={() => onClick(event)}
    >
      <div className="font-semibold truncate">{event.playerName}</div>
      <div className="opacity-80">
        {format(parseISO(event.startTime), 'HH:mm')}–
        {format(parseISO(event.endTime),   'HH:mm')}
      </div>
      <div className="opacity-80 truncate">{event.pitchName}</div>
    </button>
  );
}
```

## Status overlays on event blocks
| Status    | Overlay                                 |
|-----------|-----------------------------------------|
| CONFIRMED | None (clean colour block)               |
| PENDING   | Diagonal stripe pattern (CSS)           |
| NO_SHOW   | Red border + `✕` icon top-right         |
| COMPLETED | Reduced opacity (0.6)                   |

## Week Navigation
- `[< Prev Week]` / `[Next Week >]` buttons update URL: `?week=2025-08-04`
- URL param `week` = ISO Monday date
- "Today" button jumps to current week

## Pitch Filter Legend
- Below nav: colour legend showing pitch name + calendarColor dot
- Filter toggle: clicking pitch in legend toggles visibility (hides events, does not refetch)

## Acceptance Criteria
- [ ] Events render at correct time positions
- [ ] 30-min slot height = 48px; event spans correct number of rows
- [ ] Week navigation updates URL and refetches data
- [ ] Pitch filter legend toggles event visibility client-side
- [ ] Clicking event opens detail panel (shared from E11-06)
- [ ] NO_SHOW events show red border + ✕

## Edge Cases
- Two bookings overlap same time slot on same pitch → stack (reduce width, offset)
- Event shorter than 30 min → minimum 1 row height
- No bookings in week → empty grid with "No bookings this week" label

## Definition of Done
- [ ] Calendar renders correctly for a week with 20+ events
- [ ] Week nav and URL sync work
- [ ] Pitch colour legend correct
BODY

create_issue "$title" "$body" '["frontend","web","epic:e11","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E11-08 — Web: Manager Booking Detail page — /manager/bookings/[id]
# ─────────────────────────────────────────────────────────────────────────────
title="[E11-08] [Web] /manager/bookings/[id] — manager booking detail page"
read -r -d '' body << 'BODY' || true
## Summary
Full-page booking detail for a specific booking. Shows all booking info, player trust info, payment breakdown, status history, and provides action buttons (Mark No-Show, Mark Complete, Contact Player link). Linked from list table and calendar.

## Reference
- PRD §9.3 Manager Booking Detail

## Files to create
- `apps/web/src/app/(manager)/manager/bookings/[id]/page.tsx`
- `apps/web/src/app/(manager)/manager/bookings/[id]/NoShowConfirmModal.tsx`

## Layout
```
┌────────────────────────────────────────────────────────────┐
│ ← Back to bookings          Booking #A1B2C3    [CONFIRMED] │
├──────────────────────────┬─────────────────────────────────┤
│ BOOKING DETAILS          │ PLAYER INFO                      │
│ Pitch: Pitch A           │ [Avatar 48px] Ali Hassan        │
│ Date:  Mon 12 Aug 2025   │ Trust Score: ██████░░ 720       │
│ Time:  14:00 – 16:00     │ With you: 12 played, 0 no-shows │
│ Team:  7-a-side          │ No-shows: 0    Total: 12        │
│ Shirts: Red ×7           │                                  │
├──────────────────────────┼─────────────────────────────────┤
│ PAYMENT                  │ ACTIONS                          │
│ Subtotal:    £42.86      │ [Mark as No-Show]               │
│ Platform fee: £2.14      │ [Mark as Complete]              │
│ Total:       £45.00      │                                  │
│ Payout:      £42.86      │                                  │
├──────────────────────────┴─────────────────────────────────┤
│ STATUS HISTORY                                              │
│ ● PENDING   → 12 Aug 10:30                                 │
│ ● CONFIRMED → 12 Aug 10:31 (payment captured)              │
└────────────────────────────────────────────────────────────┘
```

## Player reliability, without exposing the score

PRD §9.1 keeps the trust score hidden from managers to avoid discrimination.
Show observable history for this manager's own venue instead:

```typescript
// Counts scoped to this manager's company — facts about their own bookings,
// not a platform-wide judgement of the player.
interface PlayerReliability {
  totalBookings: number   // with this company
  completed:     number
  noShows:       number
  lateCancels:   number
}
```

## No-Show Confirm Modal
```typescript
// NoShowConfirmModal.tsx
// Shows warning: "This will reduce the player's trust score by 10 points
// and cannot be undone. The player will be notified."
// [Cancel] [Confirm No-Show]
// On confirm: POST /manager/bookings/:id/no-show → invalidate query → show toast
```

## Action Button Visibility
| Status    | No-Show | Complete |
|-----------|---------|----------|
| CONFIRMED | ✓ (if startTime ≤ now ≤ startTime+4h) | ✓ (if endTime < now) |
| Others    | hidden  | hidden   |

## Acceptance Criteria
- [ ] All booking details render correctly
- [ ] Player trust score + tier displayed
- [ ] Payment breakdown shows subtotal, fee, payout
- [ ] Status history timeline rendered
- [ ] "Mark as No-Show" only visible when within 4h window
- [ ] "Mark as Complete" only visible after booking end time
- [ ] No-Show confirm modal shows warning text before submitting
- [ ] After no-show: status badge updates to NO_SHOW, action buttons hide

## Edge Cases
- Booking not found → redirect to `/manager/bookings`
- Booking from different company → 403 → redirect
- Player deleted account → show "Deleted User" with fallback avatar

## Definition of Done
- [ ] Page created with all sections
- [ ] Both action flows (no-show, complete) fully functional
- [ ] Modal has accessible focus trap
BODY

create_issue "$title" "$body" '["frontend","web","epic:e11","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E11-09 — Mobile: Manager Booking List + Detail screens
# ─────────────────────────────────────────────────────────────────────────────
title="[E11-09] [Mobile] Manager booking list and detail screens"
read -r -d '' body << 'BODY' || true
## Summary
Mobile screens for manager booking management. A scrollable booking list with filter chips and a detail screen with no-show and complete actions. Managers access from the Manager tab in the mobile app.

## Reference
- PRD §9.1–9.3 (mobile manager experience)
- UIUX_SPEC.md §Mobile Manager Bookings

## Files to create
- `apps/mobile/src/screens/manager/ManagerBookingsScreen.tsx`
- `apps/mobile/src/screens/manager/ManagerBookingDetailScreen.tsx`
- `apps/mobile/src/components/manager/ManagerBookingCard.tsx`
- `apps/mobile/src/hooks/useManagerBookings.ts`

## ManagerBookingsScreen layout
```
┌───────────────────────────┐
│ ≡  Bookings          [⚙]  │
├───────────────────────────┤
│ [All] [Confirmed] [NoShow]│
│ [Pitch ▾]  [📅 Date]      │
├───────────────────────────┤
│ ┌─────────────────────┐   │
│ │ Ali Hassan       ✓  │   │
│ │ Mon 12 Aug 14:00    │   │
│ │ Pitch A · £45.00    │   │
│ └─────────────────────┘   │
│ ┌─────────────────────┐   │
│ │ Sara Malik      ⚠  │   │
│ │ Mon 11 Aug 10:00    │   │
│ │ Pitch B · £30.00    │   │
│ └─────────────────────┘   │
└───────────────────────────┘
```

## ManagerBookingCard
```typescript
type ManagerBookingCardProps = {
  booking: ManagerBookingListItem;
  onPress: () => void;
};

// Status icon: ✓ CONFIRMED, ⚠ NO_SHOW, ✗ CANCELLED, ● PENDING, ✔ COMPLETED
// Shows: player name + status icon, date/time, pitch name + amount
// Height: fixed 80px card
// Left border: 4px coloured by pitch calendarColor
```

## useManagerBookings hook
```typescript
export function useManagerBookings(filters: BookingFilters) {
  return useInfiniteQuery({
    queryKey:  ['manager-bookings', filters],
    queryFn:   ({ pageParam }) => fetchManagerBookings({ ...filters, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}
```

## ManagerBookingDetailScreen
- Stack screen pushed from booking list
- Sections: Booking Info, Player Info (trust score + tier badge), Payment Breakdown, Status History, Action Buttons
- **Mark No-Show**: renders only within 4h window after start; shows `Alert.alert` confirmation
- **Mark Complete**: renders only after endTime; shows `Alert.alert` confirmation

## No-Show Alert
```typescript
Alert.alert(
  'Mark as No-Show?',
  'This will reduce the player\'s trust score by 10 points and cannot be undone.',
  [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: markNoShow },
  ]
);
```

## Acceptance Criteria
- [ ] Filter chips update list (status, pitch, date)
- [ ] Infinite scroll loads next page at bottom
- [ ] BookingCard left border color matches pitch calendarColor
- [ ] Detail screen shows all sections
- [ ] No-Show Alert shown before submitting
- [ ] After no-show: status badge updates, buttons disappear
- [ ] Empty state per filter: "No bookings found"

## Edge Cases
- Manager has no pitches → show "Add a pitch to start receiving bookings"
- Pull-to-refresh resets cursor and re-fetches
- Network error: retry button on error state

## Definition of Done
- [ ] List and detail screens created
- [ ] `useManagerBookings` infinite query working
- [ ] No-show and complete flows tested on device
BODY

create_issue "$title" "$body" '["mobile","epic:e11","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E11-10 — Shared: calcPrice + generateSlots utilities + auto-complete cron
# ─────────────────────────────────────────────────────────────────────────────
title="[E11-10] [Shared + Backend] calcPrice, generateSlots utilities + auto-complete cron job"
read -r -d '' body << 'BODY' || true
## Summary
Three utilities and one cron job that support the booking management system:
1. `calcPrice` — compute booking price from slot count, peak periods, shirt selection (used E05-07 and E10-08 live preview)
2. `generateSlots` — return available time slots for a date (used E11-05 availability-gaps)
3. `isWithinNoShowWindow` — shared time check used by both web and mobile to control button visibility
4. Auto-complete cron — nightly job to auto-COMPLETE all CONFIRMED bookings past their endTime

## Files to create / modify
- `packages/shared/src/utils/pricing.ts` (calcPrice + tests)
- `packages/shared/src/utils/slots.ts` (generateSlots + isWithinNoShowWindow + tests)
- `apps/web/src/app/api/v1/cron/auto-complete/route.ts` (Vercel Cron)

## calcPrice
```typescript
// packages/shared/src/utils/pricing.ts
export type PricingConfig = {
  offPeakRate: number;   // pence per 30-min slot
  peakRate:    number;
  peakPeriods: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  platformFeePercent: number;  // e.g. 5 for 5%
};

export type SlotSelection = { startTime: Date; endTime: Date };

export function calcPrice(slots: SlotSelection[], config: PricingConfig) {
  let subtotal = 0;
  for (const slot of slots) {
    const isPeak = config.peakPeriods.some((p) => slotInPeakPeriod(slot, p));
    const rate   = isPeak ? config.peakRate : config.offPeakRate;
    const durationSlots = differenceInMinutes(slot.endTime, slot.startTime) / 30;
    subtotal += rate * durationSlots;
  }
  const platformFee = Math.round(subtotal * config.platformFeePercent / 100);
  return { subtotal, platformFee, total: subtotal + platformFee };
}
```

## generateSlots
```typescript
// packages/shared/src/utils/slots.ts
export type TimeSlot = { startTime: Date; endTime: Date; label: string };

export function generateSlots(
  openTime:        string,    // "08:00"
  closeTime:       string,    // "22:00"
  slotDurationMin: number,    // e.g. 60
  date:            Date,
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  let current = parseTimeOnDate(openTime, date);
  const close  = parseTimeOnDate(closeTime, date);
  while (addMinutes(current, slotDurationMin) <= close) {
    const end = addMinutes(current, slotDurationMin);
    slots.push({
      startTime: current,
      endTime:   end,
      label:     `${format(current, 'HH:mm')}–${format(end, 'HH:mm')}`,
    });
    current = end;
  }
  return slots;
}

export function isWithinNoShowWindow(startTime: Date, now = new Date()): boolean {
  return now >= startTime && now <= addHours(startTime, 4);
}
```

## Auto-Complete Cron (Vercel Cron)
```typescript
// apps/web/src/app/api/v1/cron/auto-complete/route.ts
// Runs nightly at 02:00 UTC via vercel.json cron config
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date();
  const result = await prisma.booking.updateMany({
    where: { status: 'CONFIRMED', endTime: { lt: cutoff } },
    data:  { status: 'COMPLETED' },
  });

  console.log(`[auto-complete] completed ${result.count} bookings`);
  return NextResponse.json({ completed: result.count });
}
```

## vercel.json cron config
```json
{
  "crons": [
    { "path": "/api/v1/cron/auto-complete", "schedule": "0 2 * * *" }
  ]
}
```

## Unit Tests Required
```typescript
// packages/shared/src/utils/pricing.test.ts
describe('calcPrice', () => {
  it('applies off-peak rate outside peak hours');
  it('applies peak rate within peak window');
  it('calculates platform fee correctly at 5%');
  it('handles multi-slot selection with mixed peak/off-peak');
});

// packages/shared/src/utils/slots.test.ts
describe('generateSlots', () => {
  it('generates correct slots for 08:00–22:00 at 60min');
  it('stops before closeTime (no partial slots)');
  it('handles 30-min slots');
});

describe('isWithinNoShowWindow', () => {
  it('returns true exactly at startTime');
  it('returns true at startTime + 3h');
  it('returns false before startTime');
  it('returns false at startTime + 4h + 1s');
});
```

## Acceptance Criteria
- [ ] `calcPrice` exported from `packages/shared`
- [ ] `generateSlots` exported from `packages/shared`
- [ ] `isWithinNoShowWindow` exported from `packages/shared`
- [ ] Auto-complete cron rejects requests without `CRON_SECRET`
- [ ] Auto-complete updates all eligible CONFIRMED bookings in one query
- [ ] All unit tests pass

## Edge Cases
- Booking endTime exactly equals `now` → included in auto-complete
- `generateSlots` with slot duration that doesn't divide evenly → last partial slot excluded
- Peak period spans midnight → handle day boundary correctly

## Definition of Done
- [ ] All 3 utilities created with tests
- [ ] Auto-complete cron created with auth guard
- [ ] `vercel.json` updated with cron schedule
- [ ] `packages/shared` exports updated (index.ts)
BODY

create_issue "$title" "$body" '["backend","shared","epic:e11","type:feature"]' "$MILESTONE"

echo ""
echo "✓ E11 — Manager: Booking Mgmt (10 issues created)"
