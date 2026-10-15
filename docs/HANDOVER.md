# Where things stand

Last updated at the end of the session that implemented E08 (Player: Profile & Account).

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
dimensions, free shirt sets, review text with a manager reply and an
anonymous review, fourteen reviews on Cluj Arena Park for paging, and on Arena
Gheorgheni Teren 1 a booking tomorrow 18:00–20:00, a fully booked day after
tomorrow and a maintenance closure the day after that. Zorilor closes on Sundays.

Book Now (web and mobile) opens the booking flow (E05).

**Fixed along the way — mobile API auth.** `requireAuth` only read the web
cookie, so every authenticated call from the app, `/me` included, was a 401;
`checkSession` would have signed the user out on every launch. It now accepts
the mobile Bearer access token too (re-reading the user, so a deleted account
stops working at once). Verified with a real token from
`/auth/mobile/login`. `/me` also returns `trustScore` now.

**E05 — Player: Booking Flow: all ten tickets implemented.**

| Ticket                          | State                                                                      |
| ------------------------------- | -------------------------------------------------------------------------- |
| E05-01 mobile booking navigator | built — full-screen modal, 5-step stack, progress bar, discard sheet       |
| E05-02 mobile date step         | built — month grid, arrows + swipe, full/closed/past days, prefilled date  |
| E05-03 mobile time step         | built — 40 px slots, shared range rules, "now" line, live price            |
| E05-04 mobile teams & shirts    | built — 2/3 teams, player steppers, free shirts switch, colours, note      |
| E05-05 mobile summary & payment | built — summary, price, refund policy, Stripe CardField or test payment    |
| E05-06 mobile confirmation      | built — animated check, reference, details; back closes the flow           |
| E05-07 `POST /bookings`         | done, verified — per-pitch lock, 409 on a clash, 15-minute hold            |
| E05-08 Stripe webhook           | done — signature, idempotent, succeeded/failed/refunded/account.updated    |
| E05-09 saved cards              | done — `GET/DELETE /payments/methods`, `POST /payments/setup-intent`       |
| E05-10 web booking flow         | done, verified in a browser — `/book/:pitchId/{date,time,teams,summary,…}` |

