#!/usr/bin/env bash
# e12.sh — create all E12 Penalty & Trust issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E12 — Penalty & Trust")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E12 — Penalty & Trust' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E12 — Penalty & Trust)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E12-01 — Backend: applyTrustEvent() engine
# ─────────────────────────────────────────────────────────────────────────────
title="[E12-01] [Backend] applyTrustEvent() trust score engine — full implementation"
read -r -d '' body << 'BODY' || true
## Summary
Implement the full `applyTrustEvent()` function that replaces the stub created in E11-04. Applies a delta to a user's trust score, clamps to [0, 100], and creates a `TrustScoreEvent` audit row atomically. This is the core trust engine used by no-show marking, dispute resolution, and positive events.

## Reference
- PRD §11.1 Trust Score Engine

## Files to create / modify
- `packages/shared/src/trust/engine.ts` — `deriveTier`, `meetsMinTier` (TRUST_SCORE_DELTAS and TRUST_TIERS already exist in `packages/shared/src/constants/trust.ts`)
- `apps/web/src/lib/trust/applyTrustEvent.ts` — server-side wrapper calling Prisma inside transaction
- Replace stub in `apps/web/src/lib/trust/stub.ts` with import of real function

## Trust Event Deltas
```typescript
// packages/shared/src/trust/engine.ts
// Canonical values live in packages/shared/src/constants/trust.ts as
// TRUST_SCORE_DELTAS. They are reproduced here for reference only — import
// them, do not redeclare them. Source: PRD §9.1.
export const TRUST_SCORE_DELTAS: Record<TrustScoreReason, number> = {
  BOOKING_COMPLETED:  +2,   // capped at +10 per calendar month
  REVIEW_LEFT:        +1,
  LATE_CANCEL:        -5,   // cancelled 2-24h before start
  VERY_LATE_CANCEL:  -10,   // cancelled < 2h before start
  NO_SHOW:           -20,
  DISPUTE_WON:       +10,
  MONTHLY_RECOVERY:   +1,
};

export type TrustScoreReason = keyof typeof TRUST_SCORE_DELTAS;
```

## Tier Config (already used by E08-02 stub — make canonical here)
```typescript
// Already implemented in packages/shared/src/constants/trust.ts as
// TRUST_TIERS. Import it rather than redeclaring. Source: PRD §9.1.
export type TrustTierLabel = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Suspended';

// TRUST_TIERS carries the booking restrictions per tier:
//   Excellent 90-100  no restrictions
//   Good      70-89   no restrictions
//   Fair      50-69   requires a card on file
//   Poor      30-49   requires 100% upfront, max 1 active booking
//   Suspended  0-29   cannot book

export function deriveTier(score: number): TrustTierLabel {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Suspended';
}
```

## applyTrustEvent (server-side, runs inside a Prisma transaction)
```typescript
// apps/web/src/lib/trust/applyTrustEvent.ts
import { TRUST_SCORE_DELTAS, TRUST_SCORE_MIN, TRUST_SCORE_MAX } from '@pitchup/shared'
import type { Prisma, TrustScoreReason } from '@prisma/client'

export async function applyTrustEvent(
  tx: Prisma.TransactionClient,
  userId: string,
  reason: TrustScoreReason,
  relatedBookingId?: string
) {
  const delta = TRUST_SCORE_DELTAS[reason]

  // Read and write in one statement so two concurrent events cannot both
  // read the same starting score and lose one of the deltas.
  const current = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { trustScore: true },
  })

  const newScore = Math.max(
    TRUST_SCORE_MIN,
    Math.min(TRUST_SCORE_MAX, current.trustScore + delta)
  )

  await tx.user.update({
    where: { id: userId },
    data: { trustScore: newScore },
  })

  // The event row records the delta that was requested, even when clamping
  // meant the score moved less — the history should show what happened.
  await tx.trustScoreEvent.create({
    data: { userId, delta, reason, relatedBookingId: relatedBookingId ?? null },
  })

  return { newScore, delta, tier: deriveTier(newScore) }
}
```

> The tier is **not** stored. `deriveTier(user.trustScore)` is called wherever
> it is displayed or enforced, so there is only one source of truth.

## Schema — already in place, no additions needed

E01-02 shipped these. Do not add a `trustTier` column: the tier is derived
from the score with `deriveTier()`, so storing it as well creates two sources
of truth that can disagree after a manual score adjustment.

```prisma
model User {
  trustScore       Int               @default(100)   // PRD §9.1
  trustScoreEvents TrustScoreEvent[]
}

model TrustScoreEvent {
  id               String           @id @default(cuid())
  userId           String
  delta            Int
  reason           TrustScoreReason
  relatedBookingId String?
  createdAt        DateTime         @default(now())

  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  relatedBooking Booking? @relation(fields: [relatedBookingId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
}

enum TrustScoreReason {
  BOOKING_COMPLETED
  REVIEW_LEFT
  LATE_CANCEL
  VERY_LATE_CANCEL
  NO_SHOW
  DISPUTE_WON
  MONTHLY_RECOVERY
}
```

