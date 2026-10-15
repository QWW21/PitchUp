# Where things stand

Last updated at the end of the session that implemented E04 (Player: Pitch Detail).

## Done

**E01 — Infrastructure: complete.** All ten tickets closed.
Its acceptance checks run with the test suite: `apps/web/e2e/api/infra.spec.ts`
and `apps/web/src/lib/infra.test.ts` (they replaced `scripts/verify-e01.sh`).

**E02 — Auth: all fourteen tickets implemented.**

| Ticket                          | State                                              |
| ------------------------------- | -------------------------------------------------- |
| E02-01 splash + onboarding      | done — 3 slides, AsyncStorage flag                 |
| E02-02 registration step 1      | done — name, email, E.164 phone, city picker       |
| E02-03 registration step 2      | done — DOB with age ≥ 16, password policy          |
| E02-04 phone OTP verification   | done — 6-box OTP, 60s resend cooldown              |
| E02-05 login                    | done                                               |
| E02-06 forgot password          | done                                               |
| E02-07 social login             | placeholder only — needs OAuth credentials         |
| E02-08 backend auth             | done — register, login, refresh, logout, verify    |
| E02-09 Resend email             | done — adapter + templates, inactive without a key |
| E02-10 Twilio SMS               | done — adapter, inactive without credentials       |
| E02-11 password reset           | done                                               |
| E02-12 mobile API client        | done — authApi, authStore, navigation wiring       |
| E02-13 web manager login        | done                                               |
| E02-14 web manager registration | done                                               |

E02-07 is the only one not really finished: `SocialLoginScreen` is a "coming
soon" placeholder. Google and Apple sign-in both need native configuration
(`GoogleService-Info.plist`, `google-services.json`, OAuth client IDs) that
nobody has credentials for yet.

**The Android app builds and runs.** Verified on a Pixel 9 Pro XL emulator:
the app launches, Metro serves the bundle, and the onboarding screen renders.
See "React Native version constraints" below before touching mobile deps —
that is where most of the work went.

Web pages added since the last handover: `/forgot-password`,
`/registration-confirmed`, a sign-out button on the dashboard, and `/` now
redirects to `/login` or `/dashboard` instead of showing a placeholder.

**E03 — Player: Discover: all eight tickets implemented.**

| Ticket                           | State                                                        |
| -------------------------------- | ------------------------------------------------------------ |
| E03-01 `GET /companies`          | done — every filter, sort and pagination; 45 checks pass     |
| E03-02 location + city detection | done — permission flow, nearest-city match, CityBlocker      |
| E03-03 city selector             | done — diacritic-insensitive search, detect row              |
| E03-04 Discover list screen      | done — header, banner, debounced search, sort chips, paging  |
| E03-05 CompanyCard + states      | done — skeleton shimmer, empty, error                        |
| E03-06 filters sheet             | done — chips, amenity grid, twin-thumb price slider, toggles |
| E03-07 map view                  | done — price pills, clustering, preview sheet, my-location   |
| E03-08 web `/discover`           | done — sidebar/drawer, URL state, city dialog, map           |

The E03-01 acceptance checks are API tests (`apps/web/e2e/api/discover.spec.ts`),
the opening-hours and nearest-city helpers unit tests. The seed now creates
sixteen Discover venues with pitches, amenities, hours, bookings and reviews;
see README "Seeded accounts".

**E04 — Player: Pitch Detail: all eight tickets implemented.**

| Ticket                                 | State                                                                 |
| -------------------------------------- | --------------------------------------------------------------------- |
| E04-01 `GET /companies/:id`            | done, verified — hours as 7 days, pitch summaries, ratings            |
| E04-02 `GET /pitches/:id`              | done, verified — photos, amenities, shirts, 3 recent reviews          |
| E04-03 `GET /pitches/:id/availability` | done, verified — 30-min slots in venue time, closures, overnight      |
| E04-04 mobile Company Detail           | built — collapsing header, hero, hours accordion, sticky tabs         |
| E04-05 mobile Pitch Detail             | built — gallery + lightbox, amenities, pricing, collapsible text      |
| E04-06 mobile availability + Book Now  | built — 7-day dots, reviews preview, footer with disabled states      |
| E04-07 reviews list                    | `GET /reviews` done and verified; mobile breakdown + cards built      |
| E04-08 web company + pitch pages       | done, verified in a browser — SSR, tabs, gallery, sidebar, 7-day grid |