**Payments run in test mode until Stripe keys are set.** With
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` blank, bookings use the built-in test
payment (development, or `ALLOW_TEST_HOOKS=1`): no card, a "Confirm & pay"
and a "Simulate a declined card" button, the same booking and payment code
as Stripe. A production build without keys takes no bookings. To switch to
Stripe: create a free Stripe account, put its **test-mode** keys in
`apps/web/.env`, and forward webhooks locally with the Stripe CLI
(`stripe listen --forward-to localhost:3000/api/v1/payments/webhook`, whose
printed `whsec_…` is the webhook secret). Stripe has been exercised with unit
tests and fakes only, never against a real Stripe account.

New endpoints: `POST /bookings`, `GET /bookings/:id`,
`GET /pitches/:id/calendar`, `GET /payments/config`,
`GET /payments/methods`, `DELETE /payments/methods/:id`,
`POST /payments/setup-intent`, `POST /payments/webhook`,
`POST /payments/test/confirm` (test mode only).

`@stripe/stripe-react-native` 0.38.6 (the version Expo SDK 52 ships for
React Native 0.76) is a **new native dependency**: the mobile tester must
rebuild the app (Android build, and `pod install` for iOS) before testing.
As agreed, mobile was not built here: it is typechecked, linted and covered
by Jest only.

**E06 — Player: My Bookings: all ten tickets implemented.**

| Ticket                       | State                                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| E06-01 `GET /bookings`       | done, verified — upcoming/past/cancelled tabs, cursor pagination            |
| E06-02 `GET /bookings/:id`   | done, verified — full detail, status timeline, payment, refund preview      |
| E06-03 cancel                | done, verified — 100/50/0% by notice, refund in the same transaction        |
| E06-04 dispute + count       | done, verified — `POST /bookings/:id/dispute`, `GET /bookings/count`        |
| E06-05 `POST /reviews`       | done, verified — one per booking, 14-day window; `PUT`/`DELETE` within 24 h |
| E06-06 mobile My Bookings    | built — three tabs, cards, countdown chip, pull to refresh, empty states    |
| E06-07 mobile booking detail | built — banner, venue (tap to call), payment, timeline, dispute, review     |
| E06-08 mobile cancel sheet   | built — refund tier for this booking, then back to the Cancelled tab        |
| E06-09 mobile review         | built — stars with shake, 10–500 characters, anonymous; **no photos**       |
| E06-10 web My Bookings       | done, verified in a browser — `/my-bookings`, `/my-bookings/:id`, `/review` |

New endpoints: `GET /bookings` (list), `GET /bookings/count`,
`POST /bookings/:id/cancel`, `POST /bookings/:id/dispute`, `POST /reviews`,
`PUT /reviews/:id`, `DELETE /reviews/:id`. `GET /bookings/:id` now returns
the full detail (the E05 confirmation fields are a subset of it).

Schema: `BookingStatusEvent` (one row per status change, for the timeline),
`Booking.cardBrand`/`cardLast4`, `Review.deletedAt`, and the
`DISPUTE_OPENED` notification type. Applied with `prisma db push`.

**Bookings become COMPLETED lazily.** There is no scheduler yet (E11-10), so
reading a player's bookings first marks their finished CONFIRMED bookings
COMPLETED and their expired unpaid ones CANCELLED
(`settlePlayerBookings` in `lib/bookings/mine.ts`). The E11 job should do
the same for everyone and can then replace it.

"View my booking" on the confirmation (web and mobile) opens the booking;
the user menu and the mobile Discover header (with an upcoming-count badge)
link to My Bookings. Mobile adds no dependency: it is typechecked, linted and
covered by Jest (`src/screens/bookings/bookings.test.tsx`), not built.

**E07 — Reviews & Ratings: all ten tickets implemented.**

| Ticket                            | State                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------- |
| E07-01 `GET /pitches/:id/reviews` | done, verified — newest/highest/lowest/unanswered, breakdown, replies         |
| E07-02 `GET /reviews/mine`        | done, verified — newest first, `isEditable` on the server's clock             |
| E07-03 venue reply                | done, verified — `POST/PUT/DELETE /reviews/:id/reply`, 300 chars, 24 h edits  |
| E07-04 report                     | done, verified — once per person, review flagged and stays up, admins told    |
| E07-05 manager list               | done, verified — `GET /companies/:id/reviews`; ratings still computed on read |
| E07-06 mobile My reviews          | built — cards, reply, Edit (server says when), Delete with optimistic removal |
| E07-07 mobile all reviews         | built — sort pills on the company Reviews tab; animated bars, infinite scroll |
| E07-08 web My reviews             | done, verified in a browser — `/my-reviews`, edit via the review form         |
| E07-09 web manager reviews        | done, verified in a browser — `/dashboard/reviews`, filters, inline reply     |
| E07-10 web review display         | done, verified in a browser — sort in the URL, report, JSON-LD on pitches     |

New endpoints: `GET /pitches/:id/reviews`, `GET /reviews/mine`,
`POST/PUT/DELETE /reviews/:id/reply`, `POST /reviews/:id/report`,
`GET /companies/:id/reviews`; `GET /reviews` takes `sort`.

Schema: `ReviewReport` (one per person per review) with its
`ReviewReportCategory` enum, and the `REVIEW_REPORTED` notification type.
The reply stays on the review row (`managerReply`, `managerRepliedAt`),
which makes "one reply per review" automatic. Applied with `prisma db push`.

**The manager area starts here.** `/dashboard` now has a layout (header,
Overview and Reviews links, sign out) that redirects players to Discover;
E09 grows it into the full dashboard. Players reach My reviews from the
account menu (web) and from My Bookings (mobile). E08 added the profile.

**E08 — Player: Profile & Account: nine tickets implemented, push blocked on Firebase.**

| Ticket                        | State                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------ |
| E08-01 `GET/PUT /profile`     | done, verified — no secrets returned; new phone must be verified again         |
| E08-02 trust score            | done, verified — tier from the score, what it allows, history paged, all tiers |
| E08-03 password + delete      | done, verified — sessions end; deletion anonymises and refunds upcoming games  |
| E08-04 mobile profile         | built — user card, trust badge, menu, log out (no ring: no SVG module)         |
| E08-05 mobile trust detail    | built — badge and bar, tier table, tips, history by month                      |
| E08-06 mobile edit/pw/delete  | built — **no photo picker**; city list on the screen                           |
| E08-07 mobile payment methods | built — Stripe card field + SetupIntent; Remove button, not swipe              |
| E08-08 web profile pages      | done, verified in a browser — `/profile` and five sub-pages                    |
| E08-09 mobile notifications   | built — grouped, unread, tap opens, mark all read; long press deletes          |
| E08-10 push                   | **blocked on Firebase** — device-token endpoint and routing done               |

New endpoints: `GET/PUT/DELETE /profile`, `GET /profile/trust-score`,
`POST /profile/change-password`, `GET /notifications`,
`PATCH /notifications/:id/read`, `PATCH /notifications/read-all`,
`DELETE /notifications/:id`, `POST /notifications/device-token`.

Schema: `DeviceToken` (one row per phone token) and `User.deletionReason`.
Applied with `prisma db push`.

**Deleting an account anonymises it** (decided with the owner): name, email,
phone, photo, date of birth, Stripe customer, sessions, device tokens and
notifications go; upcoming bookings are cancelled with everything refunded;
past bookings and reviews stay, reviews shown as "Former player". Venue and
admin accounts cannot delete themselves (`NOT_A_PLAYER`); that goes through
support.

**Mobile added no native modules** (decided with the owner), so no rebuild is
needed for E08. Mobile opens Profile and Notifications from two new buttons in
the Discover header (no tab bar yet); the bell shows the unread count.

**Push (E08-10) is the one open item.** It needs a Firebase project and its
config files, which the owner creates. Ready for it: `POST
/notifications/device-token`, `registerPushToken()` and `openNotification()`
in `apps/mobile/src/lib/push.ts` (the comment there lists the five lines
that wire Firebase in), and `notificationTarget()` in `@pitchup/shared`,
used by both the push handler and the in-app list. Sending pushes is E13.

## Next

**E09 — Manager: Onboarding & Dashboard** (#81–#90): company creation in
four steps (info and logo, location with geocoding, contact and hours,
Stripe Connect), the onboarding status guard, and the dashboard layout.
Already in place: `/dashboard` has a layout (E07) to grow into the sidebar
of E09-10; `/dashboard/reviews` exists; company and pitch data and the
Discover pages read `Company.status`, so a new company stays hidden until
it is ACTIVE. Stripe Connect needs a Stripe account, like payments.

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
| `@stripe/stripe-react-native` | `0.38.6`  | E05 card payments. The release Expo SDK 52 pairs with React Native 0.76; later ones target newer React Native.                                                                                                                                                   |
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

### Product changes after the E04 review (milestone E17, #193–#197)

These override the PRD and every open ticket that says otherwise; each of
those tickets carries a comment pointing here.

- **C-1 Shirts are free.** A pitch either lends shirts or not
  (`Pitch.hasShirts`); `ShirtInventory.quantity` counts **sets**, one set
  dressing one team. A booking asks yes or no (`wantsShirts`) and gets
  `shirtSetsFor(teamCount, true)` = teams − 1 sets: two teams, one set.
  `shirtRentalPrice` and `Booking.shirtRateSnapshot` are gone;
  `Booking.shirtSets` records what was lent.
- **C-2 One price per hour.** `Pitch.hourlyRate` replaces `offPeakRate`,
  `peakRate` and `peakHoursDefinition`. A booking costs rate × hours, whatever
  the time. Existing pitches kept their off-peak rate.
- **C-3 Pitch size is a recommendation.** 6v6 (`SIX_A_SIDE`) is added, and
  every size shown to a player has an (i) explaining that it is the owner's
  recommended players per team, not a limit: the price is the same however
  many come (`SIZE_INFO`). Web shows it on hover and focus; mobile on tap.
- **C-4 No "Open now" filter.** Available now already means open _and_ a
  pitch free for the next two hours; an open venue with every pitch booked
  is no use to a player, so the second toggle only added confusion. Cards
  still show the "Open" badge, which answers a different question (can I
  call or drop in).
- **C-5 The map opens on the chosen city.** `mapCenter()` centres on the
  player only when they are in the selected city; otherwise on that city.

**Upgrading a dev database made before C-2.** `pnpm --filter @pitchup/web
db:push` refuses, because the new required `hourlyRate` column has no value
for existing pitches. Either start again
(`pnpm --filter @pitchup/web exec prisma db push --force-reset` then
`db:seed`, which loses any accounts you made), or keep your data by running
this first and then `db:push`:

```sql
ALTER TABLE "Pitch" ADD COLUMN "hourlyRate" DECIMAL(10,2);
UPDATE "Pitch" SET "hourlyRate" = "offPeakRate";
ALTER TABLE "Pitch" ALTER COLUMN "hourlyRate" SET NOT NULL;
```

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
  confirmed booking in the next two hours. It is the only availability
  filter (C-4). No five-minute cache: it is one
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

### E05 — booking and payments

- **The player pays the pitch price; PitchUp's 8% comes out of the venue's
  share** (PRD §8, the owner's call). E05-05's 5% fee on top of the price is
  not used. `Booking.totalAmount` is what the player pays; `platformFee` is
  the commission, kept for payouts (E09/E14).
- **Booking times are venue-local** (`date` + `HH:MM`), not the old UTC
  ISO strings, whose "same day" check split a 01:00 booking across two dates.
- **A per-pitch Postgres advisory lock** serialises booking creation and
  payment confirmation. The ticket's "SELECT … FOR UPDATE" cannot stop a
  double booking: the competing row does not exist yet, so there is nothing
  to lock. Tested by two players racing for one slot.
- **An unpaid booking holds its slot for 15 minutes**
  (`BOOKING.PENDING_HOLD_MINUTES`), not forever. A player's own new attempt
  replaces their unpaid one instead of clashing with it (retry after a
  declined card). A payment arriving after the hold, when someone else has
  the slot, is refunded in full.
- **The webhook answers 500 when a handler fails**, not 200: Stripe retries
  and the handlers are idempotent; a 200 would lose the event.
- **`GET /bookings/:id` asks Stripe about a still-PENDING booking**, so the
  confirmation does not depend on the webhook arriving first (it often will
  not locally).
- **A month calendar endpoint** (`GET /pitches/:id/calendar`) replaces the
  ticket's one availability call per day, which would also hit the per-IP
  rate limit.
- **Shirts (C-1):** one yes/no and `teams − 1` sets; no per-colour
  quantities or rental price. Only one booking uses a pitch at a time, so a
  pitch's sets are never shared between bookings.
- **Mobile without new animation/pager libraries:** the date swipe is a
  `PanResponder` (not `react-native-pager-view`), the checkmark is
  `Animated` (not `react-native-svg` + Reanimated), the discard sheet is a
  `Modal` (not `@gorhom/bottom-sheet`). Only Stripe adds native code.
- **Web flow URLs are `/book/:pitchId/…`**, as the ticket says; the E04
  placeholder `/booking/new` redirects there so old links still work.
- **Players per team default to the size** (6 for 6v6), not a fixed 5.

### E06 — My Bookings

- **Another player's booking is a 404, not a 403**, so booking ids cannot be
  probed for existence.
- **Refund tiers follow the PRD constants** (≥ 24 h → 100%, ≥ 2 h → 50%,
  otherwise nothing) and refund the whole share the player paid; nothing is
  held back for the platform fee.
- **The no-show dispute window is 24 hours** (`NO_SHOW_DISPUTE_WINDOW_HOURS`),
  not the ticket's 48, and it takes the player's account of what happened
  (1–300 characters). Admins get a `DISPUTE_OPENED` notification; resolving
  disputes is E12.
- **The Cancelled tab shows only bookings that were paid.** Abandoned
  checkouts are cancelled too, but listing them would be noise.
- **Review text is optional but at least 10 characters when given**
  (`REVIEW.MIN_TEXT_LENGTH`). Deleting a review is a soft delete and the
  booking cannot be reviewed again.
- **No review photos on mobile.** Picking photos needs
  `react-native-image-picker`, a native module the app does not have. The web
  form takes photos when Cloudinary is configured (`upload/sign` now checks
  that the booking is the caller's).
- **Mobile tabs and the cancel sheet use no new libraries**: three `Pressable`
  tabs over one `FlatList` (not `react-native-tab-view`), and a `Modal` (not
  `@gorhom/bottom-sheet`).

### E07 — Reviews & Ratings

- **Ratings are still computed when read, not stored on the pitch**
  (E07-05 asks for `Pitch.avgRating`/`reviewCount` kept in sync). Decided
  with the owner: one indexed grouped query, so it cannot go stale. Revisit
  if review counts grow large.
- **Review lists page by number (`?page=`), not by cursor.** E04's clients
  already page that way, and a rating sort makes a cursor awkward. The id is
  the last sort key, so pages never shuffle.
- **The reply lives on the review row**, not in a `ReviewReply` table: the
  columns existed since E01 and one reply per review needs no unique index.
- **A reply is 1–300 characters** (PRD §8.5); `REVIEW.MAX_MANAGER_REPLY_LENGTH`
  was 500 and is now 300.
- **Report reasons are the PRD's** (spam, offensive, irrelevant, fake), not
  the ticket's list. Reporting your own review is refused (`OWN_REVIEW`).
- **Authors can delete a review at any time**; editing stays limited to 24
  hours (E07-06 shows Delete after the window; E06 limited both).
- **A wrong manager gets 404, a player 403** on replies and the manager list,
  as with other people's bookings.
- **Manager search never matches anonymous reviews**, and managers see
  "Anonymous player" like everyone else.
- **No standalone `/pitches/:id/reviews` web page.** "See all reviews" on a
  pitch already opens the company's Reviews tab for that pitch (E17); sorting
  and the auto-loading list were added there. JSON-LD sits in the pitch
  page's body (Google reads it there too), only once the rating is public.
- **No separate mobile `AllReviewsScreen` or `EditReviewScreen`**: the
  company Reviews tab already lists a pitch's reviews (E17), and the E06
  Review screen edits in place. Mobile still has no review photos.
- **Manager paging is Previous/Next links**, rendered on the server; the
  ticket leaves the paging style open.

### E08 — Profile & Account

- **No new native modules on mobile** (the owner's call): the trust score is
  a coloured badge with a bar that fills, not an SVG ring; Remove buttons and
  long press instead of swipe-to-delete; the profile photo is changed on the
  website (no image picker). Card brands are text and an icon, not logos.
- **A wrong password is 400 `WRONG_PASSWORD`, not 401.** A 401 tells the app
  its session is gone, and it would sign the player out for a typo.
- **Changing the password ends every session**, including the one used to
  change it, as a reset does (E02). Web lands on the login page with a
  notice; the app shows an alert and signs out.
- **Validation errors are 400**, not the ticket's 422, like the rest of the
  API.
- **Notifications are deleted for real**, not soft-deleted: they are the
  user's own messages and nothing refers to them.
- **Password attempts (change and delete) share a limit of 5 per 15 minutes
  per user.**
- **Web profile lives at `/profile/...`** under the player layout, with a
  sidebar on wide screens and a scrolling row of links on a phone. The
  change-password page is `/profile/change-password`, as the ticket says.
- **The Legal and Support links point at pitchup.ro pages that do not exist
  yet** (`apps/mobile/src/lib/links.ts`).
- **The mobile city choice is a list on Edit profile**, not the Discover city
  sheet, which is tied to Discover's own city.

## Known gaps

- **Stripe has never run against a real account.** Unit tests cover the
  Stripe calls with a fake SDK and the webhook with real signatures; the
  booking flow is tested end to end in test-payment mode. Add test-mode
  keys and pay with card 4242 4242 4242 4242 (and the declined 4000 0000
  0000 0002) before trusting it.
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
- **No profanity filter yet** (PRD §11.3's auto-flag). Reports flag reviews
  for admins, but nothing flags them automatically.
- **Rate limiting is in-memory**, so it resets on restart and is per
  instance. Fine for one server, not for serverless. Redis in v1.1.

## Things that will need a decision

- **Versioned migrations before real data.** Schema changes are applied
  with `prisma db push`, which is fine while every database holds seed data
  only. C-2 showed the cost: a column change needed hand-written SQL to keep
  existing rows. Before any deployment holds real bookings, switch to
  `prisma migrate` so each change is a reviewed SQL file (ARCHITECTURE §14).
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
