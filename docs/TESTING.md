# Testing

Five layers, each runnable on its own and all run by CI
(`.github/workflows/ci.yml`) on every push to `main` and every pull request.
Tracked under the **E16 — Testing** milestone (#178–#187, #189–#192).

| Layer         | Tool                        | Where                              | Command            | Needs    |
| ------------- | --------------------------- | ---------------------------------- | ------------------ | -------- |
| Unit — shared | Vitest                      | `packages/shared/src/**/*.test.ts` | `pnpm test`        | nothing  |
| Unit — web    | Vitest                      | `apps/web/src/**/*.test.ts`        | `pnpm test`        | nothing  |
| Unit — mobile | Jest + RN Testing Library   | `apps/mobile/src/**/*.test.ts(x)`  | `pnpm test:mobile` | nothing  |
| API           | Playwright (`api` project)  | `apps/web/e2e/api/*.spec.ts`       | `pnpm test:e2e`    | Postgres |
| Browser E2E   | Playwright Chromium (`web`) | `apps/web/e2e/web/*.spec.ts`       | `pnpm test:e2e`    | Postgres |
| Accessibility | axe-core in Playwright      | `apps/web/e2e/web/a11y.spec.ts`    | `pnpm test:e2e`    | Postgres |

## What each layer is for

- **Unit** tests cover rules with no I/O: the venue clock and DST
  (`schedule.ts`), opening hours and overnight venues, nearest-city snapping,
  the Discover query string, schemas, rating rules, URL state, the
  open-redirect guard (#172), phone normalisation (#174), mobile tokens, and
  the E01 rules: PRD constants, booking/review/pitch schemas, environment
  validation, the Prisma singleton and Cloudinary upload signing; booking
  rules (price, refund windows, slot selection); the onboarding schemas
  (company info, location, hours, the admin's reason); start times and
  durations (C-6); paying at the venue (C-8: who may, the deposit split,
  the wording); the pitch editor's rules (E10: pitch hours inside the
  venue's, interval overlap, custom sizes, pricing limits, shirt sets); the
  manager's booking rules (E11: the no-show window, slots, list filters);
  the trust engine (E12: deltas, tiers, replaying a history, late-cancel
  windows, the booking gate); where a notification leads and what can be
  muted (E13); push over FCM with a really signed JWT against a fake Google
  (E13-02); and the Stripe code against
  a fake SDK, including webhook signatures checked by the real one. They run
  in seconds.
- **Mobile** tests render the E02 auth screens (onboarding, login, both
  registration steps, email verification, forgot password) with a fake
  navigator and a mocked API, render components with fixture data, and
  the booking flow, My Bookings (list, detail, cancel sheet, dispute,
  review), My reviews (optimistic delete) and the review sort pills, the
  profile screens (profile, trust score, edit, password, delete, cards,
  notifications) and push routing, the manager's venue bookings (E11-09:
  filters, opening one, a no-show asked about first), notification
  settings (E13-09: channels, muting a group, no phone, a failed save), and
  exercise the stores, the API client's refresh logic (one shared refresh; sign-out when it
  fails) and location permission handling, with native modules mocked once in
  `apps/mobile/jest.setup.js`. They do not replace testing on a device.
- **API** tests call every endpoint over HTTP against a real server and
  database: auth (enumeration, refresh rotation and reuse detection, Bearer
  auth, phone OTP, reset ending sessions), Discover filters/sorting/paging,
  company and pitch detail, availability, reviews, bookings and payments
  (double-booking race, 15-minute hold, refunds, ownership), My Bookings
  (tabs and pagination, settling finished bookings, the timeline, the three
  refund tiers, disputes, reviews and their windows), reviews (sorting,
  replies and their 24-hour window, reports, a player's own reviews, the
  manager's list with filters and search), the profile (no secrets, partial
  updates, phone re-verification, trust tiers and history, password change
  ending sessions, account deletion and its refunds, notifications, device
  tokens), onboarding (who may onboard, each step's checks, one company per
  manager, payouts before the earlier steps refused, Stripe Connect in test
  mode, submission), venue approval (admin only, approve, send back and
  submit again) and the manager's numbers for today, paying at the venue
  (the setting, the trust gate, deposit-only charges, no-deposit bookings,
  Confirm attended refunding a deposit once, no-shows and their trust
  penalty, another venue kept out), managing pitches (E10: who may,
  default dimensions, partial edits, ten photos and concurrent uploads,
  reorder and its out-of-date check, switching on, pricing, amenities,
  shirts promised to bookings, pitch hours deciding the slots, blocked
  dates, soft delete), the venue's bookings (E11: who may, filters and
  pages, the week feed, the booking with the player's history, the no-show
  window, completing, free time, the nightly job and its token), trust (E12: +2
  per game and the monthly cap, late cancellations, the review point, a
  pitch's minimum, Poor and Suspended limits, disputes either way, the
  monthly recovery and correction), notifications (E13: preferences,
  a paid booking emailed, muted kinds not written, the tier-change notice,
  the unread count, the hourly job's reminders, text messages and outbox
  sweep), and the E01
  infrastructure
  (no schema drift, an idempotent seed, the admin's bcrypt cost, the health
  envelope, the rate limiter, no server secret in the client bundle). They
  replaced `scripts/verify-e01.sh`, `verify-shared.ts`, `verify-e03.ts` and
  `verify-e04.ts`.