## Replace E11 stub
```typescript
// apps/web/src/lib/trust/stub.ts  →  delete this file
// apps/web/src/app/api/v1/manager/bookings/[bookingId]/no-show/route.ts
// Replace: import { applyTrustEventStub } from '@/lib/trust/stub'
// With:    import { applyTrustEvent }     from '@/lib/trust/applyTrustEvent'
// And call applyTrustEvent(tx, booking.playerId, 'NO_SHOW', booking.id)
```

## Acceptance Criteria
- [ ] `TRUST_EVENTS` map exported from `packages/shared`
- [ ] `deriveTier` and `TIER_CONFIG` exported from `packages/shared`
- [ ] Score clamped to [0, 100] — never goes negative or above 100. PRD §9.1
- [ ] `TrustScoreEvent` row created for every call, inside the same transaction as the score update
- [ ] Stub in E11-04 deleted and replaced with real function
- [ ] No migration needed — `trustScore` and `TrustScoreEvent` shipped in E01-02

## Unit Tests
```typescript
describe('applyTrustEvent', () => {
  it('applies NO_SHOW delta -10');
  it('clamps score at 0 — no negative');
  it('clamps score at 100 — no overflow');
  it('deriveTier reflects the new score after crossing a boundary');
  it('creates a TrustScoreEvent row');
});

describe('deriveTier', () => {
  it('Suspended for score 0');
  it('Suspended for score 29');
  it('Poor for score 30');
  it('Fair for score 50');
  it('Good for score 70');
  it('Excellent for score 90');
  it('Excellent for score 100');
});
```

## Definition of Done
- [ ] Engine implemented in packages/shared
- [ ] Server-side wrapper created
- [ ] Stub deleted
- [ ] Prisma migration applied
- [ ] All unit tests pass
BODY

create_issue "$title" "$body" '["backend","shared","epic:e12","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E12-02 — Backend: BOOKING_COMPLETED trust event on auto-complete + manual complete
# ─────────────────────────────────────────────────────────────────────────────
title="[E12-02] [Backend] Apply BOOKING_COMPLETED trust event on booking completion"
read -r -d '' body << 'BODY' || true
## Summary
Wire `applyTrustEvent(tx, playerId, 'BOOKING_COMPLETED', bookingId)` into two places: the manual complete endpoint (E11-05) and the nightly auto-complete cron (E11-10). Ensures every completed booking awards +2 trust points to the player.

## Reference
- PRD §11.2 Positive Trust Events
- E12-01 (applyTrustEvent engine)
- E11-05 (manual complete endpoint)
- E11-10 (auto-complete cron)

## Files to modify
- `apps/web/src/app/api/v1/manager/bookings/[bookingId]/complete/route.ts`
- `apps/web/src/app/api/v1/cron/auto-complete/route.ts`

## Manual complete modification
```typescript
// In POST /manager/bookings/:id/complete
await prisma.$transaction(async (tx) => {
  await tx.booking.update({
    where: { id: booking.id },
    data:  { status: 'COMPLETED' },
  });
  await tx.bookingStatusEvent.create({
    data: { bookingId: booking.id, status: 'COMPLETED', actorId: manager.id },
  });
  await applyTrustEvent(tx, booking.playerId, 'BOOKING_COMPLETED', booking.id);
});
```

## Auto-complete cron modification
The cron currently uses `updateMany` (no per-row callback). Change to batch-process individually in chunks to apply trust events:

```typescript
// apps/web/src/app/api/v1/cron/auto-complete/route.ts
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date();
  const eligible = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', endTime: { lt: cutoff } },
    select: { id: true, playerId: true },
    take: 500,  // cap per run to avoid timeout
  });

  let completed = 0;
  for (const b of eligible) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.booking.update({ where: { id: b.id }, data: { status: 'COMPLETED' } });
        await applyTrustEvent(tx, b.playerId, 'BOOKING_COMPLETED', b.id);
      });
      completed++;
    } catch (err) {
      console.error('[auto-complete] failed for booking', b.id, err);
    }
  }

  console.log(`[auto-complete] completed ${completed}/${eligible.length} bookings`);
  return NextResponse.json({ completed, total: eligible.length });
}
```

## Cap reasoning
- Vercel Cron function timeout: 60s
- Per-booking tx: ~10ms → 500 bookings ≈ 5s safe buffer
- If >500 pending: next night's cron catches remainder

## Acceptance Criteria
- [ ] Manual complete applies `BOOKING_COMPLETED` trust event inside same transaction
- [ ] Auto-complete cron processes bookings individually (not `updateMany`)
- [ ] Each completion creates `TrustScoreEvent` row with `delta: +2`
- [ ] Cron caps at 500 per run
- [ ] Single booking failure doesn't abort other completions

## Edge Cases
- `applyTrustEvent` throws → tx rolls back → booking stays CONFIRMED → next cron retry
- Player deleted → skip (catch error, log, continue)
- Score already at 100 → clamp → TrustScoreEvent still created with delta +2 but effective change 0

## Definition of Done
- [ ] Both files modified
- [ ] Integration test: complete booking → trustScore increases by 2
- [ ] Cron batch test: 10 eligible bookings → 10 TrustScoreEvent rows
BODY

