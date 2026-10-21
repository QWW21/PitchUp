# Plan: covered-season pricing (dome, cold/hot air) and venue subscriptions

Written 2026-10-21 for a separate implementation session. Two features, built
in this order: **A. Covered season** (C-14) and **B. Subscription or
pay-per-booking** (C-15). Both touch pricing, so A lands first and B builds
on the price it produces.

Read first: `docs/HANDOVER.md` (C-2 one hourly rate, C-8 pay at the venue,
C-10 refund policy snapshot, E14 analytics, E15 platform config, "Romanian
and English"), `docs/ARCHITECTURE.md` §21, §26, §27, §30.

---

## Decisions already taken (by the product owner)

**Covered season**

- Without a dome a pitch has **one price all year** (today's
  `Pitch.hourlyRate`); the venue can still change it any time.
- In winter a venue may **cover** a pitch (a dome / bubble). While covered:
  - The venue chooses which air it offers: **cold only, hot only, or both**.
  - Each offered air type has **its own hourly price**, set by the venue.
    These are full prices per hour, not extras added to the base rate.
  - **Cold air is the default.** If both are offered, the player picks
    cold or hot when booking; if only one is offered, that price applies
    and there is nothing to pick.
- So during the covered period a pitch has 1 or 2 prices; outside it, 1.

**Subscriptions**

- **Pay-per-booking** = today's model: PitchUp takes `platformFeePercent`
  of each booking.
- **Subscription** = a fixed monthly fee to PitchUp and **no commission**
  on bookings.
- **Cash-only venues** (`paymentMode = VENUE`) **must** subscribe. Venues
  taking any online payments choose either.
- The subscription is paid with **Stripe Billing, card on file**, with a
  test-mode path that works without Stripe keys (like bookings today).

## Decisions this plan takes (change them if the owner disagrees)

1. **The covered period is a list of date ranges per pitch** (e.g. 1 Nov –
   31 Mar), not an on/off switch. Bookings are made weeks ahead, so the
   price for a future date must be known now; a switch would change prices
   of bookings already shown. Several ranges are allowed (two winters).
2. **The price is decided by the booking's date** (the venue's calendar
   day of the start), not split hour by hour. A season starts and ends on
   whole days.
3. **The price is snapshotted on the booking** (like `pitchRateSnapshot`
   and the refund policy, C-10): changing rates or seasons never changes a
   booking already made. Add the chosen air type to the snapshot.
4. **Price setting lives with the pitch**, on the Pricing tab
   (`/manager/pitches/[id]/edit/pricing`): base rate as today, plus a
   "Covered season" section.
5. **The monthly fee is one platform-wide price** set by the admin in
   Platform settings (`PlatformConfig`), like the commission today.
   Per-venue negotiated prices are out of scope.
6. **The commission choice is snapshotted per booking** too: a booking
   made while the venue was subscribed has `platformFee = 0`, whatever
   happens to the subscription later.
7. **An unpaid subscription pauses new bookings** after a 7-day grace
   period (the venue is hidden from Discover like a suspended one, but
   keeps its existing bookings). It is not a suspension: paying lifts it at
   once without an admin.
8. **Switching plans takes effect at once for new bookings.** Leaving a
   subscription ends it at the end of the paid month (Stripe
   `cancel_at_period_end`); a cash-only venue cannot leave it without first
   changing its payment mode.

---

## A. Covered season (C-14)

### A1. Data model (`apps/web/prisma/schema.prisma`)

```prisma
enum AirType {
  COLD
  HOT
}

model Pitch {
  // … existing fields; hourlyRate stays the uncovered, all-year price
  coveredColdRate  Decimal?  @db.Decimal(10, 2)  // null = cold air not offered
  coveredHotRate   Decimal?  @db.Decimal(10, 2)  // null = hot air not offered
  coveredSeasons   PitchCoveredSeason[]
}

/// Days a pitch is covered (inclusive), on the venue's calendar.
model PitchCoveredSeason {
  id        String   @id @default(cuid())
  pitchId   String
  pitch     Pitch    @relation(fields: [pitchId], references: [id], onDelete: Cascade)
  startDate DateTime @db.Date
  endDate   DateTime @db.Date
  createdAt DateTime @default(now())
  @@index([pitchId, startDate])
}

model Booking {
  // … existing; pitchRateSnapshot becomes "the hourly rate this booking was priced at"
  airType   AirType?   // null = uncovered; COLD/HOT = covered, as chosen
}
```

- Rule: a pitch with any season must offer at least one air type. Saving
  seasons with both rates null is a validation error (and the reverse: rates
  without a season are allowed, they just never apply).
