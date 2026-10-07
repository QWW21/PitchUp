#!/usr/bin/env bash
# e15.sh — create all E15 Admin Panel issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E15 — Admin Panel")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E15 — Admin Panel' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E15 — Admin Panel)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E15-01 — Backend: Admin auth guard + GET /admin/companies
# ─────────────────────────────────────────────────────────────────────────────
title="[E15-01] [Backend] Admin auth guard + GET /admin/companies — company approval queue"
read -r -d '' body << 'BODY' || true
## Summary
Admin-role middleware and the company approval queue endpoint. Admins see all companies in PENDING_APPROVAL status, can filter by status, and paginate. Foundation for the entire admin panel.

## Reference
- PRD §14.1 Admin Panel — Company Management

## Files to create
- `apps/web/src/lib/auth/requireAdmin.ts`
- `apps/web/src/app/api/v1/admin/companies/route.ts` — GET

## requireAdmin middleware
```typescript
// apps/web/src/lib/auth/requireAdmin.ts
export async function requireAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (user.role !== 'ADMIN') {
    throw new ApiError(403, 'Admin access required');
  }
  return user;
}
```

## GET /admin/companies
```typescript
// Query params: status? | search? | cursor? | limit=20
export async function GET(req: NextRequest) {
  await requireAdmin(req);
  const { status, search, cursor, limit } = AdminCompanyQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const companies = await prisma.company.findMany({
    where: {
      ...(status && { status }),
      ...(search && {
        OR: [
          { name:              { contains: search, mode: 'insensitive' } },
          { manager: { email:  { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(cursor && { id: { lt: cursor } }),
    },
    orderBy: { createdAt: 'desc' },
    take: Number(limit) + 1,
    include: {
      manager: { select: { id: true, displayName: true, email: true } },
      _count:  { select: { pitches: true } },
    },
  });

  const hasMore = companies.length > Number(limit);
  if (hasMore) companies.pop();

  return NextResponse.json({
    data:       companies,
    nextCursor: hasMore ? companies.at(-1)!.id : null,
  });
}
```

## CompanyStatus flow
```
DRAFT → PENDING_APPROVAL → APPROVED | REJECTED
APPROVED → SUSPENDED
SUSPENDED → APPROVED (reinstate)
```

## Acceptance Criteria
- [ ] Non-ADMIN role → 403
- [ ] `status` filter works for all 5 statuses
- [ ] `search` matches company name OR manager email (case-insensitive)
- [ ] Cursor pagination correct
- [ ] Returns `manager` + pitch count per company

## Edge Cases
- `status` invalid enum → 400 Zod error
- `search` < 2 chars → 400
- No companies in queue → `{ data: [], nextCursor: null }`

## Definition of Done
- [ ] `requireAdmin` middleware created
- [ ] Route created with all filters
- [ ] Integration test: non-admin → 403
BODY

create_issue "$title" "$body" '["backend","epic:e15","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E15-02 — Backend: PUT /admin/companies/:id/status — approve/reject/suspend
# ─────────────────────────────────────────────────────────────────────────────
title="[E15-02] [Backend] PUT /admin/companies/:id/status — approve, reject, suspend company"
read -r -d '' body << 'BODY' || true
## Summary
Admin endpoint to transition a company through its status lifecycle: approve (PENDING_APPROVAL → APPROVED), reject (PENDING_APPROVAL → REJECTED), or suspend (APPROVED → SUSPENDED). Each transition sends a notification to the manager.

## Reference
- PRD §14.2 Company Approval Flow

## File to create
`apps/web/src/app/api/v1/admin/companies/[companyId]/status/route.ts` — PUT

## Valid transitions
```typescript
const ALLOWED_TRANSITIONS: Record<CompanyStatus, CompanyStatus[]> = {
  DRAFT:              [],
  PENDING_APPROVAL:   ['APPROVED', 'REJECTED'],
  APPROVED:           ['SUSPENDED'],
  REJECTED:           ['PENDING_APPROVAL'],   // re-apply after fix
  SUSPENDED:          ['APPROVED'],
};
```