create_issue "$title" "$body" '["backend","epic:e12","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E12-03 — Backend: late-cancellation trust events on cancel
# ─────────────────────────────────────────────────────────────────────────────
title="[E12-03] [Backend] Apply late-cancellation trust events on player cancel"
read -r -d '' body << 'BODY' || true
## Summary
Wire the trust penalty into the cancellation endpoint (E06-03), alongside the refund calculation.

PRD §9.1 distinguishes two windows, which map to the two reasons already in the `TrustScoreReason` enum:

| Cancelled | Reason | Delta | Refund |
|---|---|---|---|
| > 24h before | none | 0 | 100% |
| 2-24h before | `LATE_CANCEL` | -5 | 50% |
| < 2h before | `VERY_LATE_CANCEL` | -10 | 0% |

The refund side already exists as `calcRefundAmount` in `packages/shared`; this ticket adds the trust side on the same boundaries.

## Reference
- PRD §11.3 Late Cancellation Penalty
- E06-03 (POST /bookings/:id/cancel — already built)
- E12-01 (applyTrustEvent engine)

## File to modify
`apps/web/src/app/api/v1/bookings/[bookingId]/cancel/route.ts`

## Implementation
```typescript
// In the cancel transaction, after refund calc:
await prisma.$transaction(async (tx) => {
  await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
  await tx.bookingStatusEvent.create({
    data: { bookingId: booking.id, status: 'CANCELLED', actorId: user.id },
  });

  const hoursUntilStart = differenceInHours(booking.startTime, new Date());
  if (hoursUntilStart < 2) {
    const hoursUntilStart =
      (booking.startTime.getTime() - Date.now()) / 3_600_000
    if (hoursUntilStart < 2) {
      await applyTrustEvent(tx, user.id, 'VERY_LATE_CANCEL', booking.id)
    } else if (hoursUntilStart < 24) {
      await applyTrustEvent(tx, user.id, 'LATE_CANCEL', booking.id)
    }
  }

  // existing refund logic...
  await processRefund(tx, booking, refundAmount);
});
```

## Business Rule
- `2-24h` before start → `LATE_CANCEL` (-5); `< 2h` → `VERY_LATE_CANCEL` (-10); `> 24h` → no penalty
- `≥ 2h` before start → no trust penalty
- Penalty applied even when refund is 0% (the trust deduction is independent of refund tier)
- Only applies to player-initiated cancellation (not manager/admin cancellations)

## Acceptance Criteria
- [ ] Cancel < 2h → TrustScoreEvent row with `reason: 'VERY_LATE_CANCEL', delta: -10`
- [ ] Cancel 2-24h → TrustScoreEvent row with `reason: 'LATE_CANCEL', delta: -5`
- [ ] Cancel > 24h → no TrustScoreEvent created. PRD §9.1
- [ ] Trust deduction inside same transaction as cancellation
- [ ] Manager-initiated cancellation does NOT apply penalty (check `actorId === booking.playerId`)

## Edge Cases
- Player cancels at exactly 2h boundary → no penalty (boundary is exclusive `< 2h`)
- Trust penalty + refund both succeed atomically
- If trust event fails → entire tx rolls back → booking stays CONFIRMED

## Unit Tests
```typescript
it('applies VERY_LATE_CANCEL when < 2h before start');
it('applies LATE_CANCEL when 2-24h before start');
it('applies no trust event when > 24h before start');
it('does NOT apply penalty when exactly 2h before start');
it('does NOT apply penalty when > 2h before start');
it('does NOT apply penalty when manager cancels');
```

## Definition of Done
- [ ] Cancel route modified
- [ ] Unit tests pass for all 4 cases
BODY

create_issue "$title" "$body" '["backend","epic:e12","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E12-04 — Backend: Dispute resolution trust events + PUT /bookings/:id/dispute
# ─────────────────────────────────────────────────────────────────────────────
title="[E12-04] [Backend] Dispute resolution: admin resolution endpoint + trust events"
read -r -d '' body << 'BODY' || true
## Summary
Complete the dispute flow. E06-04 created `POST /bookings/:id/dispute` (player opens dispute). This ticket adds:
1. `GET /admin/disputes` — list open disputes for admin panel (E15 uses this)
2. `PUT /admin/disputes/:id/resolve` — admin resolves dispute, applies trust events to both parties
3. Trust events on resolution

PRD §9.1 defines one dispute outcome: **"Successful dispute of false no-show: +10 (restored)"** — `DISPUTE_WON`.

A player who wins gets `DISPUTE_WON` (+10), which offsets the -20 the
disputed no-show cost them. A player who loses keeps the no-show penalty
already applied; there is no second penalty for having disputed, or players
would be discouraged from disputing a genuine error.

> **Open question — not covered by the PRD.** This ticket originally
> penalised the *manager* when a player won. Managers have no trust score in
> the PRD or the schema: `trustScore` exists on `User`, but no tier rule,
> display, or booking gate applies to a manager. Decide before implementing:
> drop manager penalties, or add a separate manager-reliability metric as its
> own ticket. Do not silently reuse the player trust score for this.

