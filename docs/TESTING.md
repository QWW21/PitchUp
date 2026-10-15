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
  rules (price, refund windows, slot selection); and the Stripe code against
  a fake SDK, including webhook signatures checked by the real one. They run
  in seconds.
- **Mobile** tests render the E02 auth screens (onboarding, login, both
  registration steps, email verification, forgot password) with a fake
  navigator and a mocked API, render components with fixture data, and
  the booking flow and My Bookings (list, detail, cancel sheet, dispute,
  review), and
  exercise the stores, the API client's refresh logic (one shared refresh; sign-out when it
  fails) and location permission handling, with native modules mocked once in
  `apps/mobile/jest.setup.js`. They do not replace testing on a device.
- **API** tests call every endpoint over HTTP against a real server and
  database: auth (enumeration, refresh rotation and reuse detection, Bearer
  auth, phone OTP, reset ending sessions), Discover filters/sorting/paging,
  company and pitch detail, availability, reviews, bookings and payments
  (double-booking race, 15-minute hold, refunds, ownership), My Bookings
  (tabs and pagination, settling finished bookings, the timeline, the three
  refund tiers, disputes, reviews and their windows), and the E01
  infrastructure
  (no schema drift, an idempotent seed, the admin's bcrypt cost, the health
  envelope, the rate limiter, no server secret in the client bundle). They
  replaced `scripts/verify-e01.sh`, `verify-shared.ts`, `verify-e03.ts` and
  `verify-e04.ts`.
- **Browser E2E** drives the real pages: every web auth flow and the player
  pages (Discover, map, company, pitch, Book Now) and the five-step booking
  flow with test payments (success, decline, a slot taken meanwhile), and My
  Bookings (tabs, cancel, review create/edit/delete, dispute), at 1280px and
  375px.
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