- Seasons of one pitch must not overlap (validate in the API).
- The dev and test databases use `prisma db push` (see HANDOVER: upgrading
  a dev database). New nullable columns need no data migration. Seed:
  give one Cluj pitch a season covering this winter with both rates, and
  another with cold only, so demos and E2E have both cases.

### A2. Shared rules (`packages/shared`)

New file `src/covered.ts` (export from `src/index.ts`), pure and
unit-tested:

```ts
export type AirType = 'COLD' | 'HOT'
export interface CoveredPricing {
  hourlyRate: number // uncovered
  coveredColdRate: number | null
  coveredHotRate: number | null
  seasons: { startDate: string; endDate: string }[] // YYYY-MM-DD, inclusive
}
/** Is the pitch covered on this venue date? */
export function isCoveredOn(p: CoveredPricing, date: string): boolean
/** The air types on offer that day: [] uncovered; ['COLD'], ['HOT'] or ['COLD','HOT']. */
export function airOptionsOn(p: CoveredPricing, date: string): AirType[]
/** The hourly rate for a date and choice; COLD by default when both exist. */
export function rateFor(
  p: CoveredPricing,
  date: string,
  air?: AirType | null
): { rate: number; airType: AirType | null }
```

- `bookingPrice(hourlyRate, minutes, feePercent)` keeps its signature;
  callers pass `rateFor(...).rate`.
- Zod: extend `PitchPricingSchema` (rates ≥ 1, ≤ 9999, nullable) and add
  `CoveredSeasonSchema` (`startDate ≤ endDate`, at most ~200 days, not in the
  past when created). Add `airType: z.enum(['COLD','HOT']).optional()` to
  `CreateBookingSchema`.
- Validation messages are catalog keys (`v.*`) in `src/i18n/en.ts` and
  `ro.ts`, like the existing ones.
- Shared catalog words: `air.COLD` "Cold air" / "Aer rece", `air.HOT` "Hot
  air" / "Aer cald", `covered` "Covered (dome)" / "Acoperit (balon)".

### A3. Server (`apps/web/src`)

- **Pricing API**: `PUT /api/v1/pitches/:id/pricing` also takes
  `coveredColdRate`, `coveredHotRate`. New
  `GET/POST/DELETE /api/v1/pitches/:id/covered-seasons[/:seasonId]`
  (owner only, `lib/manager/pitches.ts` next to the blocked-dates code,
  which is the closest existing pattern). Deleting or shortening a season
  with bookings on its days is allowed: those bookings keep their snapshot.