## Reference
- PRD §11.4 Dispute Resolution
- E06-04 (dispute creation)
- E12-01 (applyTrustEvent)

## Files to create
- `apps/web/src/app/api/v1/admin/disputes/route.ts` — GET
- `apps/web/src/app/api/v1/admin/disputes/[disputeId]/resolve/route.ts` — PUT

## Dispute Model (add to existing Booking-adjacent models)
```prisma
model Dispute {
  id          String        @id @default(cuid())
  bookingId   String        @unique
  playerId    String
  reason      String
  evidence    String?       // optional Cloudinary URL
  status      DisputeStatus @default(OPEN)
  resolution  String?       // admin notes
  resolvedById String?
  createdAt   DateTime      @default(now())
  resolvedAt  DateTime?
  booking     Booking       @relation(fields: [bookingId], references: [id])
  player      User          @relation("PlayerDisputes", fields: [playerId], references: [id])
  resolvedBy  User?         @relation("AdminResolutions", fields: [resolvedById], references: [id])
}

enum DisputeStatus {
  OPEN
  UPHELD_FOR_PLAYER   // player wins → refund, manager penalised
  UPHELD_FOR_MANAGER  // manager wins → player penalised
  DISMISSED           // no penalty for either
}
```

## Resolution endpoint
```typescript
// PUT /admin/disputes/:id/resolve
export const ResolveDisputeSchema = z.object({
  outcome:    z.enum(['UPHELD_FOR_PLAYER', 'UPHELD_FOR_MANAGER', 'DISMISSED']),
  resolution: z.string().min(10).max(500),
});

export async function PUT(req, { params }) {
  const admin = await requireRole(req, 'ADMIN');
  const { outcome, resolution } = ResolveDisputeSchema.parse(await req.json());

  const dispute = await prisma.dispute.findUniqueOrThrow({
    where: { id: params.disputeId },
    include: {
      booking: {
        include: { pitch: { include: { company: true } } }
      }
    },
  });

  if (dispute.status !== 'OPEN') {
    return NextResponse.json({ error: 'Dispute already resolved' }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.dispute.update({
      where: { id: dispute.id },
      data:  { status: outcome, resolution, resolvedById: admin.id, resolvedAt: new Date() },
    });

    if (outcome === 'RESOLVED_PLAYER') {
      // Player wins: restore the trust the no-show cost them, and refund.
      await applyTrustEvent(tx, dispute.playerId, 'DISPUTE_WON', dispute.bookingId)
      await issueDisputeRefund(tx, dispute.booking)
    }
    // RESOLVED_MANAGER: the no-show penalty already applied stands. No
    // further penalty — see the open question above on manager reliability.
  });

  return NextResponse.json({ success: true });
}
```

## Acceptance Criteria
- [ ] `UPHELD_FOR_PLAYER` → player gets +5, manager gets -15, refund issued
- [ ] `UPHELD_FOR_MANAGER` → player gets -15, no manager event
- [ ] `DISMISSED` → no trust events
- [ ] Already-resolved dispute → 409
- [ ] Only ADMIN role can resolve
- [ ] `GET /admin/disputes` returns paginated OPEN disputes with booking + player details

## Edge Cases
- User has no trust score events yet → `applyTrustEvent` starts from TRUST_SCORE_INITIAL (100)
- Refund already issued → `issueDisputeRefund` checks idempotency key
- Booking already CANCELLED → dispute resolution still applies trust events

## Definition of Done
- [ ] Both admin routes created
- [ ] Dispute model migration
- [ ] All 3 outcomes apply correct trust events
- [ ] Integration test for each outcome
BODY

create_issue "$title" "$body" '["backend","epic:e12","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E12-05 — Backend: Monthly trust score recalculation cron
# ─────────────────────────────────────────────────────────────────────────────
title="[E12-05] [Backend] Monthly trust score recalculation cron + REVIEW_LEFT event"
read -r -d '' body << 'BODY' || true
## Summary
Two trust engine additions:
1. Wire `REVIEW_LEFT` (+1) trust event when player submits a review (E06-05)
2. Monthly cron that recalculates every active user's trust score from scratch using their full `TrustScoreEvent` history, correcting any drift from race conditions

## Reference
- PRD §11.5 Monthly Recalculation
- E06-05 (POST /reviews — where REVIEW_LEFT hooks in)
- E12-01 (TRUST_EVENTS map)

## Files to create / modify
- `apps/web/src/app/api/v1/reviews/route.ts` — modify to add trust event
- `apps/web/src/app/api/v1/cron/trust-recalc/route.ts` — new cron endpoint

## REVIEW_LEFT hook in POST /reviews
```typescript
// In POST /reviews transaction (E06-05 route):
await prisma.$transaction(async (tx) => {
  // existing: create review
  await tx.review.create({ data: reviewData });
  // add:
  await applyTrustEvent(tx, player.id, 'REVIEW_LEFT', booking.id);
});
```

