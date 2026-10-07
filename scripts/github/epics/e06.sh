#!/usr/bin/env bash
# e06.sh — create all E06 Player: My Bookings issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E06 — Player: My Bookings")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E06 — Player: My Bookings' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E06 — Player: My Bookings)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E06-01 — Backend: GET /bookings — list player bookings
# ─────────────────────────────────────────────────────────────────────────────
title="[E06-01] [Backend] GET /bookings — list player bookings (tab filters, cursor pagination)"
read -r -d '' body << 'BODY' || true
## Summary
Implement `GET /api/v1/bookings` returning the authenticated player's bookings. Supports `tab` query param for Upcoming / Past / Cancelled views. Cursor-paginated. Returns enough data for booking cards without a separate detail fetch.

## Reference
- PRD §7.6
- UIUX_SPEC §8.1

## File to create
`apps/web/src/app/api/v1/bookings/route.ts` (GET handler — POST handler from E05-07 already exists)

## Query params
| Param | Values | Default |
|-------|--------|---------|
| `tab` | `upcoming` \| `past` \| `cancelled` | `upcoming` |
| `cursor` | opaque string (bookingId) | none |
| `limit` | 1–50 | 20 |

## Tab filter logic
```typescript
const now = new Date();

const whereByTab = {
  upcoming: {
    status: { in: ['PENDING', 'CONFIRMED'] as const },
    date: { gte: startOfDay(now) },
  },
  past: {
    status: { in: ['COMPLETED', 'NO_SHOW'] as const },
  },
  cancelled: {
    status: { in: ['CANCELLED'] as const },
  },
};
```

## Response shape
```json
{
  "data": {
    "items": [{
      "id": "clxyz...",
      "status": "CONFIRMED",
      "date": "2026-10-14",
      "startTime": "14:00",
      "endTime": "16:00",
      "pitch": {
        "id": "...",
        "name": "Pitch A",
        "surfaceType": "ARTIFICIAL_GRASS"
      },
      "company": {
        "id": "...",
        "name": "Demo Sports Club",
        "logoUrl": "https://res.cloudinary.com/..."
      },
      "totalAmount": 210,
      "refundAmount": null,
      "hasReview": false,
      "createdAt": "2026-10-06T10:00:00Z"
    }],
    "nextCursor": "clxyz_next...",
    "hasMore": true
  },
  "error": null
}
```

## Ordering
- `upcoming`: date ASC, startTime ASC (soonest first)
- `past`: date DESC (most recent first)
- `cancelled`: createdAt DESC

## Acceptance criteria
- [ ] Requires auth (401 if unauthenticated)
- [ ] Returns only bookings belonging to `req.user.id`
- [ ] `tab=upcoming` returns PENDING + CONFIRMED, today onwards
- [ ] `tab=past` returns COMPLETED + NO_SHOW
- [ ] `tab=cancelled` returns CANCELLED
- [ ] Cursor pagination: `nextCursor` null when no more pages
- [ ] `hasReview` boolean derived from Review table (join or subquery)
- [ ] `refundAmount` populated for cancelled bookings
- [ ] Default limit 20, max 50 (clamp any value > 50)

## Edge cases
- Player with no bookings → `items: []`, `hasMore: false`
- Booking spanning midnight (if ever allowed) → date = start date
- `tab` value not in enum → 400 validation error

## Definition of done
- No N+1 queries (use Prisma `include` not separate loops)
- Returns correct `hasReview` without loading full review body
BODY

create_issue "$title" "$body" '["E06 — Player: My Bookings","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E06-02 — Backend: GET /bookings/:id — booking detail
# ─────────────────────────────────────────────────────────────────────────────
title="[E06-02] [Backend] GET /bookings/:id — full booking detail with status history and payment breakdown"
read -r -d '' body << 'BODY' || true
## Summary
Implement `GET /api/v1/bookings/:id` returning complete booking detail: company info, pitch info, slot, teams/shirts, payment breakdown, status history, refund info.

## Reference
- PRD §7.6
- UIUX_SPEC §8.2

## File to create
`apps/web/src/app/api/v1/bookings/[id]/route.ts` (GET handler)

## Response shape
```json
{
  "data": {
    "id": "clxyz...",
    "status": "CONFIRMED",
    "date": "2026-10-14",
    "startTime": "14:00",
    "endTime": "16:00",
    "duration": 120,
    "teamCount": 2,
    "playersPerTeam": { "A": 5, "B": 5 },
    "shirtOrders": [
      { "teamKey": "A", "colour": "RED", "quantity": 5 },
      { "teamKey": "B", "colour": "BLUE", "quantity": 5 }
    ],
    "note": "Please have the goals set up",
    "pitch": {
      "id": "...",
      "name": "Pitch A",
      "surfaceType": "ARTIFICIAL_GRASS",
      "size": "FIVE_A_SIDE"
    },
    "company": {
      "id": "...",
      "name": "Demo Sports Club",
      "logoUrl": "https://...",
      "addressLine1": "Str. Sportului 1",
      "city": "Cluj-Napoca",
      "phone": "+40712345678"
    },
    "payment": {
      "pitchRental": 160,
      "shirtRental": 50,
      "platformFee": 8,
      "total": 218,
      "cardLast4": "4242",
      "cardBrand": "visa",
      "paidAt": "2026-10-06T10:05:00Z",
      "refundAmount": null,
      "refundedAt": null
    },
    "statusHistory": [
      { "status": "PENDING", "at": "2026-10-06T10:00:00Z" },
      { "status": "CONFIRMED", "at": "2026-10-06T10:05:00Z" }
    ],
    "hasReview": false,
    "isDisputed": false,
    "createdAt": "2026-10-06T10:00:00Z"
  },
  "error": null
}
```