The backend acceptance checks are API tests (`apps/web/e2e/api/venues.spec.ts`). The seed
now gives the Discover venues photos (placeholder images), descriptions,
dimensions, peak hours, shirt rental, review text with a manager reply and an
anonymous review, fourteen reviews on Cluj Arena Park for paging, and on Arena
Gheorgheni Teren 1 a booking tomorrow 18:00–20:00, a fully booked day after
tomorrow and a maintenance closure the day after that. Zorilor closes on Sundays.

Book Now (web and mobile) opens a placeholder until E05: `/booking/new` on the
web, the `BookingFlow` route in the app.

**Fixed along the way — mobile API auth.** `requireAuth` only read the web
cookie, so every authenticated call from the app, `/me` included, was a 401;
`checkSession` would have signed the user out on every launch. It now accepts
the mobile Bearer access token too (re-reading the user, so a deleted account
stops working at once). Verified with a real token from
`/auth/mobile/login`. `/me` also returns `trustScore` now.

## Next

**E05 — Player: Booking Flow** replaces the two Book Now placeholders. The
availability endpoint it needs (E04-03) is done; its `past` slot status and
venue-time conversion (`venueTimeToUtc`, `openIntervalsOn` in
`packages/shared/src/schedule.ts`) are what the slot picker should use.

