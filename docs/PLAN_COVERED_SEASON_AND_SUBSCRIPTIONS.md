# Plan: covered-season pricing (dome, cold/hot air) and venue subscriptions

Written 2026-10-21 for a separate implementation session. Two features, built
in this order: **A. Covered season** (C-14) and **B. Venue subscriptions,
no commission** (C-15). A is built (commit 38545c6, branch
`feat/covered-season`); B was reshaped by the owner on 2026-10-21, see the
subscription decisions below.

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

**Subscriptions** (updated 2026-10-21)

- **PitchUp no longer takes a commission at all.** Its only income is the
  venues' subscription. There is no pay-per-booking plan, so the old rule
  "cash-only venues must subscribe" is gone: every venue subscribes.
- **Prices** (B0): 10 lei/month or 100 lei/year the first year, 30 or 300
  after, +5 lei/month (+50/year) for each active pitch beyond 2. VAT
  included. A **free trial month**, card on file first.
- **When**: onboarding is unchanged. After the admin approves a venue, the
  manager subscribes in Settings (adds a card); the free month starts then.
- **A venue without a running subscription** (never subscribed, or unpaid
  after the grace period) is **hidden from Discover and takes no new
  bookings**, but keeps the bookings it has. Subscribing or paying brings
  it back at once, without an admin.
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
5. **The subscription prices are platform-wide**, set by the admin in
   Platform settings (`PlatformConfig`) in place of the commission; the
   owner's prices are the defaults (B0). Per-venue negotiated prices are
   out of scope.