## Status history
Store in `BookingStatusEvent` table (bookingId, status, createdAt) — created on each status transition. Ordered by createdAt ASC.

```prisma
model BookingStatusEvent {
  id        String   @id @default(cuid())
  bookingId String
  booking   Booking  @relation(fields: [bookingId], references: [id])
  status    BookingStatus
  createdAt DateTime @default(now())
}
```

If table doesn't exist yet, derive from Booking timestamps as fallback: `[{ status: 'PENDING', at: createdAt }, { status: currentStatus, at: updatedAt }]`

## Acceptance criteria
- [ ] Requires auth
- [ ] Returns 403 if booking.userId !== req.user.id (cannot view other users' bookings)
- [ ] Returns 404 if booking not found
- [ ] All fields populated correctly from DB
- [ ] `statusHistory` ordered oldest → newest
- [ ] `payment.cardLast4` and `payment.cardBrand` from Stripe PaymentIntent metadata (or stored on Booking)
- [ ] `refundAmount` and `refundedAt` populated from Booking.refundAmount (set by webhook E05-08)

## Edge cases
- Manager also has MANAGER role — can they view player bookings? No. Managers use `/manager/bookings` endpoint (E11). This endpoint only for own bookings.
- Booking with no shirt orders: `shirtOrders: []`
- Booking where card details not stored yet (race condition): return null for card fields

## Definition of done
- Single Prisma query with all needed includes (no waterfall)
- Card details pulled from stored fields, not re-fetched from Stripe
BODY

create_issue "$title" "$body" '["E06 — Player: My Bookings","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E06-03 — Backend: POST /bookings/:id/cancel
# ─────────────────────────────────────────────────────────────────────────────
title="[E06-03] [Backend] POST /bookings/:id/cancel — cancellation logic, refund calculation, Stripe refund"
read -r -d '' body << 'BODY' || true
## Summary
Implement `POST /api/v1/bookings/:id/cancel`. Validates cancellation eligibility, computes refund amount per policy, initiates Stripe refund, updates booking status to CANCELLED.

## Reference
- PRD §7.7, §12 (cancellation rules)
- UIUX_SPEC §8.3

## File to create
`apps/web/src/app/api/v1/bookings/[id]/cancel/route.ts`

## Cancellation policy (from PRD §7.7)
```typescript
// packages/shared/src/utils/cancellation.ts
export function calcRefundAmount(
  totalPaid: number,
  bookingDateTime: Date,  // date + startTime combined
  cancelledAt: Date = new Date()
): { refundAmount: number; refundPercent: number } {
  const hoursUntilBooking = (bookingDateTime.getTime() - cancelledAt.getTime()) / 3_600_000;

  if (hoursUntilBooking > 24) {
    return { refundAmount: totalPaid, refundPercent: 100 };
  } else if (hoursUntilBooking >= 2) {
    return { refundAmount: Math.floor(totalPaid * 0.5), refundPercent: 50 };
  } else {
    return { refundAmount: 0, refundPercent: 0 };
  }
}
```

## Endpoint logic
```typescript
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { pitch: true },
  });

  if (!booking) return err('NOT_FOUND', 'Booking not found', 404);
  if (booking.userId !== user.id) return err('FORBIDDEN', 'Not your booking', 403);
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    return err('NOT_CANCELLABLE', 'Booking cannot be cancelled in current status', 400);
  }

  const bookingDateTime = combineDateAndTime(booking.date, booking.startTime);
  const { refundAmount, refundPercent } = calcRefundAmount(booking.amountPaid, bookingDateTime);

  // Stripe refund (if refundAmount > 0)
  if (refundAmount > 0 && booking.paymentIntentId) {
    const charge = await getChargeForPaymentIntent(booking.paymentIntentId);
    await stripe.refunds.create({
      charge: charge.id,
      amount: refundAmount * 100,  // bani
      reason: 'requested_by_customer',
      metadata: { bookingId: booking.id },
    });
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: 'PLAYER_CANCELLED',
      refundAmount,
    },
  });

  // Trust score: if < 2h → deduct points (see E12)
  // Notification to manager (see E13)

  return ok({ refundAmount, refundPercent, message: 'Booking cancelled' });
}
```

## Response
```json
{
  "data": {
    "refundAmount": 105,
    "refundPercent": 50,
    "message": "Booking cancelled. Refund of 105 RON will appear in 5–10 business days."
  },
  "error": null
}
```

## Acceptance criteria
- [ ] Requires auth
- [ ] Returns 403 if not own booking
- [ ] Returns 400 if booking already cancelled, completed, or no-show
- [ ] Refund calc: > 24h = 100%, 2–24h = 50%, < 2h = 0%
- [ ] Stripe refund initiated when refundAmount > 0
- [ ] Stripe refund amount in bani (× 100)
- [ ] Booking status set to CANCELLED, cancelledAt and refundAmount stored
- [ ] Returns refundAmount and refundPercent to client
- [ ] No refund triggered if paymentIntentId null (edge case: manual booking)

## Edge cases
- Booking starts in exactly 2h: treat as < 2h (boundary = exclusive at 2h)
- Stripe refund API fails: do NOT cancel booking — return 503, let user retry
- Platform fee: not refunded (only pitch rental + shirt rental refunded proportionally)
  - Adjust: `refundAmount = Math.floor((pitchRental + shirtRental) * refundPercent / 100)`
  - Platform fee always kept

## Definition of done
- `calcRefundAmount` exported from `packages/shared` and unit tested at boundaries (24h, 2h, 1h59m)
- Stripe test refund verified (test mode)
- Cancel idempotent: calling twice → second call returns 400 (already cancelled)
BODY

create_issue "$title" "$body" '["E06 — Player: My Bookings","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E06-04 — Backend: POST /bookings/:id/dispute + GET /bookings (count)
# ─────────────────────────────────────────────────────────────────────────────
title="[E06-04] [Backend] POST /bookings/:id/dispute — no-show dispute + GET /bookings/count for badge"
read -r -d '' body << 'BODY' || true
## Summary
Two small endpoints: (1) dispute a no-show marking — player claims they attended; (2) GET /bookings/count returning upcoming booking count for tab badge. Both require auth.

## Reference
- PRD §7.6, §9 (penalty system)
- UIUX_SPEC §8.2

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/bookings/[id]/dispute/route.ts` | Create |
| `apps/web/src/app/api/v1/bookings/count/route.ts` | Create |

## POST /bookings/:id/dispute

### Request (no body required)
### Logic
```typescript
// 1. requireAuth
// 2. Fetch booking — must belong to user, status must be NO_SHOW
// 3. Check no existing open dispute (isDisputed: false on booking)
// 4. Set booking.isDisputed = true
// 5. Create Notification for admin (type: DISPUTE, message: "Player disputes no-show for booking #...")
// 6. Return 200 { message: "Dispute submitted. Admin will review within 48h." }
```

### Eligibility window
- Can only dispute within 48h of the booking date
- After 48h: return 400 `DISPUTE_WINDOW_CLOSED`

### Acceptance criteria
- [ ] Requires auth
- [ ] 403 if not own booking
- [ ] 400 if status !== NO_SHOW
- [ ] 400 if already disputed (isDisputed === true)
- [ ] 400 if > 48h after booking date
- [ ] Sets isDisputed = true, creates admin notification
- [ ] Returns success message

---

## GET /bookings/count

### Purpose
Return count of upcoming bookings for My Bookings tab badge (bottom tab indicator).

### Response
```json
{
  "data": {
    "upcoming": 3,
    "unreviewed": 1
  },
  "error": null
}
```

- `upcoming`: PENDING + CONFIRMED bookings with date >= today
- `unreviewed`: COMPLETED bookings with no associated Review

### Acceptance criteria
- [ ] Requires auth
- [ ] Returns counts for authenticated user only
- [ ] Single Prisma `count` call per metric (no full record fetch)
- [ ] Used by mobile tab bar to show badge number on "My Bookings" tab

## Definition of done
- Dispute endpoint tested: only NO_SHOW bookings disputable
- Count endpoint returns 0 counts (not error) when user has no bookings
BODY

create_issue "$title" "$body" '["E06 — Player: My Bookings","type: feature","platform: backend","priority: medium"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E06-05 — Backend: POST /reviews — review submission
# ─────────────────────────────────────────────────────────────────────────────
title="[E06-05] [Backend] POST /reviews — review submission with photo upload, 1-per-booking enforcement"
read -r -d '' body << 'BODY' || true
## Summary
Implement `POST /api/v1/reviews`. Player submits a review for a completed booking. Enforces 1 review per booking. Uploads photos to Cloudinary. Notifies manager. Review visible immediately (no moderation queue for v1).

## Reference
- PRD §7.8, §11

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/reviews/route.ts` | Create — POST |
| `apps/web/src/app/api/v1/reviews/[id]/route.ts` | Create — PUT (edit), DELETE |

## POST /reviews — request schema
```typescript
// packages/shared/src/schemas/review.ts
export const CreateReviewSchema = z.object({
  bookingId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(10).max(500).optional(),
  photoUrls: z.array(z.string().url()).max(3).default([]),
  isAnonymous: z.boolean().default(false),
});
```

## POST logic
```typescript
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  const body = await validateBody(req, CreateReviewSchema);

  // 1. Fetch booking — must belong to user, status must be COMPLETED
  const booking = await prisma.booking.findUnique({
    where: { id: body.bookingId },
    include: { pitch: true },
  });
  if (!booking || booking.userId !== user.id) return err('NOT_FOUND', 'Booking not found', 404);
  if (booking.status !== 'COMPLETED') return err('NOT_REVIEWABLE', 'Can only review completed bookings', 400);

  // 2. Check 1-per-booking
  const existing = await prisma.review.findUnique({ where: { bookingId: body.bookingId } });
  if (existing) return err('ALREADY_REVIEWED', 'You have already reviewed this booking', 409);

  // 3. Create review
  const review = await prisma.review.create({
    data: {
      bookingId: body.bookingId,
      pitchId: booking.pitchId,
      userId: user.id,
      rating: body.rating,
      text: body.text ?? null,
      isAnonymous: body.isAnonymous,
      moderationStatus: 'APPROVED',  // auto-approve for v1
    },
  });

  // 4. Store photo URLs (already uploaded via /upload/sign in E01-10)
  if (body.photoUrls.length > 0) {
    await prisma.reviewPhoto.createMany({
      data: body.photoUrls.map((url, i) => ({ reviewId: review.id, url, order: i })),
    });
  }

  // 5. Notify manager (see E13)
  // 6. Recalculate pitch avgRating (or use DB aggregate at read time)

  return ok({ id: review.id }, 201);
}
```

## PUT /reviews/:id — edit within 24h
```typescript
// requireAuth, must be own review
// Check review.createdAt + 24h > now (else 400 EDIT_WINDOW_CLOSED)
// Update rating, text, isAnonymous
// Cannot change bookingId or photos (for simplicity)
```

## DELETE /reviews/:id — soft delete
```typescript
// requireAuth, must be own review OR admin
// Set review.deletedAt = now, text = null, photoUrls cleared
// Display as "Review deleted by user" on pitch detail
```

## Acceptance criteria
- [ ] Requires auth
- [ ] 404 if booking not found or not own
- [ ] 400 if booking status !== COMPLETED
- [ ] 409 if review already exists for this booking
- [ ] Rating 1–5 required
- [ ] Text min 10 chars if provided (optional but validated if present)
- [ ] Max 3 photos
- [ ] isAnonymous = true → review shows "Anonymous player" on pitch page
- [ ] Edit window: 24h from creation (400 after)
- [ ] Delete: soft — row remains with deletedAt set
- [ ] Manager notified via Notification after review creation

## Edge cases
- Player submits review for another player's booking (wrong userId) → 404
- Photo URLs from external hosts (not Cloudinary) → accept for v1, validate in v2
- Rating = 0 → 422 (min 1 enforced by Zod)
- Review text exactly 10 chars → valid; 9 chars → 422

## Definition of done
- 1-per-booking constraint also enforced at DB level: `@@unique([bookingId])` on Review model
- Unit test for review validation schema in `packages/shared`
BODY

create_issue "$title" "$body" '["E06 — Player: My Bookings","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E06-06 — Mobile: My Bookings list screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E06-06] [Mobile] My Bookings list screen — tabs, booking cards, countdown chip, empty states"
read -r -d '' body << 'BODY' || true
## Summary
Build the My Bookings screen with Upcoming / Past / Cancelled tabs. Each tab loads its own paginated list. Booking cards match UIUX_SPEC §8.1 exactly. Tab badge shows upcoming count.

## Reference
- UIUX_SPEC §8.1
- PRD §7.6

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/bookings/MyBookingsScreen.tsx` | Create |
| `apps/mobile/src/screens/bookings/components/BookingCard.tsx` | Create |
| `apps/mobile/src/screens/bookings/components/CountdownChip.tsx` | Create |
| `apps/mobile/src/hooks/useBookings.ts` | Create — infinite query per tab |

## Tab implementation
- `react-native-tab-view` (same as Company Detail in E04)
- 3 tabs: "Upcoming" | "Past" | "Cancelled"
- Active tab: primary-600 bottom underline 2px
- Each tab has own `FlatList` with independent pagination
- Pull-to-refresh on each tab

## BookingCard spec (Upcoming)
- white bg, shadow-sm, radius-md, 16px padding, 12px vertical gap between cards
- Top-right: status badge
  - "Confirmed" → success-600 text, success-50 bg, radius-full, 6px 10px padding, label-sm
  - "Pending" → warning-600 text, warning-50 bg (same sizing)
- Row 1: company logo (40×40px, radius-sm) + company name (label-md neutral-700) + pitch name (heading-sm neutral-900)
- Row 2: `calendar` icon (16px neutral-400) + date string — body-md neutral-700
- Row 3: `clock-outline` icon + time interval — body-md neutral-700
- CountdownChip (if starts within 24h): see below
- No action buttons on Upcoming card (tap whole card → detail)

## BookingCard spec (Past)
- Same layout as Upcoming
- Status badge: "Completed" (success) or "No-show" (error-600, error-50)
- Row below time: "Leave a review" — secondary button small (if !hasReview)
- "Re-book" — ghost button small, right aligned
- Both buttons in same row, space-between

## BookingCard spec (Cancelled)
- Same layout minus status badge (status shown differently)
- "Cancelled by you" or "Cancelled by manager" — body-sm neutral-500, italic
- Refund row (if refundAmount > 0): `currency-ron` icon + "Refund: XX RON" — body-sm primary-600
- "No refund" (if refundAmount = 0) — body-sm neutral-400

## CountdownChip spec
- Shown when: tab=Upcoming AND booking starts within 24h
- `clock-fast` icon (14px warning-500) + "Starts in 3h 20min" text
- warning-500 text, warning-50 bg, radius-full, 6px 10px padding
- Updates every 60s via `useInterval`

```typescript
// CountdownChip.tsx
function formatCountdown(bookingDateTime: Date): string {
  const diff = bookingDateTime.getTime() - Date.now();
  if (diff <= 0) return 'Starting now';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}
```

## Empty states
- Upcoming empty: calendar illustration + "No upcoming bookings" heading-sm + "Find a pitch" → CTA primary-600 → Discover tab
- Past empty: "No past bookings yet" + pitch icon
- Cancelled empty: "No cancelled bookings" + check-circle icon

## Tab badge
- Bottom tab bar "My Bookings" tab: shows numeric badge if upcoming count > 0
- Fetched from `GET /bookings/count` on mount + on focus (E06-04)

## Acceptance criteria
- [ ] 3 tabs render, tab switch is instant (lazy load)
- [ ] Upcoming cards show status badge + countdown chip when < 24h
- [ ] Past cards show "Leave a review" button when hasReview === false
- [ ] "Leave a review" → navigates to ReviewScreen with bookingId
- [ ] Cancelled cards show refund amount or "No refund"
- [ ] Pull-to-refresh reloads current tab
- [ ] Infinite scroll loads next page on `onEndReached`
- [ ] Empty state shown when tab has no bookings
- [ ] Tab badge updates on mount

## Edge cases
- Booking status changes while list is open (e.g. manager marks no-show) → pull-to-refresh resolves
- Very long company names: truncate with ellipsis at 1 line
- Countdown chip updates live without re-fetching (local timer only)

## Definition of done
- No layout jitter switching between tabs
- Countdown chip updates every 60s on device (useInterval tested)
- "Leave a review" only visible on Past tab, never on Upcoming or Cancelled
BODY

create_issue "$title" "$body" '["E06 — Player: My Bookings","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E06-07 — Mobile: Booking Detail screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E06-07] [Mobile] Booking Detail screen — status banner, timeline, action buttons, full info"
read -r -d '' body << 'BODY' || true
## Summary
Build the Booking Detail screen: full booking info, status banner, status history timeline, context-dependent action buttons (cancel / review / dispute). Navigated to from booking card tap or confirmation step 5.

## Reference
- UIUX_SPEC §8.2
- PRD §7.6

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/bookings/BookingDetailScreen.tsx` | Create |
| `apps/mobile/src/screens/bookings/components/StatusBanner.tsx` | Create |
| `apps/mobile/src/screens/bookings/components/StatusTimeline.tsx` | Create |
| `apps/mobile/src/screens/bookings/components/BookingInfoCard.tsx` | Create |
| `apps/mobile/src/screens/bookings/components/PaymentCard.tsx` | Create |

## StatusBanner spec (full width, below header)
| Status | BG | Text | Icon |
|--------|----|------|------|
| CONFIRMED | success-50 | success-500 | check-circle |
| PENDING | warning-50 | warning-600 | clock-outline |
| COMPLETED | success-50 | success-500 | check-circle |
| CANCELLED | neutral-100 | neutral-500 | close-circle |
| NO_SHOW | error-50 | error-500 | alert-circle |
- Height: 48px, horizontally centred content (icon 16px + 6px gap + text label-md)

## Header
- "Booking Details" — heading-xl
- Booking ID below: "#AB12CD" — label-sm neutral-400, `fontFamily: 'Courier New'`, centred

## Company section
- Logo 56×56px radius-sm
- Company name — heading-md neutral-900
- Address — body-md neutral-500
- Phone — body-md primary-600, tappable (Linking.openURL(`tel:${phone}`))

## BookingInfoCard spec
- neutral-50 bg, radius-md, 16px padding
- Rows (same icon+label+value pattern as summary card from E05-05):
  - calendar — date formatted "Tuesday, 14 October 2026"
  - clock-outline — "14:00 – 16:00 · 2h duration"
  - map-marker — pitch name + surface chip
  - account-group — "2 teams · 10 players"
  - tshirt-crew — per team colour row: colour swatch (16px circle) + "Team A: 5 red shirts"
  - note-text — note (if any)
- Booking ID row at bottom: monospace

## PaymentCard spec
- white bg, shadow-sm, radius-md, 16px padding
- "Payment" — heading-sm
- Row: "Pitch rental" + "160 RON" — body-md
- Row: "Shirt rental" + "50 RON" — body-md (omit if 0)
- Row: "Platform fee" + "8 RON" — body-md
- Divider
- Row: "Total paid" + "218 RON" — heading-sm, price font
- Row: "Card" + Visa icon + "···· 4242" — body-sm neutral-500
- Row: "Paid on" + formatted date — body-sm neutral-500
- If cancelled + refunded: "Refund: XX RON" — body-sm primary-600

## StatusTimeline spec
- Vertical list: dot + status label + formatted timestamp
- Dot: 10px circle, primary-600 for past steps, neutral-300 for future
- Vertical line: 1px neutral-200 connecting dots (except after last)
- Statuses shown: PENDING → CONFIRMED → COMPLETED (or CANCELLED / NO_SHOW)
- Only show steps that have occurred

## Action buttons (at bottom, above safe area)
| Condition | Button |
|-----------|--------|
| status=CONFIRMED/PENDING + bookingStart > 2h away | "Cancel Booking" — destructive-outline full width |
| status=COMPLETED + !hasReview | "Rate this pitch" — primary full width |
| status=NO_SHOW + !isDisputed + within 48h | "Dispute no-show" — secondary full width |
| status=NO_SHOW + isDisputed | Disabled "Dispute submitted" — ghost |
| Otherwise | No button |

## Acceptance criteria
- [ ] StatusBanner correct colour per status
- [ ] Company phone tappable, opens dialer
- [ ] Shirt colour swatches rendered as 16px circles with correct colours
- [ ] StatusTimeline shows correct steps with correct dot states
- [ ] "Cancel Booking" → opens CancelBookingSheet (E06-08)
- [ ] "Rate this pitch" → navigates to ReviewScreen (E06-09)
- [ ] "Dispute no-show" → calls POST /bookings/:id/dispute → toast confirmation
- [ ] After dispute: button changes to "Dispute submitted" (disabled)
- [ ] Booking ID in monospace font

## Edge cases
- Cancel button disabled if bookingStart ≤ 2h away (within no-refund window): hide button entirely or show "Cannot cancel — booking is too soon" body-sm neutral-400
- No shirt orders: tshirt-crew row hidden
- No note: note-text row hidden

## Definition of done
- Tested with all status values (mock API or test bookings)
- Phone link opens dialer on real device (not simulator only)
- Timeline renders correctly for 2-step and 3-step histories
BODY

create_issue "$title" "$body" '["E06 — Player: My Bookings","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E06-08 — Mobile: Cancel Booking bottom sheet + flow
# ─────────────────────────────────────────────────────────────────────────────
title="[E06-08] [Mobile] Cancel Booking bottom sheet — policy display, refund preview, confirm flow"
read -r -d '' body << 'BODY' || true
## Summary
Build the cancel booking bottom sheet triggered from Booking Detail. Displays applicable cancellation policy and calculated refund amount. On confirm: calls cancel API, shows toast, navigates back and refreshes bookings list.

## Reference
- UIUX_SPEC §8.3
- PRD §7.7

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/bookings/CancelBookingSheet.tsx` | Create |
| `apps/mobile/src/hooks/useCancelBooking.ts` | Create — mutation + refetch |

## Sheet spec
- @gorhom/bottom-sheet, snapPoints: ['50%']
- Title: "Cancel this booking?" — heading-md neutral-900
- Compact booking summary row:
  - Pitch name — label-md neutral-700
  - Date + time — body-sm neutral-500
- Policy box (colour depends on refund tier):

```
> 24h away  → success-50 bg, success-500 border  → "You'll receive 210 RON back · 100% refund"
2–24h away → warning-50 bg, warning-500 border  → "You'll receive 105 RON back · 50% refund"
< 2h away  → error-50 bg, error-500 border      → "No refund · Cancellation window has passed"
```

- Policy box:
  - 3px left border, radius-sm right corners, 12px padding
  - Line 1: refund amount text — body-md neutral-900, bold amount
  - Line 2: "Refund processed in 5–10 business days" — body-sm neutral-500 (omit if 0% refund)

- Buttons:
  - "Keep my booking" — primary, full width
  - "Cancel — get XX RON refund" — destructive-outline, full width, 8px below
  - If 0% refund: "Cancel booking" — destructive, full width (no refund wording)
  - Loading state: spinner in cancel button during API call

## useCancelBooking hook
```typescript
export function useCancelBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post(`/bookings/${bookingId}/cancel`),
    onSuccess: (data) => {
      // Invalidate bookings list + booking detail
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      // Toast
      Toast.show(`Booking cancelled. ${data.refundAmount > 0 ? `Refund of ${data.refundAmount} RON will appear in 5–10 business days.` : 'No refund applied.'}`);
    },
    onError: (err) => {
      Toast.show(err.message ?? 'Failed to cancel booking. Please try again.');
    },
  });
}
```

## Refund amount display
- Compute client-side using `calcRefundAmount` from `packages/shared` for instant display
- API response confirms the actual amount (may differ if edge-case timing)
- If API refundAmount differs from client-estimated: show API value in success toast

## Post-cancellation flow
1. API returns success
2. Close bottom sheet
3. Show toast with refund message
4. Navigate back to My Bookings list (Cancelled tab focused)
5. TanStack Query cache invalidated → list refreshes

## Acceptance criteria
- [ ] Sheet opens from Booking Detail "Cancel Booking" button
- [ ] Compact booking summary visible in sheet
- [ ] Policy box correct colour and text for all 3 tiers
- [ ] "Keep my booking" closes sheet without API call
- [ ] Cancel button shows spinner during API call
- [ ] Success: sheet closes, toast shown, navigate to Cancelled tab
- [ ] Error: toast with error message, sheet stays open
- [ ] 0% refund: button text is "Cancel booking" (no refund mention)
- [ ] 100% refund: button text "Cancel — get 210 RON refund"

## Edge cases
- User's clock is wrong (client-computed tier differs from server): API is authoritative — show API refund in toast
- Network timeout: retry button in error toast
- Booking cancellation window changes between sheet open and confirm: server returns updated amount

## Definition of done
- Bottom sheet dismissable by swipe-down (gorhom default)
- Keyboard does not push sheet up (no text inputs in sheet)
- Cancel flow end-to-end tested with test booking
BODY

create_issue "$title" "$body" '["E06 — Player: My Bookings","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E06-09 — Mobile: Review Screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E06-09] [Mobile] Review screen — star picker, text input, photo upload, anonymous toggle"
read -r -d '' body << 'BODY' || true
## Summary
Build the review submission screen. 5-star picker with shake animation on submit without rating. Optional text (min 10 chars), up to 3 photos (uploaded via Cloudinary signed URL), anonymous toggle.

## Reference
- UIUX_SPEC §8.4
- PRD §7.8

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/bookings/ReviewScreen.tsx` | Create |
| `apps/mobile/src/screens/bookings/components/StarPicker.tsx` | Create |
| `apps/mobile/src/screens/bookings/components/ReviewPhotoRow.tsx` | Create |
| `apps/mobile/src/hooks/useSubmitReview.ts` | Create — mutation |