## Implementation
```typescript
export const CompanyStatusUpdateSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED', 'PENDING_APPROVAL']),
  reason: z.string().min(10).max(500).optional(),  // required for REJECTED + SUSPENDED
});

export async function PUT(req, { params }) {
  const admin   = await requireAdmin(req);
  const { status, reason } = CompanyStatusUpdateSchema.parse(await req.json());

  const company = await prisma.company.findUniqueOrThrow({
    where:   { id: params.companyId },
    include: { manager: { select: { id: true, email: true, displayName: true } } },
  });

  const allowed = ALLOWED_TRANSITIONS[company.status];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${company.status} to ${status}` },
      { status: 422 }
    );
  }

  if (['REJECTED', 'SUSPENDED'].includes(status) && !reason) {
    return NextResponse.json(
      { error: 'Reason required for rejection or suspension' },
      { status: 400 }
    );
  }

  await prisma.company.update({
    where: { id: company.id },
    data:  { status, statusReason: reason ?? null, statusUpdatedAt: new Date() },
  });

  // Notify manager (fire-and-forget)
  const notifMap: Partial<Record<CompanyStatus, { title: string; body: string }>> = {
    APPROVED:  { title: 'Company approved!',   body: 'Your company is now live on PitchUp. Add your first pitch to start receiving bookings.' },
    REJECTED:  { title: 'Company not approved', body: `Your application was not approved: ${reason}. You may re-apply after making the requested changes.` },
    SUSPENDED: { title: 'Company suspended',    body: `Your company has been suspended: ${reason}. Contact support to resolve.` },
  };
  const notif = notifMap[status];
  if (notif) {
    sendNotification({ userId: company.managerId, type: 'SYSTEM_ANNOUNCEMENT', ...notif })
      .catch((err) => console.error('[admin-status] notify failed', company.id, err.message));
  }

  return NextResponse.json({ success: true, status });
}
```

## Schema additions
```prisma
model Company {
  statusReason    String?
  statusUpdatedAt DateTime?
}
```

## Acceptance Criteria
- [ ] Only valid transitions succeed — invalid → 422 with descriptive message
- [ ] REJECTED + SUSPENDED require `reason` — missing → 400
- [ ] Manager notified on APPROVED, REJECTED, SUSPENDED (fire-and-forget)
- [ ] `statusReason` + `statusUpdatedAt` stored on company
- [ ] Admin cannot approve own company (if admin also has manager role)

## Edge Cases
- Company already APPROVED → approve again → 422 (not idempotent)
- `reason` provided on APPROVED → stored but not required
- Stripe Connect account still pending → company can be APPROVED regardless (Stripe handled separately)

## Definition of Done
- [ ] Route with transition validation
- [ ] Migration for `statusReason`, `statusUpdatedAt`
- [ ] Integration test for each valid transition
BODY

create_issue "$title" "$body" '["backend","epic:e15","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E15-03 — Backend: GET/PUT /admin/users — user management
# ─────────────────────────────────────────────────────────────────────────────
title="[E15-03] [Backend] GET /admin/users + PUT /admin/users/:id — user management"
read -r -d '' body << 'BODY' || true
## Summary
Admin user list with search/filter and individual user management: view profile, adjust trust score manually, suspend/unsuspend, delete account.

## Reference
- PRD §14.3 Admin User Management

## Files to create
- `apps/web/src/app/api/v1/admin/users/route.ts` — GET
- `apps/web/src/app/api/v1/admin/users/[userId]/route.ts` — GET (detail) + PUT (update)

## GET /admin/users
```typescript
// Query: search? | role? | tier? | suspended? | cursor? | limit=20
// `tier` filters on a score range: the tier is derived, not stored.
export async function GET(req: NextRequest) {
  await requireAdmin(req);
  const { search, role, tier, suspended, cursor, limit } =
    AdminUserQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  // TRUST_TIERS from @pitchup/shared carries each tier's min and max.
  const tierRange = tier ? TRUST_TIERS.find(t => t.label === tier) : undefined;

  const users = await prisma.user.findMany({
    where: {
      ...(search && {
        OR: [
          { displayName: { contains: search, mode: 'insensitive' } },
          { email:       { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(role      && { role }),
      ...(tierRange && { trustScore: { gte: tierRange.min, lte: tierRange.max } }),
      ...(suspended !== undefined && { suspendedAt: suspended ? { not: null } : null }),
      ...(cursor    && { id: { lt: cursor } }),
    },
    orderBy: { createdAt: 'desc' },
    take:    Number(limit) + 1,
    select: {
      id: true, displayName: true, email: true, role: true,
      trustScore: true, suspendedAt: true,   // tier via deriveTier(trustScore)
      createdAt: true, deletedAt: true,
      _count: { select: { bookings: true } },
    },
  });

  const hasMore = users.length > Number(limit);
  if (hasMore) users.pop();
  return NextResponse.json({ data: users, nextCursor: hasMore ? users.at(-1)!.id : null });
}
```

## PUT /admin/users/:id
```typescript
export const AdminUserUpdateSchema = z.object({
  suspended:        z.boolean().optional(),
  trustScoreAdjust: z.number().int().min(-100).max(100).optional(),
  trustAdjustReason: z.string().min(5).max(200).optional(),
});

export async function PUT(req, { params }) {
  const admin = await requireAdmin(req);
  const body  = AdminUserUpdateSchema.parse(await req.json());

  if (body.suspended !== undefined) {
    await prisma.user.update({
      where: { id: params.userId },
      data:  { suspendedAt: body.suspended ? new Date() : null },
    });
  }

  if (body.trustScoreAdjust !== undefined) {
    if (!body.trustAdjustReason) {
      return NextResponse.json({ error: 'Reason required for trust score adjustment' }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: params.userId },
        data:  { trustScore: { increment: body.trustScoreAdjust! } },
        select: { trustScore: true },
      });
      const clamped = Math.max(TRUST_SCORE_MIN, Math.min(TRUST_SCORE_MAX, user.trustScore));
      await tx.user.update({ where: { id: params.userId }, data: { trustScore: clamped } });
      await tx.trustEvent.create({
        data: {
          userId:    params.userId,
          event:     'ADMIN_ADJUSTMENT',
          delta:     body.trustScoreAdjust!,
          processed: true,
        },
      });
    });
  }

  return NextResponse.json({ success: true });
}
```

## Schema additions
```prisma
model User {
  suspendedAt DateTime?
}
```

## Acceptance Criteria
- [ ] `GET /admin/users` filters by role, tier, suspended, search
- [ ] Suspended users: `suspendedAt` non-null; active = null
- [ ] Trust adjustment clamped [0,100] + a `TrustScoreEvent` audit row

> `ADMIN_ADJUSTMENT` is not in the `TrustScoreReason` enum shipped in E01-02.
> Either add it (migration) or record the adjustment in a separate admin
> audit log. Decide before implementing — do not reuse an unrelated reason.
- [ ] `trustAdjustReason` required when adjusting score
- [ ] Admin cannot suspend themselves

## Edge Cases
- Adjust trust on deleted user → 404
- Suspend already-suspended user → idempotent (set `suspendedAt = now()` again)
- `trustScoreAdjust: 0` → 400 (pointless operation)

## Definition of Done
- [ ] Both routes created
- [ ] Migration for `suspendedAt`
- [ ] `ADMIN_ADJUSTMENT` added to `TrustEvent.event` enum/convention
BODY

create_issue "$title" "$body" '["backend","epic:e15","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E15-04 — Backend: GET /admin/disputes + review moderation endpoints
# ─────────────────────────────────────────────────────────────────────────────
title="[E15-04] [Backend] GET /admin/disputes (list) + DELETE /admin/reviews/:id — moderation"
read -r -d '' body << 'BODY' || true
## Summary
Two admin moderation capabilities:
1. `GET /admin/disputes` — list all open disputes for the admin panel (supplements the resolve endpoint from E12-04)
2. `DELETE /admin/reviews/:id` — hard-delete an abusive/spam review, notifying the review author

## Reference
- PRD §14.4 Dispute + Review Moderation
- E12-04 (PUT /admin/disputes/:id/resolve — already built)

## Files to create
- `apps/web/src/app/api/v1/admin/disputes/route.ts` — GET
- `apps/web/src/app/api/v1/admin/reviews/[reviewId]/route.ts` — DELETE

## GET /admin/disputes
```typescript
// Query: status? (OPEN|UPHELD_FOR_PLAYER|UPHELD_FOR_MANAGER|DISMISSED) | cursor? | limit=20
export async function GET(req: NextRequest) {
  await requireAdmin(req);
  const { status, cursor, limit } = DisputeListQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const disputes = await prisma.dispute.findMany({
    where: {
      ...(status && { status }),
      ...(cursor && { id: { lt: cursor } }),
    },
    orderBy: { createdAt: 'desc' },
    take:    Number(limit) + 1,
    include: {
      booking: {
        include: {
          pitch:  { select: { name: true, company: { select: { name: true } } } },
          player: { select: { displayName: true, email: true, trustScore: true } },
        },
      },
    },
  });

  const hasMore = disputes.length > Number(limit);
  if (hasMore) disputes.pop();
  return NextResponse.json({ data: disputes, nextCursor: hasMore ? disputes.at(-1)!.id : null });
}
```

## DELETE /admin/reviews/:id
```typescript
export async function DELETE(req, { params }) {
  const admin = await requireAdmin(req);

  const review = await prisma.review.findUniqueOrThrow({
    where:   { id: params.reviewId },
    include: { booking: { select: { playerId: true, pitchId: true } } },
  });

  const { reason } = AdminDeleteReviewSchema.parse(await req.json());

  // Hard delete (admin override of normal soft-delete)
  await prisma.review.delete({ where: { id: review.id } });

  // Recalculate pitch rating after deletion
  await recalcPitchRating(review.booking.pitchId);

  // Notify review author
  sendNotification({
    userId: review.booking.playerId,
    type:   'SYSTEM_ANNOUNCEMENT',
    title:  'Review removed',
    body:   `Your review was removed by a moderator: ${reason}`,
  }).catch((err) => console.error('[admin-delete-review]', err.message));

  return NextResponse.json({ success: true });
}

// Schema
const AdminDeleteReviewSchema = z.object({
  reason: z.string().min(10).max(300),
});
```

## Acceptance Criteria
- [ ] `GET /admin/disputes` default filter: all statuses (not just OPEN)
- [ ] Dispute list includes booking, pitch name, player info
- [ ] `DELETE /admin/reviews/:id` requires `reason` body field
- [ ] Review hard-deleted (not soft)
- [ ] `recalcPitchRating` called after deletion
- [ ] Author notified with reason (fire-and-forget)

## Edge Cases
- Review already deleted → 404
- `reason` missing on DELETE → 400
- Dispute already resolved → still returned in list (use `status` filter to exclude)

## Definition of Done
- [ ] Both routes created
- [ ] Hard delete verified (row gone, not just `deletedAt` set)
- [ ] Rating recalc confirmed in integration test
BODY

create_issue "$title" "$body" '["backend","epic:e15","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E15-05 — Backend: GET /admin/stats + system config endpoints
# ─────────────────────────────────────────────────────────────────────────────
title="[E15-05] [Backend] GET /admin/stats — platform KPIs + GET/PUT /admin/config"
read -r -d '' body << 'BODY' || true
## Summary
Two admin-only endpoints:
1. `GET /admin/stats` — platform-wide KPIs for the admin overview dashboard (total users, bookings, GMV, open disputes)
2. `GET/PUT /admin/config` — runtime configuration for platform-level settings (platform fee %, no-show fee default, maintenance mode)

## Reference
- PRD §14.5 Admin Dashboard + Config

## Files to create
- `apps/web/src/app/api/v1/admin/stats/route.ts` — GET
- `apps/web/src/app/api/v1/admin/config/route.ts` — GET + PUT

## GET /admin/stats
```typescript
export async function GET(req: NextRequest) {
  await requireAdmin(req);

  const [
    totalUsers,
    totalManagers,
    totalCompanies,
    totalPitches,
    totalBookings,
    openDisputes,
    gmv,
    last30dGmv,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { role: 'MANAGER', deletedAt: null } }),
    prisma.company.count(),
    prisma.pitch.count({ where: { isActive: true } }),
    prisma.booking.count({ where: { status: { in: ['COMPLETED', 'CONFIRMED'] } } }),
    prisma.dispute.count({ where: { status: 'OPEN' } }),
    prisma.booking.aggregate({
      where:  { status: 'COMPLETED' },
      _sum:   { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where:  { status: 'COMPLETED', startTime: { gte: subDays(new Date(), 30) } },
      _sum:   { totalAmount: true },
    }),
  ]);

  return NextResponse.json({
    users:         totalUsers,
    managers:      totalManagers,
    companies:     totalCompanies,
    activePitches: totalPitches,
    bookings:      totalBookings,
    openDisputes,
    gmv:           Number(gmv._sum.totalAmount ?? 0),
    last30dGmv:    Number(last30dGmv._sum.totalAmount ?? 0),
  });
}
```

## PlatformConfig model
```prisma
model PlatformConfig {
  id                  String  @id @default("singleton")
  platformFeePercent  Int     @default(5)         // 5 = 5%
  noShowFeeDefault    Int     @default(0)          // pence
  maintenanceMode     Boolean @default(false)
  maintenanceMessage  String  @default("PitchUp is undergoing scheduled maintenance.")
  updatedAt           DateTime @updatedAt
  updatedById         String?
}
```

## GET/PUT /admin/config
```typescript
export async function GET(req: NextRequest) {
  await requireAdmin(req);
  const config = await prisma.platformConfig.upsert({
    where:  { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  });
  return NextResponse.json(config);
}

export const PlatformConfigSchema = z.object({
  platformFeePercent: z.number().int().min(0).max(20).optional(),
  noShowFeeDefault:   z.number().int().min(0).max(10000).optional(),  // max £100
  maintenanceMode:    z.boolean().optional(),
  maintenanceMessage: z.string().min(10).max(500).optional(),
});

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  const body  = PlatformConfigSchema.parse(await req.json());

  const config = await prisma.platformConfig.upsert({
    where:  { id: 'singleton' },
    create: { id: 'singleton', ...body, updatedById: admin.id },
    update: { ...body, updatedById: admin.id },
  });
  return NextResponse.json(config);
}
```

## Maintenance mode
When `maintenanceMode = true`: Next.js middleware checks this config on each request and returns 503 with `maintenanceMessage` for non-admin users. Check cached via `unstable_cache` with 60s TTL — not per-request DB hit.

## Acceptance Criteria
- [ ] `GET /admin/stats` runs all 8 queries concurrently (`Promise.all`)
- [ ] GMV = sum of COMPLETED booking `totalAmount` only
- [ ] `GET/PUT /admin/config` upserts singleton row
- [ ] `platformFeePercent` clamped 0–20
- [ ] `maintenanceMode: true` → non-admin requests get 503
- [ ] Config cached 60s in middleware to avoid per-request DB hit

## Edge Cases
- No completed bookings → `gmv: 0` (not null)
- Maintenance mode enabled → admin panel itself still accessible (role check before maintenance check)

## Definition of Done
- [ ] Both routes created
- [ ] `PlatformConfig` migration
- [ ] Middleware maintenance check with cache
BODY

create_issue "$title" "$body" '["backend","epic:e15","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E15-06 — Web: Admin panel layout + company approval queue page
# ─────────────────────────────────────────────────────────────────────────────
title="[E15-06] [Web] Admin panel layout + /admin/companies — company approval queue"
read -r -d '' body << 'BODY' || true
## Summary
Admin panel shell with sidebar navigation and the company approval queue page. Admins review company applications with full detail and approve/reject/suspend from an action panel.

## Reference
- PRD §14.1–14.2
- UIUX_SPEC.md §Admin Panel

## Files to create
- `apps/web/src/app/(admin)/admin/layout.tsx`
- `apps/web/src/app/(admin)/admin/companies/page.tsx`
- `apps/web/src/app/(admin)/admin/companies/CompanyDetailPanel.tsx`

## Admin layout
```tsx
// Sidebar: 220px, dark neutral-900 background (same as manager layout)
// Nav items: Overview, Companies, Users, Disputes, Reviews, Config
// Each nav item: icon + label, active = primary-600 left border