- **Browser E2E** drives the real pages: every web auth flow and the player
  pages (Discover, map, company, pitch, Book Now) and the five-step booking
  flow with test payments (success, decline, a slot taken meanwhile), and My
  Bookings (tabs, cancel, review create/edit/delete, dispute), My reviews,
  the manager's reviews page (filter, search, reply, edit, delete, report),
  sorting and reporting on public reviews, the pitch page's JSON-LD, and the
  profile pages (settings, trust score, password, payment methods, account
  deletion), manager onboarding (the four steps and their errors, no
  skipping ahead, under review, admin approval, sent back with a reason),
  the manager shell and who is kept out of it, start time then duration
  (C-6), the no-shirts note (C-7), paying at the venue and the manager's
  Bookings and Settings pages (C-8), the pitch list and every tab of the
  pitch editor (E10), the bookings list with URL filters and CSV export, the
  booking page and the week calendar (E11), a pitch's trust minimum and
  the player told why, and deciding a dispute (E12), the notification bell
  and the notification settings page (E13), at 1280px and 375px.
- **Accessibility** scans every web page, dialog and error state with axe-core
  against WCAG 2.1 A and AA; any violation fails the test with the rule and
  the elements. The map's Google canvas is left out. To pass colour contrast,
  a few web tokens are one shade darker than UIUX_SPEC §2.1 (marked `AA` in
  `apps/web/tailwind.config.ts`). The mobile palette has not been checked.

## How the E2E run is isolated

`playwright.config.ts` starts its own server:

1. `e2e/prepare-db.ts` recreates the **`pitchup_test`** database
   (`prisma db push --force-reset`) and runs the seed. It refuses any database
   whose name does not contain `test`.
2. `next build`, then `next start --port 3100` with `DATABASE_URL` pointing at
   the test database and `ALLOW_TEST_HOOKS=1`.

The build goes to **`.next-e2e`**, not `.next`: building into the folder a
running `pnpm dev` serves from broke that dev server. And the run **blanks
every integration key** (Stripe, Resend, Twilio, Cloudinary), so it always
uses test payments, logged emails and SMS, and no uploads, whatever real keys
are in `apps/web/.env`. Without that, a developer's Resend key made every test
registration send a real email to a made-up address, and fail.

`ALLOW_TEST_HOOKS=1` enables `POST /api/v1/dev/reset-rate-limits` on that
production build, so tests can clear the in-memory rate limits between cases.
It is never set anywhere else; without it the route is a 404 outside dev.

Tests run one at a time (`workers: 1`): they share one seeded database and a
few change it (a trust score, a booking, a password), always putting it back.
What a test cannot get through the UI — a verification code or reset token,
which are stored only as hashes — it writes directly with
`e2e/support/db.ts`.

Useful variants:

```bash
pnpm --filter @pitchup/web test:e2e -- --project=api   # API only
E2E_SKIP_BUILD=1 pnpm test:e2e                          # reuse the last build
pnpm --filter @pitchup/web exec playwright show-report  # open the HTML report
E2E_DATABASE_URL=postgresql://…/other_test pnpm test:e2e
```

## Screenshot evidence

Browser tests call `snap()` at each meaningful state. Every screenshot is
attached to the Playwright HTML report. With `EVIDENCE=1` they are also
written to `docs/test-evidence/web/<area>/<name>.jpg`:

```bash
pnpm --filter @pitchup/web test:e2e:evidence
```

That folder is the committed record linked from the testing issues. Refresh
it when a page changes visibly. The map screenshots show real tiles only when
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is in `apps/web/.env` at build time;
without a key the map test checks the "needs a key" message instead (as in CI).

Mobile screenshots come later (#187), after manual testing on a device.

## CI

Three jobs: **Lint + typecheck**, **Unit** (Vitest + Jest) and **API + web
E2E** (Postgres 16 service, Chromium). The E2E job uploads the HTML report and
failure screenshots/traces as the `playwright-report` artifact.

`pnpm format:check` is not in CI yet: on a Windows checkout it reports most of
the repo because of CRLF line endings, so its real state on Linux needs
checking first.

## Writing new tests

- Pure logic → a `*.test.ts` next to the file, in Vitest (or Jest for mobile).
- An endpoint → `apps/web/e2e/api/<area>.spec.ts`, using `get`/`post` from
  `e2e/support/api.ts`.
- A page → `apps/web/e2e/web/<area>.spec.ts`; use roles and labels to find
  elements, `formAlert(page)` for a form's error (Next renders its own hidden
  `role="alert"`), and `snap()` for evidence.
- A fixture that depends on "now" (a booking happening right now) is created
  by the test itself and removed afterwards; seeded ones age.