## Monthly recalc cron
```typescript
// apps/web/src/app/api/v1/cron/trust-recalc/route.ts
// Runs 1st of each month at 03:00 UTC via vercel.json

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where:  { deletedAt: null },
    select: { id: true },
  });

  let updated = 0;
  for (const user of users) {
    try {
      const events = await prisma.trustScoreEvent.findMany({
        where:   { userId: user.id },
        select:  { delta: true },
      });

      // Replaying every event from the initial score, rather than trusting
      // the running total, repairs any drift from a failed partial write.
      const total = events.reduce((sum, e) => sum + e.delta, TRUST_SCORE_INITIAL);
      const score = Math.max(TRUST_SCORE_MIN, Math.min(TRUST_SCORE_MAX, total));

      await prisma.user.update({
        where: { id: user.id },
        data:  { trustScore: score },
      });
      updated++;
    } catch (err) {
      console.error('[trust-recalc] failed for user', user.id, err);
    }
  }

  return NextResponse.json({ updated, total: users.length });
}
```

## vercel.json addition
```json
{ "path": "/api/v1/cron/trust-recalc", "schedule": "0 3 1 * *" }
```

## Acceptance Criteria
- [ ] `POST /reviews` (player) applies `REVIEW_LEFT` +1 inside same transaction
- [ ] Review by manager (reply) does NOT trigger REVIEW_LEFT
- [ ] Monthly cron recalculates score = 100 + sum(all TrustScoreEvent deltas), clamped [0,100]
- [ ] MONTHLY_RECOVERY of +1 applied for a month with no negative events. PRD §9.1
- [ ] Cron rejects requests without `CRON_SECRET`
- [ ] User failures don't abort other users

## Edge Cases
- User with no TrustScoreEvents → score stays at 100 (initial), tier Excellent
- User with only negative events pushing below 0 → clamped to 0, tier Suspended
- Positive events cannot push above 100 — clamped. PRD §9.1
- Duplicate review attempt (unique constraint) → review tx fails → no trust event applied

## Definition of Done
- [ ] Review route modified
- [ ] Recalc cron created
- [ ] `vercel.json` updated
- [ ] Unit test: 100 + (-20) + (+1) + (+2) = 83, tier Good
BODY

create_issue "$title" "$body" '["backend","epic:e12","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E12-06 — Backend: Trust tier booking gate
# ─────────────────────────────────────────────────────────────────────────────
title="[E12-06] [Backend] Trust tier booking gate"
read -r -d '' body << 'BODY' || true
## Summary
Pitches can require a minimum trust score to book (`pitch.minTrustScore`). The gate is enforced in `POST /bookings` (E05-07).

Two PRD-mandated gates apply regardless of any per-pitch minimum (PRD §9.1):
- **Suspended** (score < 30) cannot book at all.
- **Poor** (30-49) may hold at most one active booking and must pay 100% upfront.

> **Dropped from this ticket.** It previously added a `PROFILE_VERIFIED`
> (+10) event. That is not in PRD §9.1 and not in the `TrustScoreReason`
> enum. It is also a weak signal — setting an avatar says nothing about
> whether someone turns up — and +10 is half the cost of a no-show, so it
> would let a player offset bad behaviour by filling in a profile field. If
> it is wanted, it needs its own ticket, a PRD change, and a migration to add
> the enum value.

## Reference
- PRD §11.6 Trust Gating

## Files to modify
- `apps/web/src/app/api/v1/bookings/route.ts` — add tier gate
- `packages/shared/src/trust/engine.ts` — add `meetsMinTier()` helper

## Schema addition
```prisma
model Pitch {
  minTrustScore Int @default(0)   // 0 = open to anyone who can book at all
}
```

## Tier ordering for gate
```typescript
// packages/shared/src/trust/engine.ts
const TIER_ORDER: Record<TrustTier, number> = {
  Suspended: 0,
  Poor:      1,
  Fair:      2,
  Good:      3,
  Excellent: 4,
};

export function meetsMinTier(userTier: TrustTier, minTier: TrustTier): boolean {
  return TIER_ORDER[userTier] >= TIER_ORDER[minTier];
}
```

## Booking gate (POST /bookings)
```typescript
// After auth, before conflict check:
const pitch = await prisma.pitch.findUniqueOrThrow({ where: { id: body.pitchId } });
if (!meetsMinTier(deriveTier(player.trustScore), pitch.minTrustScore)) {
  return NextResponse.json(
    {
      error:    'Trust tier too low',
      required: deriveTier(pitch.minTrustScore),
      current:  deriveTier(player.trustScore),
    },
    { status: 403 }
  );
}
```

## Error response shape (for mobile toast)
```typescript
// 403 from booking gate
{
  "error":    "Trust tier too low",
  "required": "Good",
  "current":  "Fair",
  "code":     "TRUST_TIER_INSUFFICIENT"
}
```

## Acceptance Criteria
- [ ] Pitch with no minimum → any user who is not Suspended can book
- [ ] Pitch requiring Good → a Fair user → 403 with `code: TRUST_TIER_INSUFFICIENT`
- [ ] Pitch requiring Good → a Good user → proceeds to conflict check
- [ ] A Suspended user is refused everywhere, regardless of the pitch minimum
- [ ] `meetsMinTier` exported from `packages/shared`