6. **The commission goes completely, history included** (owner: the app
   is in test mode only, old fees don't matter). `Booking.platformFee`,
   `PlatformConfig.platformFeePercent`, `PLATFORM_FEE_PERCENT`, the fee
   and payout figures in analytics, the CSV and the admin stats, and every
   "commission" / "you receive" line are removed.
7. **An unpaid subscription pauses the venue** after a 7-day grace period
   (`PAUSED`: hidden and not bookable, like never subscribed). It is not a
   suspension: paying lifts it at once without an admin.
8. **Changing monthly/yearly takes effect at the next renewal.** Cancelling
   ends the subscription at the end of the paid period (Stripe
   `cancel_at_period_end`); the venue then stops taking new bookings.
9. **Existing live venues** (the seed, and any made before C-15) get a
   trial when the change is deployed: a one-off step in the seed and a
   short script, documented in HANDOVER, sets them to `TRIALING` with a
   30-day `trialEndsAt` and no card (they are asked to add one). E2E's
   `createVenue` makes venues `ACTIVE` in test mode so existing tests keep
   working.

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

## B. Venue subscriptions, no commission (C-15)

### B0. The price (owner's answers, 2026-10-21)

All prices **include VAT**. The venue chooses to pay monthly or yearly;
yearly is always 10 × monthly.

|                            | Monthly | Yearly  |
| -------------------------- | ------- | ------- |
| First year (discount)      | 10 lei  | 100 lei |
| From the second year       | 30 lei  | 300 lei |
| Each active pitch beyond 2 | +5 lei  | +50 lei |

- **Free trial month for new venues.** The manager adds a card when
  subscribing; nothing is charged for 30 days. One trial per venue, ever.
  The venue is live during the trial.
- **The first year starts when the trial ends**: the first 12 months that
  are paid for. A yearly plan bought in the first year costs 100 lei and
  renews at 300; on a monthly plan the 13th paid month is the first at 30.
- **Pitches counted are the active ones** (players can book them),
  counted when each period is billed. Switching a pitch on or off mid-period
  changes nothing until the next bill. Example: 4 active pitches in the
  first year = 10 + 2 × 5 = 20 lei/month, or 100 + 2 × 50 = 200 lei/year.
- All seven numbers (two discounted bases, two standard bases, two
  extra-pitch fees, pitches included) and the trial length are admin
  settings, with these as defaults.

### B1. Data model

```prisma
enum BillingInterval {
  MONTHLY
  YEARLY
}

enum SubscriptionStatus {
  NONE          // never subscribed: hidden, no new bookings
  TRIALING      // the free month (card on file, nothing charged yet)
  ACTIVE
  PAST_DUE      // payment failed, inside the 7-day grace: still bookable
  PAUSED        // grace over, or the subscription ended: hidden, no new bookings
  CANCELLING    // runs to the end of the paid period, then PAUSED
}

model Company {
  // …
  subscriptionStatus       SubscriptionStatus @default(NONE)
  billingInterval          BillingInterval?
  stripeCustomerId         String?            // the venue as a Stripe customer (not the manager's player customer)
  stripeSubscriptionId     String?            @unique
  trialEndsAt              DateTime?          // set once: one trial per venue
  /// When the first paid period began (the trial's end): year one runs 12 months from here.
  firstPaidAt              DateTime?
  subscriptionPeriodEnd    DateTime?
  subscriptionPastDueSince DateTime?
}

model PlatformConfig {
  // platformFeePercent is removed (C-15: no commission).
  // Prices in lei, VAT included.
  subIntroMonthlyRon      Int @default(10)
  subIntroYearlyRon       Int @default(100)
  subMonthlyRon           Int @default(30)
  subYearlyRon            Int @default(300)
  subExtraPitchMonthlyRon Int @default(5)
  subExtraPitchYearlyRon  Int @default(50)
  subIncludedPitches      Int @default(2)
  subTrialDays            Int @default(30)
  stripeBillingProductId  String?   // one Stripe Product; prices are sent inline per bill
}

/// What a venue paid PitchUp: written by the webhook (or the test provider).
model SubscriptionInvoice {
  id              String   @id @default(cuid())
  companyId       String
  amountRon       Decimal  @db.Decimal(10, 2)
  interval        BillingInterval
  periodStart     DateTime
  periodEnd       DateTime
  stripeInvoiceId String?  @unique
  paidAt          DateTime
}
```

- `Booking.platformFee` and `PlatformConfig.platformFeePercent` are
  dropped: a `db push --accept-data-loss` on dev (test data only).

### B2. Shared rules (`packages/shared/src/billing.ts`)

- `isSubscribed(status)`: TRIALING, ACTIVE, PAST_DUE, CANCELLING. A venue
  takes bookings and shows in Discover only when it is ACTIVE (approved)
  **and** subscribed.
- `subscriptionPrice({ interval, firstPaidAt, periodStart, activePitches }, prices)`
  → `{ base, extraPitches, extraEach, total, discounted }`: the discounted
  base while `periodStart` is before `firstPaidAt` + 12 months (or no
  period has been paid yet), the standard one after, plus the extra-pitch
  fee for each active pitch beyond the included ones. Unit-tested on the
  B0 table and the year-one/year-two boundary for both intervals.
- `bookingPrice(hourlyRate, minutes)` loses its commission: it returns the
  total only (`platformFee` and `venuePayout` go, along with
  `PLATFORM_FEE_PERCENT`). Every caller is updated; the compiler lists them.
- `analytics.ts` loses `feeRate`, `feesOn` and the fee/payout figures: a
  venue's earnings are what players paid.

### B3. Server

- **No commission** (`lib/bookings/create.ts`): no fee is computed or
  stored; the `platformConfig()` read for the fee goes. Booking create and Discover
  refuse / hide a venue that is not subscribed: reason `VENUE_PAUSED`
  (`api.notTakingBookings`), and the same check in the pitch detail's
  `isBookable` and the company page.
- **Admin config** (`lib/admin/config.ts`, `PUT /admin/config`): the
  commission field is replaced by the eight subscription settings.
- **Stripe Billing** (`lib/payments/billing.ts`, new):
  - `startSubscription(companyId, interval)`: create/reuse the venue's
    Stripe customer and a SetupIntent for the card (the same `CardElement`
    the player's Payment methods page uses); once the card is saved,
    create the subscription with `trial_period_days` (first time only)
    and one item priced inline (`price_data` on the PitchUp product) at
    `subscriptionPrice(...).total` for the interval → TRIALING (or ACTIVE
    when the trial was used before).
  - **Repricing each period**: the amount changes at the end of year one
    and with the number of active pitches. A daily cron step updates the
    subscription's item a day before `subscriptionPeriodEnd` to the next
    period's `subscriptionPrice` (`proration_behavior: 'none'`), so the
    next bill is right. Tested with an injected clock.
  - `changeInterval(companyId, interval)`: at the next renewal.
  - `cancelSubscription(companyId)`: `cancel_at_period_end: true` →
    CANCELLING; `resume` undoes it before the period ends.
  - Webhooks in the existing `app/api/v1/payments/webhook/route.ts`:
    `invoice.paid` → ACTIVE, period end, `firstPaidAt` on the first paid
    invoice, a `SubscriptionInvoice` row; `invoice.payment_failed` →
    PAST_DUE, `subscriptionPastDueSince`; `customer.subscription.deleted`
    → PAUSED.
  - **Test mode** (no Stripe keys, and in every E2E run): a `test` billing
    provider that saves no card, starts the trial at once, and exposes
    `POST /api/v1/payments/test/subscription { outcome: 'paid'|'failed' }`
    behind `ALLOW_TEST_HOOKS`, mirroring `confirmTest` for bookings.
- **Daily billing cron** (`app/api/v1/cron/billing`, new, beside the other
  jobs, same bearer secret): PAST_DUE over 7 days → PAUSED; a trial that
  ended without a card (the migrated venues of decision 9) → PAUSED;
  repricing before renewals; the manager is told each time.
- **API**:
  - `GET /api/v1/manager/billing` → status, interval, trial end, period
    end, the next bill (amount, base, extra pitches) and what each
    interval would cost this venue now.
  - `POST /api/v1/manager/billing/subscribe { interval }`, `POST …/cancel`,
    `POST …/resume`, `PUT …/interval { interval }`.
  - Admin: `GET /api/v1/admin/companies` and the venue page show status,
    interval and period end; `GET /admin/stats` reports subscription
    revenue from `SubscriptionInvoice`.
- **Notifications** (`lib/notifications`, both languages): trial started
  (with its end), trial ending in 3 days, payment failed (with the grace
  end), venue paused, subscription ended. Email + push to the manager.

### B4. Web UI

- **Manager settings**: a new tab "Subscription"
  (`components/manager/SettingsTabs.tsx`, page
  `app/manager/(app)/settings/billing/page.tsx`): monthly / yearly choice
  with this venue's price and its breakdown ("10 lei + 2 extra pitches ×
  5 lei"), the discount note for year one, the card form, then the status
  (trial until, renews on, payment failed: update your card by {date},
  paused), Cancel / Resume, and the paid invoices.
- **Manager shell**: a banner on every manager page while NONE ("Your
  venue isn't live yet: start your free month"), PAST_DUE or PAUSED.
- **Remove the commission everywhere**: the pricing preview ("after
  PitchUp's 8% commission"), the manager booking detail's commission and
  "you receive" rows, the analytics fee/payout figures and CSV columns,
  the admin config field. Wording like "the price is all
  yours" where it helps.
- **Admin**: Platform settings gets the subscription prices and trial
  length; the venue list gets a "Subscription" column and filter; the
  venue page shows status, interval and period end; the overview's
  "PitchUp fees" becomes "PitchUp revenue" from paid subscriptions.
- **Onboarding step 4 / approval email**: say the venue goes live after
  starting its free month in Settings; no billing during onboarding.

### B5. Mobile

- Nothing changes for players.
- Manager screens: the commission line goes from the booking detail; a
  NONE/PAST_DUE/PAUSED banner on Venue bookings and Analytics; managing
  the subscription stays web-only (the banner says so).

### B6. Tests

- Shared: `isSubscribed` per status; `subscriptionPrice` on the B0 table,
  the year boundary, extra pitches, both intervals; `bookingPrice` without
  a fee.
- API E2E: no fee anywhere in booking, analytics or admin responses; an
  approved venue without
  a subscription is hidden from Discover and refuses bookings
  (`VENUE_PAUSED`); subscribing in test mode → TRIALING and bookable;
  `paid` → ACTIVE with a `SubscriptionInvoice`; `failed` → PAST_DUE, still
  bookable; 7 days later (the cron with an injected clock, as the
  reminders tests do) → PAUSED and refused; `paid` → ACTIVE again;
  repricing after 12 paid months and with a third active pitch.
- Web E2E: the manager starts the free month in test mode and sees the
  status; the NONE banner; the admin changes a price; axe clean on the new
  pages; no "commission" text left on the pricing tab or booking detail.
- Webhook unit tests with a fake Stripe client (`setStripeClientForTests`).

---

## Cross-cutting rules for the implementing session

- **Every new text in English and Romanian** (`apps/web/src/i18n/en|ro`,
  `apps/mobile/src/i18n/en|ro`, shared words in
  `packages/shared/src/i18n`). The Romanian file is typed against the
  English one, so `tsc` lists anything missing. API errors are thrown as
  `api.*` keys with params.
- **Snapshot, don't recompute**: price and air type are stored on the
  booking at creation; nothing reprices an existing booking.
- **Clients branch on `code` / `details.reason`**, never on the message.
- Tests: E2E runs with `DEFAULT_LOCALE=en` and blank Stripe keys; keep it
  that way. `pnpm` checks before committing: `tsc` (shared, web, mobile),
  `eslint`, shared+web `vitest`, mobile `jest`, full Playwright run.
- Mobile is checked with Jest only; it is not built or run in that session.
- Docs: HANDOVER (C-14, C-15 sections, the decisions above), ARCHITECTURE
  (a section on seasonal pricing as data, and one on moving from a
  commission to subscriptions), TESTING (the billing test hooks).
- Never commit: `README.md`, the root `package.json`, `.claude/`,
  `docs/PRODUCT_GAPS_AND_ROADMAP.md`, `.env`, the Firebase config files.
  Scan staged files for `AIzaSy`, private keys and `GOCSPX` before each
  commit.

## Suggested order (each a commit with green checks)

1. A1–A2: schema, shared rules and their tests.
2. A3: server (pricing API, seasons API, availability, create, displays).
3. A4–A5: web pricing tab and booking flow, then mobile; E2E and Jest.
4. B1–B2: schema, shared billing rules, the commission removed everywhere.
5. B3: test billing provider, Stripe Billing, webhooks, billing cron,
   hiding unsubscribed venues.
6. B4–B5: subscription tab, banners, admin; tests.
7. Docs and a full run of every check.

## Questions answered by the owner (2026-10-21)

See B0: 10/100 lei the first year, 30/300 after, +5/+50 lei per active
pitch beyond 2, VAT included, a free month with a card on file, and the
discounted year starting when the trial ends. Then: no commission at all;
venues without a running subscription are hidden and take no new
bookings; venues subscribe after approval, in Settings.