// Route guard: redirect non-ADMIN to /login
// (middleware checks user.role === 'ADMIN')
```

## Company queue page layout
```
┌──────────────────────────────────────────────────────────────────┐
│ Companies       [Status: Pending ▾]  [🔍 Search...]  [+ Invite] │
├────────────┬────────────┬──────────────┬──────────┬─────────────┤
│ Company    │ Manager    │ Submitted    │ Pitches  │ Status      │
│ ───────────┼────────────┼──────────────┼──────────┼──────────── │
│ Green FC   │ Ali Hassan │ 2 hours ago  │ 0        │ ⏳ PENDING  │
│ City Pitch │ Sara Malik │ 3 days ago   │ 2        │ ✓ APPROVED  │
└────────────┴────────────┴──────────────┴──────────┴─────────────┘
```

## CompanyDetailPanel (480px right-side panel)
```tsx
// Opens on row click
// Sections:
// 1. Company Info: name, logo, address, phone, website
// 2. Manager Info: name, email, join date
// 3. Stripe Connect: status badge (PENDING | COMPLETE)
// 4. Working Hours: summary table
// 5. Action buttons (based on current status):
//    PENDING_APPROVAL → [Approve] [Reject] (with reason textarea)
//    APPROVED         → [Suspend] (with reason textarea)
//    SUSPENDED        → [Reinstate]
//    REJECTED         → read-only (rejection reason shown)