**How testing is split from E03 on:** backend and web are verified as part of
each epic; mobile is built to the point of compiling and bundling, then
handed to a separate mobile tester. So E03-01 (#25) and E03-08 (#32) close
with the epic, while the six mobile tickets (#26–#31) stay open with a
"built, awaiting mobile testing" comment listing what to check. The tester
closes them.

GitHub state for E03 is scripted like E02's:
`GITHUB_TOKEN=… bash scripts/github/state.sh e03-close e03-bugs e03-gaps`.
Comment bodies are in `scripts/github/bodies/e03/`. The script needs `bash`
and `jq`. It files two already-fixed defects (map pills ignoring clicks; the
lockfile's Artifactory URLs) and three follow-ups (mobile tab bar, mobile
sign-out, Lighthouse for `/discover`).

**E02-07 (social login)** is still open, blocked on credentials rather than
on code.

**Tests (E16, #178–#187, #189–#192)** — see `docs/TESTING.md`. Unit (Vitest:
shared + web), mobile (Jest + RN Testing Library, including the E02 auth
screens), API and browser E2E (Playwright on its own `pitchup_test` database,
production build on :3100), accessibility (axe-core, WCAG 2.1 AA on every web
page) and CI running all of it. E01–E04 are covered in every layer that
applies to them; nothing runs on a real device yet. Web screenshot evidence
lives in `docs/test-evidence/web/`. Mobile device tests and screenshots (#187)
wait for the manual mobile pass. New
features should land with tests in the matching layer.

Worth doing before moving on, not a ticket:

- **iOS has never built.** It is stuck at a linker error; see the known gaps.

## React Native version constraints

The app is pinned to **React Native 0.76.0**, and several packages in the tree
have moved on to APIs that only exist in 0.77+. This caused four separate
Android build failures and is the reason for the pins and patches below.
Read this before bumping any mobile dependency.

| Package                       | Pinned at | Why                                                                                                                                                                                                                                                              |
| ----------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-native-screens`        | `4.16.0`  | 4.17.0+ uses Kotlin APIs added after 0.76 (`ReactPointerEventsView.getPointerEvents`, `getFabricUIManagerNotNull`, the `EdgeInsets` safe-area types). 4.16.0 is the last release that compiles.                                                                  |
| `react-native-maps`           | `1.29.11` | Works, but needs two patches — see below.                                                                                                                                                                                                                        |
| `androidx.core` / `-ktx`      | `1.15.0`  | Forced in `apps/mobile/android/app/build.gradle`. 1.17.0 demands compileSdk 36 and AGP 8.9.1; RN 0.76 pins AGP 8.6.0 / compileSdk 35.                                                                                                                            |
| `@react-native/gradle-plugin` | `0.76.0`  | Declared as an explicit devDependency. It is a transitive dep of `react-native`, so pnpm hoists it to the repo root and never links it into `apps/mobile/node_modules`, which is exactly where `settings.gradle` looks for it. Same for `@react-native/codegen`. |

Three patch files in `patches/`, all applied through `pnpm.patchedDependencies`
in the root `package.json`:

- **`@react-native__codegen@0.76.0.patch`** — five fixes to the TypeScript
  component parser (`TSQualifiedName` nodes, `CT.WithDefault` unwrapping,
  `ComponentRef`, `TSArrayType` element types, `isEvent()`).
- **`react-native-maps@1.29.11.patch`** — adds the empty
  `ViewManagerWithGeneratedInterface` marker class that RN 0.76 does not ship
  but the generated view managers extend, and guards the call to
  `target_compile_reactnative_options()` in the JNI `CMakeLists.txt` (an RN
  0.77 helper). Without the second fix the codegen sources compile without
  `-std=c++20` and fail on the C++20 in React Native's own headers.
- **`react-native-screens@4.29.0.patch`** — **currently orphaned.** It is not
  referenced from `patchedDependencies` any more, because rn-screens is pinned
  to 4.16.0. It is kept on disk because it holds the iOS fixes from an earlier
  session (eight files, mostly the removed `EventQueue::UpdateMode` argument)
  and would be expensive to recreate. Delete it once iOS is confirmed working
  on 4.16.0.

The long-term fix for all of this is to upgrade React Native. These pins are
holding the tree at a version the ecosystem has moved past.

### Metro port

Metro runs on **8082**, not React Native's default 8081, to avoid colliding
with other RN projects. `pnpm android` and `pnpm ios` pass `--port 8082` so
the app looks for the bundler in the right place. Launching the app any other
way without that flag fails with "Unable to load script".

## Decisions that are settled

- **Trust score is 0–100** with Excellent / Good / Fair / Poor / Suspended,
  per PRD §9.1. The epic scripts were reconciled to match in 4285591. The
  0–1000 BRONZE…PLATINUM scheme some tickets described is gone.
- **Build order is by dependency, not ticket number.** Backend first, then
  web, then mobile.
- **Providers stay inactive until the end of the epic.** Email and SMS log
  to the console until real credentials are added; that is one env var per
  provider, no code change.
- **Phone verification claims nothing until a real SMS confirms it.**
  `phoneVerified` stays false rather than being set by an emailed code.

## Deviations from the tickets, and why

Each is also recorded on its GitHub issue.

- **Registering an existing email returns 201, not 409** (E02-08). A
  distinct 409 lets anyone test whether an address has an account. The real
  owner is told by email instead. The login, manager-registration and
  web-form paths all had to be kept consistent with this, which is where
  several follow-up fixes came from.
- **Login gives one error for every failure** (E02-13). A distinct
  "verify your email" response reinstates the same oracle.
- **Refresh rotates and the client stores both new tokens** (E02-12). The
  ticket keeps the old refresh token, which would trip the backend's reuse
  detection and log the user out everywhere.
- **Twilio over Verify** (E02-10), so phone verification stays testable
  without a live account.
- **Social login is a placeholder** (E02-07). The screen exists and is wired
  into the navigator, but no native OAuth is configured.

E03:

- **City detection snaps to the nearest supported city** (E03-02, E03-08)
  instead of calling Google reverse geocoding. The answer has to be one of
  `CITIES` anyway; this needs no API key or network, and a suburb such as
  Florești resolves to Cluj-Napoca instead of an unmatched locality. Cities
  gained `lat`/`lng` for this and for centring the map.
- **`@react-native-community/geolocation`**, already installed, rather than
  `react-native-geolocation-service`.
- **Clustering with `supercluster` directly** (E03-07), not
  `react-native-map-clustering`, which wraps MapView and lags behind
  react-native-maps; the pinned maps version is fragile enough already.
- **The selected marker is not spring-animated.** Markers use
  `tracksViewChanges={false}` as the ticket requires, which makes Android
  snapshot them once; selection re-mounts the marker at 1.1× instead.
- **`avgRating` is null below three reviews** (PRD §11.2), so a hidden rating
  never leaves the server. Company rating is the mean of its pitches' means.
- **Amenity filter:** free and paid variants are one choice (Showers =
  `SHOWERS_FREE` or `SHOWERS_PAID`), and every chosen amenity must be on the
  same pitch as the other pitch filters. The ticket's single `in` list would
  have made Showers + Parking mean "either".
- **`availableNow`** = open now and a matching pitch with no pending or
  confirmed booking in the next two hours. No five-minute cache: it is one
  indexed query.
- **Sorting and paging happen in memory** over the whole filtered city, since
  rating, price and distance are derived. Fine for v1.0 volumes; denormalise
  rating/price and use PostGIS before it is not.
- **The filters sheet edits a draft** applied when the sheet closes, so the
  list refetches once rather than per tap. "Show X results" asks the API for
  `limit=1` and reads `total`.
- **Web uses plain Tailwind components** rather than shadcn/ui, matching the
  existing `components/ui`; the price slider is two native range inputs.
- **Mobile `HomeScreen` is gone.** Discover is now the signed-in root, so the
  app has no sign-out button until Profile (E08). `docs/TESTING_E02_MOBILE.md`
  says Discover where it said Home.

E04:

- **Slots are computed in venue time.** The ticket's sample built slot
  instants as `${date}T08:00:00Z`, which is 10:00 or 11:00 in Romania. Slots
  are Bucharest wall-clock times converted with `venueTimeToUtc`, and "today"
  and "past date" are the venue's today.
- **A pitch uses its company's working hours.** The tickets mention a per-pitch
  `availabilitySchedule`; the schema has none. Hours are returned as
  `workingHours`: always seven `{ day, openTime, closeTime, isClosed }`
  entries, Sunday first — the stored shape, normalised — rather than the
  tickets' `{ "0": { closed: true } }` object.
- **Overnight hours** (e.g. 16:00–02:00) give a date two intervals: the
  previous evening's tail from 00:00, and its own hours up to 24:00, since a
  booking never spans midnight.
- **A `past` slot status** for slots earlier today. The tickets have only
  available/booked/closed; without it every elapsed slot read as available.
- **`PitchException` added** to the schema, as the ticket asked (one-off
  closed dates). Run `pnpm db:push`.
- **Reviewer names are "First L."**, never the full name; anonymous reviews
  show "Anonymous player" and no photo.
- **`GET /reviews` returns the star distribution and rating with each page**,
  so the breakdown header needs no second request.
- **Web detail pages render on the server from the same service functions as
  the API**, not by fetching their own API over HTTP; React `cache` keeps it to
  one query for the page and its metadata.
- **Web gallery and lightbox are built in place** (no gallery library);
  keyboard ←/→/Esc work. No shadcn/ui, as in E03.
- **Book Now when signed out** goes to `/login?callbackUrl=…` (the app's
  existing parameter), not `?redirect=`.
- **Mobile lightbox zoom is iOS-only** (ScrollView pinch, 1×–4×). Android
  pinch and double-tap need react-native-gesture-handler and reanimated,
  which are not installed.
- **Mobile tabs switch on tap, not swipe** (no tab-view/pager library), and
  the Company Detail hero image is the first pitch's cover photo — companies
  have no cover image of their own.
- **No "Sign in to book" on mobile**: the app's screens are all behind sign-in.
- **Deep links** (`/discover/:companyId` opening the app) are not configured;
  that needs a linking config and platform setup.

## Known gaps

- **Web colours are darker than the spec.** UIUX_SPEC §2.1's primary green,
  hint grey, error red and accent orange fail WCAG AA contrast; the web uses
  one shade darker where they carry text (marked `AA` in
  `apps/web/tailwind.config.ts`, and in the email layout). The mobile tokens
  still use the spec values and have not been checked for contrast. The spec
  should be updated to match, or a designer should pick other values.
- **Mobile Discover is built but not run.** Typecheck, lint, Metro bundle and
  the Android APK build pass; screens, the native map and clustering are for
  the mobile tester. The web map is verified against real Google tiles: pills
  render, click selects and opens the preview, map click dismisses. Pill
  clicks are native listeners because Google Maps swallows events before
  React sees them (see `PricePill` in `MapView.tsx`). Keys: README "Maps".
- **No tab bar.** PRD §5.1 puts Discover in a four-tab bar; no epic so far
  has built it, so Discover is a plain stack screen.

- **iOS has never built.** It is stuck at a linker error: undefined `_RNS*Cls`
  symbols referenced from the generated
  `RCTThirdPartyFabricComponentsProvider.mm`. The symbols live in
  react-native-screens' `gamma/` directory, which the pod excludes unless
  `RNS_GAMMA_ENABLED` is set, and the stubs in `ios/stubs/RNSGammaStubs.mm`
  define the Objective-C classes but not the C `*Cls` functions the provider
  actually links against. **This may now be moot**: that whole diagnosis was
  against rn-screens 4.29.0, and the pin has since moved to 4.16.0, which has
  no `gamma/` directory at all. Run `pod install` and rebuild before spending
  any time on the stubs.
- **Test coverage stops at the device.** Unit, API and browser E2E cover
  backend and web; mobile has unit/component tests with mocked native modules
  only. Nothing runs the app on a device yet (#187). `pnpm format:check` is
  not in CI until its CRLF noise on Windows is sorted out (docs/TESTING.md).
- **Rate limits trust `X-Forwarded-For` as sent** (`getClientIp` in
  `lib/api/rate-limit.ts`), so any client can dodge every limit by setting
  the header. Filed as a bug; the fix depends on how the app is deployed
  (only trust the header from a known proxy).
- **Lighthouse not run** for the web pitch page (E04-08 asks for SEO ≥ 90) or
  `/discover`. Titles, descriptions and Open Graph images are set per page.
- **Web auth was walked through in a browser** against a production build
  (`next start`), after the E03 session: login (right, wrong, unknown,
  unverified), `callbackUrl`, signed-in redirects, sign-out from both the
  dashboard and the player menu, manager registration with validation, email
  verification (wrong code, resend, right code), re-registering an existing
  address, forgot password, and the new `/reset-password` (bad link, weak and
  mismatched passwords, success, reused link, old password rejected). Six
  defects found on the way are fixed and filed. Still unchecked: real email
  and SMS delivery, and viewports other than desktop and 375px.
- **A password reset ends every session.** Mobile refresh tokens are revoked;
  web sessions (stateless JWT cookies) are rejected by the `jwt` callback once
  `User.passwordChangedAt` is later than the session's sign-in time. That is
  one primary-key lookup per session read. Deleted users are signed out the
  same way.
- **Android was verified as far as the onboarding screen.** The build, the
  bundle and the first render are confirmed. The seven auth screens have not
  been walked through on a device against a live API;
  `docs/TESTING_E02_MOBILE.md` is the plan for doing that and has not been run.
- **`pnpm lint` is weaker than `next build`.** The build caught an unused
  import that lint passed, because the root ESLint config ignores `.next`
  and Next runs its own pass. Worth aligning before CI exists.
- **Nothing has been delivered to a real inbox or handset.** Templates and
  the signing algorithm are verified; delivery and rendering are not.
- **Rate limiting is in-memory**, so it resets on restart and is per
  instance. Fine for one server, not for serverless. Redis in v1.1.

## Things that will need a decision

- `PROFILE_VERIFIED`, a manager trust score, and `ADMIN_ADJUSTMENT` appear
  in later tickets but are not in the PRD or the schema. Flagged in place
  on E12 and E15; each needs a call before that epic starts.
- **Players who sign in on the web go to `/discover`**, not `/dashboard`.
  E02-13 sends every login to `/dashboard`, which is the manager area and has
  nothing for a player. The dashboard now redirects players; managers and
  admins are unaffected.
- **When to upgrade React Native.** The 0.76 pin is already forcing an
  rn-screens downgrade and two patches, and that cost will grow.
- The GitHub token in use is shared in the session transcript and should be
  rotated when the project is done with it.

## Running it

See `README.md` for setup. `docs/ARCHITECTURE.md` explains why the
infrastructure is shaped the way it is — worth reading before changing the
schema or the auth flow. `docs/TESTING_E02_MOBILE.md` is the manual test plan
for the mobile auth screens.