## StarPicker spec
- 5 stars in a row, 40px each, 12px gap
- Filled: `star` icon, warning-500 (#F59E0B) — same as ratings elsewhere
- Empty: `star-outline` icon, neutral-300
- Tap any star → fill that star + all before it
- On submit with 0 stars: Animated.sequence shake (±8px horizontal, 3 cycles, 50ms each)

```typescript
// StarPicker.tsx
interface StarPickerProps {
  value: number;  // 0–5
  onChange: (rating: number) => void;
  shakeRef: React.RefObject<() => void>;
}
```

## Rating labels (below stars)
| Stars | Label | Color |
|-------|-------|-------|
| 0 | (none) | — |
| 1 | "Very poor" | error-500 |
| 2 | "Poor" | warning-500 |
| 3 | "Average" | neutral-500 |
| 4 | "Good" | primary-500 |
| 5 | "Excellent!" | success-500 |

- Animated fade-in when label changes (Animated.timing 150ms opacity)

## Pitch info (compact header row)
- Pitch name — label-md neutral-900
- Company name — body-sm neutral-500
- Date played — body-sm neutral-400
- All on same card, neutral-50 bg, radius-md, 12px padding, 16px margin horizontal

## Text input
- Placeholder: "Share your experience (optional)..."
- multiline, minHeight: 80, maxHeight: 200 (auto-expand)
- Max 500 chars
- Character counter: "XX / 500" — label-sm neutral-400, bottom right
- If text length > 0 && text.length < 10: inline error "Review must be at least 10 characters" — body-sm error-500

## ReviewPhotoRow spec
- 3 slots in a row (80×80px each, radius-sm, 8px gap)
- Empty slot: dashed border 1px neutral-300, `plus` icon neutral-400 centred
- Tap empty slot → `react-native-image-picker` (launchImageLibrary, mediaType: 'photo')
- Filled slot: thumbnail (cover fit) + X remove button (top-right, 18px circle, neutral-900 bg, white X)
- After image picked: upload to Cloudinary via signed URL (`POST /api/v1/upload/sign`) → get back URL
- Upload in progress: skeleton shimmer on slot

## Photo upload flow
```typescript
// 1. Pick image from library
// 2. POST /api/v1/upload/sign?folder=reviews to get { signature, timestamp, cloudName, apiKey }
// 3. POST to https://api.cloudinary.com/v1_1/{cloudName}/image/upload with:
//    { file: imageBase64, signature, timestamp, api_key, folder: 'reviews' }
// 4. Store returned secure_url in local state
// 5. Include all URLs in review submission
```

## Anonymous toggle
- Row: "Post anonymously" label-md neutral-900 + Switch (primary-600 active)
- Below: "Your name won't be shown" — body-sm neutral-500
- 8px padding top

## Submit
- "Submit review" — primary, full width, disabled until rating ≥ 1
- If text present and < 10 chars: disabled + inline error
- Loading: spinner in button
- On success: navigate back to Booking Detail or My Bookings; show toast "Review submitted!"
- On error: toast with error message

## useSubmitReview hook
```typescript
export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReviewInput) => apiClient.post('/reviews', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['booking', variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      Toast.show('Review submitted!');
    },
  });
}
```

## Acceptance criteria
- [ ] StarPicker fills correct stars on tap
- [ ] 0-star submit attempt triggers shake animation
- [ ] Rating label appears/fades correctly for each star count
- [ ] Text input expands as user types (up to maxHeight)
- [ ] Character counter shows live
- [ ] Text < 10 chars (if non-empty) shows inline error, disables submit
- [ ] Up to 3 photos addable, each shows upload skeleton then thumbnail
- [ ] Remove X deletes photo from local state (and Cloudinary URL cleared)
- [ ] Anonymous toggle affects `isAnonymous` in payload
- [ ] Submit disabled until rating ≥ 1
- [ ] Submit calls POST /reviews with correct payload
- [ ] Success: toast + navigate back, booking shows hasReview = true

## Edge cases
- Image picker cancelled: no-op (no error shown)
- Cloudinary upload fails: show "Photo upload failed" toast on that slot, slot returns to empty
- User submits then immediately navigates away: mutation completes in background, cache invalidated
- Duplicate submit (double-tap): use `isPending` to disable button during mutation

## Definition of done
- Photos upload successfully on real device (network request visible in Charles/Proxyman)
- Review appears on pitch detail immediately after submission (cache invalidation works)
- Anonymous review shows "Anonymous player" on pitch page (not user's name)
BODY

create_issue "$title" "$body" '["E06 — Player: My Bookings","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E06-10 — Web: My Bookings pages
# ─────────────────────────────────────────────────────────────────────────────
title="[E06-10] [Web] My Bookings pages — booking list, detail, cancel modal, review form"
read -r -d '' body << 'BODY' || true
## Summary
Build the web My Bookings section under `/my-bookings`. Tabbed list with booking cards, booking detail page, cancel confirmation modal, review form. Uses same backend endpoints as mobile.

## Reference
- UIUX_SPEC §8 (adapt mobile spec for web layout)
- PRD §7.6, §7.7, §7.8

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/my-bookings/page.tsx` | Create — list with tabs |
| `apps/web/src/app/my-bookings/[id]/page.tsx` | Create — booking detail |
| `apps/web/src/app/my-bookings/[id]/review/page.tsx` | Create — review form |
| `apps/web/src/components/bookings/WebBookingCard.tsx` | Create |
| `apps/web/src/components/bookings/CancelModal.tsx` | Create — dialog (not bottom sheet) |
| `apps/web/src/components/bookings/WebStarPicker.tsx` | Create |

## List page `/my-bookings`
- Tabs: "Upcoming" | "Past" | "Cancelled" (URL query param `?tab=upcoming`)
- Sharing tab URL is intentional (shareable, browser back/forward works)
- Max-width 800px centred on desktop
- Booking cards: same data as mobile, adapted for web
  - Cards are full width, card border (1px neutral-200) instead of shadow on desktop
  - Hover: neutral-50 bg transition 150ms
  - Action buttons inline on card (not icon buttons)

## Booking detail `/my-bookings/[id]`
- Server component: fetch booking via `getServerSession` + API call
- `generateMetadata`: title "Booking #{id} — PitchUp"
- Layout: single column (max 640px centred)
- Sections same as mobile: StatusBanner, company info, BookingInfoCard, PaymentCard, StatusTimeline, actions
- "Cancel Booking" button → opens CancelModal (client component island within server page)

## CancelModal spec (web)
- Radix UI Dialog (or shadcn/ui Dialog) — replaces bottom sheet on web
- Same content as mobile CancelBookingSheet
- Accessible: focus trapped, ESC closes, backdrop click closes

## Review form `/my-bookings/[id]/review`
- Server component wrapper, client form component
- WebStarPicker: 5 stars, 36px each, hover state fills stars up to hovered position
- Text: standard `<textarea>` (max 500 chars, character counter via JS)
- Photo upload: `<input type="file" accept="image/*" multiple max={3}>` → same Cloudinary upload flow
- Anonymous: `<Switch>` (shadcn/ui)
- Submit: POST /reviews → redirect to `/my-bookings/${bookingId}?reviewed=1` → success toast

## Auth guard
- All `/my-bookings` routes: `getServerSession()` → redirect to `/auth/login?next=/my-bookings` if no session

## Acceptance criteria
- [ ] All 3 tab states render correct bookings
- [ ] Tab switching updates URL query param
- [ ] Booking detail loads all sections correctly
- [ ] "Cancel Booking" opens modal with correct policy/refund info
- [ ] Cancel confirm → API call → redirect to `/my-bookings?tab=cancelled`
- [ ] Review form accessible via `/my-bookings/:id/review`
- [ ] Star picker works with mouse hover and click
- [ ] Photo upload works (max 3)
- [ ] Submit review → redirect to booking detail with success message
- [ ] All pages redirect to login if unauthenticated

## Edge cases
- Direct URL to `/my-bookings/nonexistent` → 404 page
- Review page for booking not owned by current user → 403 → error page
- Review page for booking without status COMPLETED → redirect to `/my-bookings/:id`

## Definition of done
- Server-rendered initial data (no loading flash on detail page)
- Cancel modal focus trap verified (keyboard-only navigation)
- Review form lighthouse a11y score ≥ 90
BODY

create_issue "$title" "$body" '["E06 — Player: My Bookings","type: feature","platform: web","priority: high"]' "$MILESTONE"

echo "✓ E06 — 10 issues created"