// Approve/Reject: calls PUT /admin/companies/:id/status
// On success: invalidate query, show toast, panel closes
```

## Status badge colours
```typescript
const STATUS_COLORS: Record<CompanyStatus, string> = {
  DRAFT:             'bg-gray-100   text-gray-600',
  PENDING_APPROVAL:  'bg-yellow-100 text-yellow-800',
  APPROVED:          'bg-green-100  text-green-800',
  REJECTED:          'bg-red-100    text-red-800',
  SUSPENDED:         'bg-orange-100 text-orange-800',
};
```

## Acceptance Criteria
- [ ] Admin layout renders with all 6 nav items
- [ ] Non-admin accessing /admin/* → redirect to /login
- [ ] Company table renders with status badges
- [ ] Status filter dropdown works
- [ ] Detail panel opens on row click
- [ ] Approve/Reject actions call correct endpoint
- [ ] Reason textarea required for Reject + Suspend (client validation)
- [ ] Toast shown on success, panel closes

## Edge Cases
- Empty queue (no pending companies) → "No companies found" state
- Company logo fails to load → initials fallback
- Reject without reason → button disabled until reason ≥ 10 chars

## Definition of Done
- [ ] Layout + page + panel created
- [ ] All 4 status transitions wired up
- [ ] Panel keyboard accessible (Escape closes)
BODY

create_issue "$title" "$body" '["frontend","web","epic:e15","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E15-07 — Web: Admin user management page
# ─────────────────────────────────────────────────────────────────────────────
title="[E15-07] [Web] /admin/users — user management page"
read -r -d '' body << 'BODY' || true
## Summary
Admin user list with search, role/tier/suspended filters, and a user detail panel to view profile, adjust trust score manually, and suspend/unsuspend.

## Reference
- PRD §14.3

## Files to create
- `apps/web/src/app/(admin)/admin/users/page.tsx`
- `apps/web/src/app/(admin)/admin/users/UserDetailPanel.tsx`

## User table columns
| Column | Width | Notes |
|--------|-------|-------|
| User | 180px | Avatar 28px + displayName |
| Email | 180px | truncated |
| Role | 80px | PLAYER / MANAGER badge |
| Trust | 100px | Score + tier badge |
| Bookings | 80px | total count |
| Status | 100px | Active / Suspended |
| Joined | 100px | relative date |

## Filters
- Search (name or email, debounced 400ms)
- Role dropdown (All / PLAYER / MANAGER / ADMIN)
- Trust tier dropdown (All / Excellent / Good / Fair / Poor / Suspended) — filters on the tier's score range
- Suspended toggle (All / Active / Suspended)

## UserDetailPanel
```tsx
// Sections:
// 1. Profile: avatar, name, email, phone, join date, last login
// 2. Trust: score progress bar, tier badge, event history link
// 3. Bookings: count, no-show count, cancellation count
// 4. Trust Adjustment form:
//    - Delta input (−100 to +100)
//    - Reason textarea (required)
//    - [Apply Adjustment] button
// 5. Account Actions:
//    - [Suspend Account] / [Reinstate Account] toggle
//    - [Delete Account] (irreversible — confirm dialog)