- **Availability / pitch detail**: `GET /pitches/:id/availability?date=`
  returns `covered: boolean`, `airOptions: AirType[]` and the rate(s) for
  that day, so both clients can show the price without repeating the rules.
  The pitch detail (`getPitchDetail`) returns the base rate and the covered
  rates and seasons for display ("From 1 Nov: 180 RON/h cold air, 220 RON/h
  hot air").
- **Booking create** (`lib/bookings/create.ts`): compute
  `rateFor(pitch, input.date, input.airType)`; reject an `airType` not
  offered that day (`VALIDATION_ERROR`, reason `AIR_NOT_OFFERED`); default
  to COLD when both are offered and none was sent; store `airType` and the
  rate in `pitchRateSnapshot`. Everything downstream (totals, deposit,
  refunds, payouts) already reads the snapshot or `totalAmount`.
- **Discover "price from"**: `priceFrom` stays the lowest uncovered rate.
  Optional: show a "Covered" badge when a venue has a pitch covered today.
- **Emails, pushes, booking detail, manager booking detail, CSV export**:
  add the air type where the time and price are shown ("Hot air"). Search
  for `pitchRateSnapshot` and `paymentStatusLine` to find the places.

### A4. Web UI

- **Pricing tab** (`components/pitch-editor/PricingForm.tsx`): below the
  hourly rate, a "Covered season (winter dome)" section:
  - two checkboxes "Cold air" / "Hot air", each revealing its RON/hour
    input;
  - a list of season date ranges with add/remove, saved straight away like
    blocked dates in `AvailabilityForm.tsx`;
  - the live preview gains a line per offered air type.
- **Booking flow** (`components/booking/`): the time step shows the day's
  price; when both air types are offered, a "Cold air / Hot air" choice
  with each price appears **above** "How long?" (the price per hour
  changes the totals below it). Store `airType` in the draft (`draft.tsx`)
  and show it on the summary and confirmation.
- **Pitch page** (`components/venue/PitchInfo.tsx`, `BookNowPanel.tsx`):
  show the covered prices and the season dates.

### A5. Mobile UI (`apps/mobile/src`)

- `stores/bookingStore.ts`: `airType`, included in `bookingBody`.
- `screens/booking/Step2TimeScreen.tsx`: the same air choice above the
  lengths; prices from the availability response.
- Pitch detail (`components/pitch/PitchSections.tsx` PricingCard): covered
  prices and dates. Summary, confirmation and booking detail show the air.
- The manager's pricing editing stays web-only (as today).

### A6. Tests

- Shared unit tests (`covered.test.ts`): uncovered day, first and last day
  of a season, both / cold-only / hot-only, default COLD, unknown air
  rejected, two seasons.
- API E2E: set rates and a season; availability for a covered day returns
  options and prices; a hot-air booking is priced at the hot rate and keeps
  it after the rates change; HOT on a cold-only day is rejected;
  overlapping seasons rejected.
- Web E2E: the manager sets a season and both rates (with `snap()`
  screenshots); a player books hot air and sees it on the summary,
  confirmation and My bookings. axe stays clean.
- Mobile Jest: the air choice appears only when both are offered and
  changes the price line; the body sent includes `airType`.

---

## B. Subscription or pay-per-booking (C-15)

### B1. Data model

```prisma
enum BillingPlan {
  PER_BOOKING
  SUBSCRIPTION
}

enum SubscriptionStatus {
  NONE          // never subscribed / on per-booking
  ACTIVE
  PAST_DUE      // payment failed, inside the grace period
  PAUSED        // grace period over: no new bookings
  CANCELLING    // ends at period end
}

model Company {
  // …
  billingPlan              BillingPlan        @default(PER_BOOKING)
  subscriptionStatus       SubscriptionStatus @default(NONE)
  stripeCustomerId         String?            // the venue as a Stripe customer (not the manager's player customer)
  stripeSubscriptionId     String?            @unique
  subscriptionPeriodEnd    DateTime?
  subscriptionPastDueSince DateTime?
}

model PlatformConfig {
  // …
  subscriptionMonthlyRon Int     @default(199)   // admin-set; the amount is a placeholder
  stripeSubscriptionPriceId String?             // the Stripe Price the fee maps to
}

model Booking {
  // platformFee already snapshots the commission; 0 for subscribed venues
}
```

- Rule enforced in the API and the settings UI: `paymentMode = VENUE`
  requires `billingPlan = SUBSCRIPTION` with status ACTIVE/PAST_DUE/
  CANCELLING. Changing to VENUE without a subscription is refused with
  reason `SUBSCRIPTION_REQUIRED`, and the UI walks the manager to
  subscribe first.

### B2. Shared rules

- `src/billing.ts`: `commissionFor(company, platformFeePercent)` → 0 when
  `billingPlan = SUBSCRIPTION` and status is not PAUSED/NONE, else the
  percent; `canTakeBookings(company)`; `requiresSubscription(paymentMode)`.
- `bookingPrice` is unchanged: pass the result of `commissionFor` as
  `feePercent`.

### B3. Server

- **Commission**: `lib/bookings/create.ts` takes the fee from
  `commissionFor(...)` instead of `PlatformConfig.platformFeePercent`
  directly. Analytics (`lib/manager/analytics.ts`), admin stats
  (`lib/admin/stats.ts`) and the manager booking detail already read the
  stored `platformFee`, so a 0 shows correctly; label it "Included in your
  subscription" instead of "0 RON".
- **Stripe Billing** (`lib/payments/billing.ts`, new):
  - `startSubscription(companyId)`: create/reuse the venue's Stripe
    customer, a SetupIntent or Checkout-free subscription with
    `payment_behavior: 'default_incomplete'`, return the client secret
    for the card form (the same `CardElement` the player's Payment methods
    page uses).
  - `cancelSubscription(companyId)`: `cancel_at_period_end: true` →
    CANCELLING.
  - Webhooks in the existing `app/api/v1/payments/webhook/route.ts`:
    `invoice.paid` → ACTIVE, period end; `invoice.payment_failed` →
    PAST_DUE, `subscriptionPastDueSince`; `customer.subscription.deleted`
    → NONE + PER_BOOKING (or PAUSED if the venue is cash-only).
  - **Test mode** (no Stripe keys, and in every E2E run): a `test` billing
    provider that activates at once and exposes
    `POST /api/v1/payments/test/subscription { outcome: 'paid'|'failed' }`
    behind `ALLOW_TEST_HOOKS`, mirroring `confirmTest` for bookings.
- **Grace period**: a daily step in an existing cron route (e.g.
  `app/api/v1/cron/auto-complete`, or a new `cron/billing` beside it)
  moves PAST_DUE venues older than 7 days to PAUSED
  and notifies the manager; Discover and booking create treat PAUSED like
  "not taking bookings" (new reason `VENUE_PAUSED`, reusing the
  `notTakingBookings` path). Paying moves it straight back to ACTIVE.
- **API**:
  - `GET /api/v1/manager/billing` → plan, status, period end, monthly
    fee, commission percent, whether cash-only forces the subscription.
  - `POST /api/v1/manager/billing/subscribe`, `POST …/cancel`,
    `PUT …/plan { plan: 'PER_BOOKING' }` (refused for cash-only).
  - Admin: `PUT /api/v1/admin/config` takes `subscriptionMonthlyRon`;
    `GET /api/v1/admin/companies` and the venue page show plan and status.
- **Notifications** (`lib/notifications`, both languages):
  subscription started, payment failed (with the grace end date),
  bookings paused, subscription ended. Email + push to the manager.

### B4. Web UI

- **Manager settings**: a new tab "Plan and billing"
  (`components/manager/SettingsTabs.tsx`, page
  `app/manager/(app)/settings/billing/page.tsx`):
  - two cards side by side: "Pay per booking — {n}% of each booking" and
    "Subscription — {fee} RON/month, no commission", with the current one
    marked;
  - subscribing opens the card form; status line (active until, payment
    failed: update your card by {date}, paused);
  - cash-only venues see the per-booking card disabled with the reason.
- **Payment settings form** (`PaymentSettingsForm.tsx`): choosing "At
  the venue only" without a subscription shows the requirement and a link
  to the billing tab instead of saving.
- **Manager shell**: a banner on every manager page while PAST_DUE or
  PAUSED.
- **Admin**: Platform settings gets the monthly fee; the venue list gets
  a "Plan" column and filter; the venue page shows plan, status and
  period end. The overview's "PitchUp fees" adds subscription revenue
  (sum of paid invoices, read from a new `SubscriptionInvoice` table
  written by the webhook, or from Stripe — the table is simpler to test).
- **Onboarding step 4**: mention the two plans and that the choice is
  made in Settings after approval; no billing during onboarding.

### B5. Mobile

- Nothing for players: prices don't change with the plan.
- Manager screens in the app: show the plan and any PAST_DUE/PAUSED
  banner on Venue bookings and Analytics; managing billing stays web-only.

### B6. Tests

- Shared: `commissionFor` for each plan/status, `requiresSubscription`.
- API E2E: a subscribed venue's booking has `platformFee = 0`; a
  per-booking one keeps the percent; switching to VENUE without a
  subscription is refused; test-provider `failed` → PAST_DUE, 7 days later
  (the cron with an injected clock, as the reminders tests do) → PAUSED and
  booking refused; `paid` → ACTIVE again; old bookings keep their fee.
- Web E2E: manager subscribes in test mode, sees the status; cash-only
  flow; admin changes the fee; axe clean on the new pages.
- Webhook unit tests with a fake Stripe client (`setStripeClientForTests`).

---

## Cross-cutting rules for the implementing session

- **Every new text in English and Romanian** (`apps/web/src/i18n/en|ro`,
  `apps/mobile/src/i18n/en|ro`, shared words in
  `packages/shared/src/i18n`). The Romanian file is typed against the
  English one, so `tsc` lists anything missing. API errors are thrown as
  `api.*` keys with params.
- **Snapshot, don't recompute**: price, air type and commission are stored
  on the booking at creation; nothing reprices an existing booking.
- **Clients branch on `code` / `details.reason`**, never on the message.
- Tests: E2E runs with `DEFAULT_LOCALE=en` and blank Stripe keys; keep it
  that way. `pnpm` checks before committing: `tsc` (shared, web, mobile),
  `eslint`, shared+web `vitest`, mobile `jest`, full Playwright run.
- Mobile is checked with Jest only; it is not built or run in that session.
- Docs: HANDOVER (C-14, C-15 sections, the decisions above), ARCHITECTURE
  (a section on seasonal pricing as data, and on subscriptions vs
  commission and snapshotting the fee), TESTING (the billing test hooks).
- Never commit: `README.md`, the root `package.json`, `.claude/`,
  `docs/PRODUCT_GAPS_AND_ROADMAP.md`, `.env`, the Firebase config files.
  Scan staged files for `AIzaSy`, private keys and `GOCSPX` before each
  commit.

## Suggested order (each a commit with green checks)

1. A1–A2: schema, shared rules and their tests.
2. A3: server (pricing API, seasons API, availability, create, displays).
3. A4–A5: web pricing tab and booking flow, then mobile; E2E and Jest.
4. B1–B2: schema, shared billing rules, commission snapshot in create.
5. B3: test billing provider, Stripe Billing, webhooks, grace period.
6. B4–B5: manager billing tab, payment-mode rule, banners, admin; tests.
7. Docs and a full run of every check.

## Open questions to confirm with the owner before step 4

- The monthly fee amount (the plan uses 199 RON as a placeholder) and
  whether VAT is included.
- Whether the fee should depend on the number of pitches later (the model
  allows adding tiers without migration pain if `subscriptionMonthlyRon`
  becomes a small table).
- Whether a trial month is offered to new venues.