## Edge Cases
- Player tier changes between request and check → gate uses current tier at request time
- Avatar removed after verification → score stays (events are never reversed)

## Definition of Done
- [ ] Gate added to booking route with correct 403 shape
- [ ] `meetsMinTier` in packages/shared with unit tests
- [ ] Prisma migration adding `minTrustScore Int @default(0)` to Pitch
BODY

create_issue "$title" "$body" '["backend","shared","epic:e12","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E12-07 — Mobile: Trust score detail screen — full event history
# ─────────────────────────────────────────────────────────────────────────────
title="[E12-07] [Mobile] Trust score detail — full event history screen"
read -r -d '' body << 'BODY' || true
## Summary
Extend the Trust Score Detail screen (E08-05 stub) with full event history list. Shows all `TrustScoreEvent` rows for the player with icon, label, delta badge, and date. Replaces the placeholder "coming soon" state.

## Reference
- PRD §11.7 Player Trust History
- E08-05 (TrustScoreDetailScreen — modify)

## Files to modify / create
- `apps/mobile/src/screens/player/TrustScoreDetailScreen.tsx` — add event list
- `apps/web/src/app/api/v1/profile/trust-history/route.ts` — new endpoint
- `apps/mobile/src/components/trust/TrustEventRow.tsx` — event list item

## New endpoint: GET /profile/trust-history
```typescript
// apps/web/src/app/api/v1/profile/trust-history/route.ts
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  const { cursor, limit = 20 } = TrustHistoryQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const events = await prisma.trustScoreEvent.findMany({
    where:   { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take:    Number(limit) + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: { booking: { select: { id: true, startTime: true } } },
  });

  const hasMore = events.length > Number(limit);
  if (hasMore) events.pop();

  return NextResponse.json({
    data:       events,
    nextCursor: hasMore ? events.at(-1)!.id : null,
  });
}
```

## TrustEventRow component
```typescript
const EVENT_META: Record<TrustEventType, { icon: string; label: string; color: string }> = {
  NO_SHOW:                    { icon: '🚫', label: 'No-show',                color: '#EF4444' },
  LATE_CANCEL:                { icon: '⏰', label: 'Late cancellation',       color: '#F97316' },
  VERY_LATE_CANCEL:           { icon: '⏰', label: 'Very late cancellation',  color: '#F97316' },
  BOOKING_COMPLETED:          { icon: '✅', label: 'Booking completed',        color: '#16A34A' },
  REVIEW_LEFT:                { icon: '⭐', label: 'Review submitted',         color: '#16A34A' },
  DISPUTE_WON:                { icon: '⚖️', label: 'Dispute resolved in your favour', color: '#16A34A' },
};

export function TrustEventRow({ event }: { event: TrustScoreEvent }) {
  const meta = EVENT_META[event.event as TrustEventType];
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{meta.icon}</Text>
      <View style={styles.info}>
        <Text style={styles.label}>{meta.label}</Text>
        <Text style={styles.date}>{formatDate(event.createdAt)}</Text>
      </View>
      <Text style={[styles.delta, { color: meta.color }]}>
        {event.delta > 0 ? `+${event.delta}` : event.delta}
      </Text>
    </View>
  );
}
```

## Screen layout (extends E08-05)
```
┌────────────────────────────┐
│ ← Trust Score              │
│ ┌────────────────────────┐ │
│ │  [SVG ring 120px]      │ │
│ │   83   Good             │ │
│ └────────────────────────┘ │
│ ┌──┬──┬──┬──┐             │
│ │Br│Si│Go│Pl│  tier table │
│ └──┴──┴──┴──┘             │
│ EVENT HISTORY              │
│ ✅ Booking completed  +2   │
│    Mon 11 Aug              │
│ ⏰ Late cancellation  -5   │
│    Sat 8 Aug               │
│ ✅ Booking completed  +2   │
│    ...                     │
│ [Load more]                │
└────────────────────────────┘
```

## Acceptance Criteria
- [ ] Event list loads from `GET /profile/trust-history`
- [ ] Cursor pagination with "Load more" button
- [ ] Each event row: icon, label, date, delta (+ green / - red)
- [ ] Empty state: "No trust events yet. Complete your first booking!"
- [ ] `TrustEventRow` handles all 7 event types with correct icon/label/colour

## Edge Cases
- Unknown event type → fallback label "Trust event", neutral colour
- Event with no linked booking → date shown as event createdAt only

## Definition of Done
- [ ] Endpoint created
- [ ] `TrustEventRow` handles all event types
- [ ] Screen updated (E08-05 "coming soon" removed)
- [ ] Infinite scroll working
BODY

create_issue "$title" "$body" '["mobile","backend","epic:e12","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E12-08 — Web: Trust score history + tier gate error on booking
# ─────────────────────────────────────────────────────────────────────────────
title="[E12-08] [Web] Trust history on /profile + tier gate error in booking flow"
read -r -d '' body << 'BODY' || true
## Summary
Two web-side trust features:
1. Trust event history section on `/profile/trust-score` web page (E08-08)
2. Handle `TRUST_TIER_INSUFFICIENT` 403 error in the booking flow (Step 1 date picker / pitch detail) with a clear trust gate message