// Trust adjustment: POST calls PUT /admin/users/:id { trustScoreAdjust, trustAdjustReason }
// Shows new score after success
```

## Trust score progress bar
```tsx
// Visual: 0–1000 range, coloured by tier
// Suspended=red, Poor=amber, Fair=gray, Good=primary, Excellent=cyan
<div className="w-full bg-gray-100 rounded-full h-2">
  <div
    className={`h-2 rounded-full ${TIER_BAR_COLORS[deriveTier(user.trustScore)]}`}
    style={{ width: `${user.trustScore / 10}%` }}
  />
</div>
```

## Acceptance Criteria
- [ ] Table renders with all 7 columns
- [ ] All 4 filters work independently and in combination
- [ ] Detail panel opens on row click
- [ ] Trust adjustment: input + reason → PUT → score updates in panel
- [ ] Suspend toggle → status column updates
- [ ] Delete account: confirm dialog ("Type the user's email to confirm") → PUT /admin/users/:id with soft delete

## Edge Cases
- Adjusting trust on ADMIN user → allowed (admin can adjust other admins)
- Delta = 0 → button disabled
- Suspended ADMIN → they can no longer access admin panel (middleware checks suspendedAt)

## Definition of Done
- [ ] Page + panel created
- [ ] All filters functional
- [ ] Trust adjustment + suspend flows tested
BODY

create_issue "$title" "$body" '["frontend","web","epic:e15","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E15-08 — Web: Admin disputes page + review moderation page
# ─────────────────────────────────────────────────────────────────────────────
title="[E15-08] [Web] /admin/disputes + /admin/reviews — dispute resolution + review moderation"
read -r -d '' body << 'BODY' || true
## Summary
Two admin moderation pages:
1. `/admin/disputes` — list and resolve disputes (uses resolve endpoint from E12-04)
2. `/admin/reviews` — list all reviews with flag-report count, delete abusive ones

## Reference
- PRD §14.4
- E12-04 (resolve endpoint)
- E15-04 (delete review endpoint)

## Files to create
- `apps/web/src/app/(admin)/admin/disputes/page.tsx`
- `apps/web/src/app/(admin)/admin/reviews/page.tsx`

## Disputes page layout
```
┌────────────────────────────────────────────────────────┐
│ Disputes      [Status: Open ▾]          [🔍 Search...] │
├──────────┬──────────────┬────────────┬──────────┬──────┤
│ Booking  │ Player       │ Pitch      │ Opened   │ Status│
│ ─────────┼──────────────┼────────────┼──────────┼───── │
│ #A1B2C3  │ Ali Hassan   │ Pitch A    │ 2h ago   │ OPEN │
└──────────┴──────────────┴────────────┴──────────┴──────┘

// Row click → Dispute Detail Panel (480px):
//   - Booking summary (date, time, pitch, player)
//   - Player's dispute reason + evidence image (if any)
//   - Outcome selector: [Player wins] [Manager wins] [Dismiss]
//   - Resolution notes textarea (required, min 10 chars)
//   - [Submit Resolution] → PUT /admin/disputes/:id/resolve
```

## Dispute outcome colours
```typescript
const OUTCOME_COLORS = {
  UPHELD_FOR_PLAYER:  'bg-green-100 text-green-800',
  UPHELD_FOR_MANAGER: 'bg-blue-100  text-blue-800',
  DISMISSED:          'bg-gray-100  text-gray-600',
};
```

## Reviews moderation page layout
```
┌────────────────────────────────────────────────────────────┐
│ Reviews        [Min Reports: 1 ▾]   [Rating ▾]  [🔍 ...]  │
├──────────┬───────────┬───────────┬──────┬────────┬─────────┤
│ Pitch    │ Player    │ Comment   │Stars │Reports │ Action  │
│ ─────────┼───────────┼───────────┼──────┼────────┼──────── │
│ Pitch A  │ Ali H.    │ "Great…"  │ ★★★★★│   3    │[Delete] │
│ Pitch B  │ Sara M.   │ "Awful…"  │ ★☆☆☆☆│   1    │[Delete] │
└──────────┴───────────┴───────────┴──────┴────────┴─────────┘
```

## Review delete flow
```tsx
// Click [Delete] → confirm modal:
// "Permanently delete this review? The author will be notified."
// Reason input (required)
// [Cancel] [Delete Review]
// On confirm: DELETE /admin/reviews/:id { reason }
// On success: row removed from list, toast shown
```

## Acceptance Criteria
**Disputes:**
- [ ] List filtered by status (default: OPEN)
- [ ] Detail panel shows booking + player + reason
- [ ] Outcome selector — one option required before submit
- [ ] Resolution notes required (≥ 10 chars)
- [ ] After resolution: status badge updates, panel closes

**Reviews:**
- [ ] Default sort: most-reported first
- [ ] "Min Reports" filter (1 / 2 / 3+)
- [ ] Delete confirm modal requires reason ≥ 10 chars
- [ ] After delete: row removed from table

## Edge Cases
- Dispute evidence image missing → image section hidden (not broken img)
- Review with 0 reports still listable (admin can proactively delete)
- Resolving already-resolved dispute → 409 from API → toast error

## Definition of Done
- [ ] Both pages created
- [ ] Dispute resolution flow end-to-end
- [ ] Review delete flow end-to-end
BODY

create_issue "$title" "$body" '["frontend","web","epic:e15","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E15-09 — Web: Admin overview dashboard + platform config page
# ─────────────────────────────────────────────────────────────────────────────
title="[E15-09] [Web] /admin — overview dashboard + /admin/config — platform configuration"
read -r -d '' body << 'BODY' || true
## Summary
Admin home page with platform-wide KPI cards and the config page for adjusting platform fee, maintenance mode, and other runtime settings.

## Reference
- PRD §14.5

## Files to create
- `apps/web/src/app/(admin)/admin/page.tsx`
- `apps/web/src/app/(admin)/admin/config/page.tsx`

## Admin overview page
```
┌──────────────────────────────────────────────────────────────┐
│ Platform Overview                     Last updated: just now  │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│ Total Users  │  Managers    │  Companies   │  Active Pitches │
│  12,450      │     342      │     189      │      412        │
├──────────────┴──────────────┴──────────────┴─────────────────┤
│ Total Bookings  │  Platform GMV    │  Open Disputes          │
│    4,821        │  £182,450.00     │     ⚠ 7 open            │
└─────────────────┴──────────────────┴─────────────────────────┘