## Reference
- PRD §11.6–11.7
- E08-08 (web profile trust-score page — modify)
- E05-10 (web booking flow — modify Step 1 / pitch detail page)

## Files to modify
- `apps/web/src/app/(player)/profile/trust-score/page.tsx`
- `apps/web/src/app/(player)/book/[pitchId]/date/page.tsx` (or pitch detail page that initiates booking)

## Trust history section (web)
```tsx
// Append to /profile/trust-score page
// Reuse GET /profile/trust-history endpoint
// Render as table:
// | Date | Event | Delta |
// | Mon 11 Aug | Booking completed | +2 |
// | Sat 8 Aug  | Late cancellation | -5 |
// Pagination: "Load more" button (cursor)
// Max visible without loading: 10 rows
```

## Trust gate error handling in booking flow
When `POST /bookings` returns 403 with `code: TRUST_TIER_INSUFFICIENT`:
```tsx
// apps/web/src/app/(player)/book/[pitchId]/date/page.tsx
// OR in the booking confirmation step (Step 4)

{trustGateError && (
  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
    <div className="flex items-center gap-2">
      <ShieldExclamationIcon className="h-5 w-5 text-amber-600" />
      <span className="font-semibold text-amber-900">Trust tier required</span>
    </div>
    <p className="mt-1 text-sm text-amber-800">
      This pitch requires <strong>{trustGateError.required}</strong> tier or above.
      Your current tier is <strong>{trustGateError.current}</strong>.
    </p>
    <Link href="/profile/trust-score" className="mt-2 text-sm text-amber-700 underline">
      View your trust score →
    </Link>
  </div>
)}
```

## Acceptance Criteria
- [ ] `/profile/trust-score` shows event history table with pagination
- [ ] Table shows all 7 event types with correct label
- [ ] Booking flow shows trust gate error panel when 403 received
- [ ] Error panel links to `/profile/trust-score`
- [ ] Error panel shows both required and current tier

## Edge Cases
- Trust history empty → "No events yet" row in table
- Trust gate fires on Step 4 (summary) → clear error replaces generic "Something went wrong"
- Player upgrades tier in another tab → can retry without refreshing full page

## Definition of Done
- [ ] Trust history table on profile page
- [ ] Booking trust gate error UI implemented
- [ ] Both tested with mock data covering all 7 event types
BODY

create_issue "$title" "$body" '["frontend","web","epic:e12","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E12-09 — Web: Manager trust gate config on pitch editor
# ─────────────────────────────────────────────────────────────────────────────
title="[E12-09] [Web] Manager pitch editor — minimum trust tier configuration"
read -r -d '' body << 'BODY' || true
## Summary
Add a "Minimum trust tier" selector to the pitch editor (E10-07 Basic Info tab), letting managers restrict a pitch to players above a given tier. The selector shows tier names; it writes the tier's lower bound to `pitch.minTrustScore` via `PUT /pitches/:id`, so the stored value stays a score and the tier stays derived.

## Reference
- PRD §11.6 Trust Gating (manager side)
- E10-07 (pitch editor Basic Info tab — modify)

## File to modify
`apps/web/src/app/(manager)/manager/pitches/[id]/edit/tabs/BasicInfoTab.tsx`

## UI addition to Basic Info tab
```tsx
// Below pitch size / surface type fields:
<div>
  <label className="block text-sm font-medium text-gray-700">
    Minimum Trust Tier
  </label>
  <p className="text-xs text-gray-500 mb-2">
    Players below this tier cannot book this pitch.
  </p>
  <div className="flex gap-2">
    {(['Poor', 'Fair', 'Good', 'Excellent'] as const).map((tier) => (
      <button
        key={tier}
        type="button"
        onClick={() => setMinTrustTier(tier)}
        className={cn(
          'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
          deriveTier(minTrustScore) === tier
            ? TIER_SELECTED_COLORS[tier]
            : 'border-gray-200 text-gray-600 hover:border-gray-400'
        )}
      >
        {tier.charAt(0) + tier.slice(1).toLowerCase()}
      </button>
    ))}
  </div>
</div>
```

## TIER_SELECTED_COLORS
```typescript
const TIER_SELECTED_COLORS: Record<TrustTier, string> = {
  Suspended: 'border-red-600    bg-red-600    text-white',
  Poor:      'border-amber-700  bg-amber-700  text-white',
  Fair:      'border-gray-400   bg-gray-400   text-white',
  Good:      'border-primary-600 bg-primary-600 text-white',
  Excellent: 'border-cyan-600   bg-cyan-600   text-white',
};
```

## Pitch list display
In the pitch list table (E10-06), add a "Min. Tier" column:
- Shows coloured tier badge
- No minimum shows "–" (open to all) to reduce visual noise