// Below KPIs:
// - "Pending Approvals" shortcut card: X companies awaiting approval → link to /admin/companies?status=PENDING_APPROVAL
// - "Open Disputes" shortcut card: X disputes → link to /admin/disputes
// - "Last 30d GMV" bar vs total GMV progress indicator
```

## Open disputes warning
```tsx
// If openDisputes > 0: pulsing red indicator on nav item + warning card on overview
{openDisputes > 0 && (
  <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-3">
    <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
    <div>
      <p className="font-semibold text-red-800">{openDisputes} open dispute{openDisputes > 1 ? 's' : ''}</p>
      <Link href="/admin/disputes" className="text-sm text-red-600 underline">Resolve now →</Link>
    </div>
  </div>
)}
```

## Admin config page
```
┌──────────────────────────────────────────────────────┐
│ Platform Configuration                               │
├──────────────────────────────────────────────────────┤
│ Platform Fee                                         │
│ [  5  ] %   (0–20%)                                  │
│ Applied to all bookings. Current: 5%                 │
│                                                      │
│ Default No-Show Fee                                  │
│ £ [  0.00  ]   (max £100.00)                         │
│ Applied to new pitches. Existing pitches unaffected. │
│                                                      │
│ Maintenance Mode                                     │
│ [●  ] Off                                            │
│ When on, non-admin users see maintenance page.       │
│                                                      │
│ Maintenance Message                                  │
│ [____________________________________________]       │
│                                                      │
│                              [Save Configuration]   │
└──────────────────────────────────────────────────────┘
```

## Config page implementation
```typescript
// Load config: GET /admin/config
// Save: PUT /admin/config (only changed fields)
// Warning before enabling maintenance mode:
// Alert.confirm("Enable maintenance? All users (except admins) will see the maintenance page.")
// useForm (react-hook-form) with Zod schema validation
// Dirty tracking: "Save" button disabled when no changes
```

## Acceptance Criteria
**Overview:**
- [ ] All 8 KPI cards render with live data from `GET /admin/stats`
- [ ] Open disputes warning card shows when > 0
- [ ] Pending approvals shortcut card links correctly
- [ ] Auto-refreshes every 60s

**Config:**
- [ ] Loads current config on mount
- [ ] Fee field: numeric, 0–20 range enforced
- [ ] No-show fee: pence input displayed as £ (÷100)
- [ ] Maintenance toggle: confirm dialog before enabling
- [ ] Save button enabled only when form is dirty
- [ ] Success: toast "Configuration saved"

## Edge Cases
- GMV is 0 → `£0.00` (not null/undefined)
- Config save fails → toast error, form NOT reset (user can retry)
- Maintenance mode enabled + admin logs in → admin bypasses maintenance page

## Definition of Done
- [ ] Overview page with all KPIs
- [ ] Config page with all 4 settings
- [ ] Maintenance mode confirm dialog
- [ ] Auto-refresh on overview
BODY

create_issue "$title" "$body" '["frontend","web","epic:e15","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E15-10 — Cross-cutting: Seed script, ADMIN role bootstrap, E2E smoke tests
# ─────────────────────────────────────────────────────────────────────────────
title="[E15-10] [Backend + QA] DB seed script, ADMIN bootstrap, E2E smoke test suite"
read -r -d '' body << 'BODY' || true
## Summary
Three final cross-cutting concerns to close out the project:
1. `prisma/seed.ts` — comprehensive seed script for local dev and staging
2. Admin user bootstrap — CLI command to promote a user to ADMIN role
3. Playwright E2E smoke tests covering the golden paths across all roles

## Reference
- PRD §15 QA + Go-Live

## Files to create
- `prisma/seed.ts`
- `scripts/bootstrap-admin.ts`
- `apps/web/e2e/smoke.spec.ts`

## Seed script (prisma/seed.ts)
```typescript
// Creates:
// 1 ADMIN user (admin@pitchup.app / Admin1234!)
// 1 MANAGER user + approved company + 2 pitches (Pitch A 5-a-side, Pitch B 7-a-side)
// 5 PLAYER users (player1–5@pitchup.app / Player1234!)
// 10 bookings across various statuses (CONFIRMED, COMPLETED, CANCELLED, NO_SHOW)
// 5 reviews on pitches
// 2 disputes (1 OPEN, 1 UPHELD_FOR_PLAYER)
// Platform config (fee=5%, maintenance=false)

async function main() {
  await seedAdmin();
  await seedManager();
  await seedPlayers();
  await seedBookings();
  await seedReviews();
  await seedDisputes();
  await seedPlatformConfig();
  console.log('✓ Seed complete');
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

## package.json script
```json
{
  "scripts": {
    "db:seed": "ts-node prisma/seed.ts"
  }
}
```

## Admin bootstrap CLI
```typescript
// scripts/bootstrap-admin.ts
// Usage: npx ts-node scripts/bootstrap-admin.ts user@example.com
const email = process.argv[2];
if (!email) { console.error('Usage: bootstrap-admin <email>'); process.exit(1); }

const user = await prisma.user.update({
  where: { email },
  data:  { role: 'ADMIN' },
});
console.log(`✓ ${user.displayName} (${user.email}) is now ADMIN`);
```

## Playwright E2E smoke tests
```typescript
// apps/web/e2e/smoke.spec.ts
// Tests run against local dev server (playwright.config.ts baseURL: http://localhost:3000)

test.describe('Player golden path', () => {
  test('can register, discover pitches, and view booking flow', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Sign up' }).click();
    // ... register as player
    await page.goto('/discover');
    await expect(page.getByTestId('pitch-card')).toHaveCount({ min: 1 });
    await page.getByTestId('pitch-card').first().click();
    await expect(page.getByRole('heading', { name: /book/i })).toBeVisible();
  });
});

test.describe('Manager golden path', () => {
  test('can log in, view bookings, and access analytics', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name=email]',    'manager@pitchup.app');
    await page.fill('[name=password]', 'Manager1234!');
    await page.click('[type=submit]');
    await expect(page).toHaveURL(/\/manager/);
    await page.goto('/manager/bookings');
    await expect(page.getByRole('table')).toBeVisible();
    await page.goto('/manager/analytics');
    await expect(page.getByText('Revenue')).toBeVisible();
  });
});

test.describe('Admin golden path', () => {
  test('can log in and access admin panel', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name=email]',    'admin@pitchup.app');
    await page.fill('[name=password]', 'Admin1234!');
    await page.click('[type=submit]');
    await page.goto('/admin');
    await expect(page.getByText('Platform Overview')).toBeVisible();
    await page.goto('/admin/companies');
    await expect(page.getByRole('table')).toBeVisible();
  });
});

test.describe('Auth guards', () => {
  test('/admin redirects non-admin to /login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });
  test('/manager redirects player to /login', async ({ page }) => {
    // log in as player first
    await page.goto('/manager');
    await expect(page).toHaveURL(/\/login/);
  });
});
```

## playwright.config.ts
```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './apps/web/e2e',
  use: {
    baseURL:     'http://localhost:3000',
    screenshot:  'only-on-failure',
    video:       'retain-on-failure',
  },
  webServer: {
    command:    'pnpm --filter web dev',
    url:        'http://localhost:3000',
    reuseExistingServer: true,
  },
});
```

## Acceptance Criteria
- [ ] `pnpm db:seed` runs without error on fresh DB
- [ ] Seed creates all specified entities with correct relationships
- [ ] Bootstrap script promotes user to ADMIN role
- [ ] All 4 Playwright test suites pass on seeded local environment
- [ ] Auth guard tests: non-admin → redirected to /login

## Definition of Done
- [ ] `prisma/seed.ts` created and tested
- [ ] `scripts/bootstrap-admin.ts` created
- [ ] `apps/web/e2e/smoke.spec.ts` created
- [ ] `playwright.config.ts` created
- [ ] `pnpm test:e2e` runs all smoke tests green
BODY

create_issue "$title" "$body" '["backend","testing","epic:e15","type:feature"]' "$MILESTONE"

echo ""
echo "✓ E15 — Admin Panel (10 issues created)"