## API integration
- Included in existing `PUT /pitches/:id` body as `minTrustScore` field
- `PUT /pitches/:id` already handles unknown fields via Zod — add `minTrustScore` to `UpdatePitchSchema`:
```typescript
minTrustScore: z.number().int().min(0).max(100).optional()
```

## Acceptance Criteria
- [ ] 4-button tier selector renders in Basic Info tab
- [ ] Selected tier highlighted with correct colour
- [ ] Value persists on save (PUT /pitches/:id)
- [ ] Pitch list shows "Min. Tier" column with badge
- [ ] Pitch with minTrustScore 0 shows "–" in list (open to all)

## Edge Cases
- Manager sets a minimum of 90 (Excellent) → most players blocked → show warning tooltip: "Very few players qualify"
- Default for new pitches: 0 (open to anyone who is not Suspended)

## Definition of Done
- [ ] Tier selector added to pitch editor
- [ ] `UpdatePitchSchema` updated to include `minTrustScore`
- [ ] Pitch list column added
- [ ] High-minimum (90+) warning tooltip shown
BODY

create_issue "$title" "$body" '["frontend","web","epic:e12","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E12-10 — Shared: Trust engine unit tests + packages/shared exports audit
# ─────────────────────────────────────────────────────────────────────────────
title="[E12-10] [Shared] Trust engine unit tests + packages/shared export audit"
read -r -d '' body << 'BODY' || true
## Summary
Comprehensive unit test suite for the full trust engine in `packages/shared` plus an audit/cleanup of all `packages/shared` exports to ensure every utility used across E05–E12 is correctly exported, typed, and tree-shakeable.

## Reference
- PRD §11 (Trust system)
- All previous epics contributing to packages/shared

## Files to create / modify
- `packages/shared/src/trust/engine.test.ts`
- `packages/shared/src/index.ts` — full export audit
- `packages/shared/src/utils/pricing.test.ts` — ensure exists (E11-10)
- `packages/shared/src/utils/slots.test.ts` — ensure exists (E11-10)

## Trust engine tests (packages/shared/src/trust/engine.test.ts)
```typescript
describe('TRUST_EVENTS', () => {
  it('NO_SHOW is -10');
  it('LATE_CANCEL is -5');
  it('VERY_LATE_CANCEL is -10');
  it('DISPUTE_WON is +10');
  it('BOOKING_COMPLETED is +2');
  it('REVIEW_LEFT is +1');
  it('MONTHLY_RECOVERY is +1');
  it('BOOKING_COMPLETED is +2');
});

describe('deriveTier', () => {
  it.each([
    [0,    'Suspended'],
    [29,   'Suspended'],
    [30,   'Poor'],
    [49,   'Poor'],
    [50,   'Fair'],
    [69,   'Fair'],
    [70,   'Good'],
    [89,   'Good'],
    [90,   'Excellent'],
    [100,  'Excellent'],
  ])('score %i → %s', (score, expected) => {
    expect(deriveTier(score)).toBe(expected);
  });
});

describe('meetsMinTier', () => {
  it('Suspended meets a minimum of 0');
  it('Fair meets a minimum of 0');
  it('Good meets a minimum of 50');
  it('Excellent meets a minimum of 90');
  it('Poor does not meet a minimum of 50');
  it('Fair does not meet a minimum of 70');
  it('Good does not meet a minimum of 90');
});
```

## packages/shared export audit
Confirm all of the following are exported from `packages/shared/src/index.ts`:

```typescript
// Trust
export { TRUST_EVENTS, TIER_CONFIG, deriveTier, meetsMinTier } from './trust/engine';
export type { TrustTier, TrustEventType } from './trust/engine';

// Pricing
export { calcPrice }    from './utils/pricing';
export type { PricingConfig } from './utils/pricing';

// Slots
export { generateSlots, isWithinNoShowWindow } from './utils/slots';
export type { TimeSlot } from './utils/slots';

// Refund
export { calcRefundAmount } from './utils/refund';  // E06-03

// Schemas (Zod)
export { BookingListQuerySchema }  from './schemas/manager';
export { CompanyInfoSchema }       from './schemas/onboarding';
```

## package.json check
Ensure `packages/shared/package.json` has:
```json
{
  "exports": {
    ".": {
      "types":   "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"]
}
```

## Acceptance Criteria
- [ ] All trust engine tests pass (`pnpm --filter @pitchup/shared test`)
- [ ] `deriveTier` boundary tests cover all tier transitions
- [ ] `meetsMinTier` tests cover all 7 combinations
- [ ] All exports listed above present in `packages/shared/src/index.ts`
- [ ] `calcRefundAmount` tests from E06-03 still pass (regression)
- [ ] `pnpm build` in `packages/shared` produces `dist/` without errors

## Edge Cases
- Missing export discovered during audit → add it and add a test
- Duplicate export (re-exported from two files) → consolidate

## Definition of Done
- [ ] Test file created with all cases
- [ ] All tests green
- [ ] Export audit complete — no missing exports
- [ ] `packages/shared` builds cleanly
BODY

create_issue "$title" "$body" '["shared","epic:e12","type:testing"]' "$MILESTONE"

echo ""
echo "✓ E12 — Penalty & Trust (10 issues created)"
