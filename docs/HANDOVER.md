# Where things stand

Last updated after Firebase and Google sign-in were connected (E02-07,
E08-10), following E15 (Admin Panel), E09–E14 and the product changes C-6 to C-13.

**Text messages and phone verification (2026-10-20).** The owner decided:
no text reminders or text notifications for launch, but phone numbers are
verified by a texted code. See "Text messages: phone codes only" below.

**Firebase and Google sign-in (2026-10-19).** The owner created the Firebase
project `pitchup-3221c` and the Google OAuth clients. See "Firebase and
Google sign-in" below for what is wired, where the secret files live, and
what still needs an Apple Developer account.

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
| E02-07 social login             | built — Google on web and mobile; Apple not yet    |
| E02-08 backend auth             | done — register, login, refresh, logout, verify    |
| E02-09 Resend email             | done — adapter + templates, inactive without a key |
| E02-10 Twilio SMS               | done — adapter, inactive without credentials       |
| E02-11 password reset           | done                                               |
| E02-12 mobile API client        | done — authApi, authStore, navigation wiring       |
| E02-13 web manager login        | done                                               |
| E02-14 web manager registration | done                                               |

E02-07 was a placeholder until 2026-10-19; Google sign-in is now built (see
"Firebase and Google sign-in"). Apple sign-in waits for an Apple Developer
account.

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

**The manager area started here** with a Reviews page; E09 moved it to
`/manager/reviews` inside the manager shell. Players reach My reviews from
the account menu (web) and from My Bookings (mobile). E08 added the profile.

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
| E08-10 push                   | built — Firebase messaging wired (2026-10-19); iOS needs an APNs key           |

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

**Push (E08-10)** was the open item until the Firebase project existed; it
is wired now (see "Firebase and Google sign-in").

**E09 — Manager: Onboarding & Dashboard: ten tickets done, plus a minimal admin approval page.**

| Ticket                       | State                                                                    |
| ---------------------------- | ------------------------------------------------------------------------ |
| E09-01 `POST/PUT /company`   | done, verified — one company per manager, created as DRAFT               |
| E09-02 location + geocoding  | done, verified — pin from the browser; server geocodes only with a key   |
| E09-03 contact and hours     | done, verified — same hours format as Discover; overnight allowed        |
| E09-04 Stripe Connect        | done, verified in test mode — Express account, link, return check        |
| E09-05 status + guard        | done, verified — step derived from the data; no skipping ahead           |
| E09-06 step 1 page           | done, verified in a browser — counters, optional logo upload             |
| E09-07 step 2 page           | done, verified in a browser — draggable pin when a Maps key is set       |
| E09-08 step 3 page           | done, verified in a browser — Closed switch, copy Monday's hours         |
| E09-09 step 4 + under review | done, verified in a browser                                              |
| E09-10 dashboard shell       | done, verified in a browser — sidebar, bell, account menu, today's stats |

New endpoints: `POST/PUT /onboarding/company`, `PUT /onboarding/location`,
`PUT /onboarding/contact-hours`, `POST /onboarding/stripe-connect`,
`GET /onboarding/stripe-connect/return`, `GET /onboarding/status`,
`GET /manager/stats/today`, `GET /admin/companies`,
`POST /admin/companies/:id/approve` and `/reject`.

Schema: `CompanyStatus` gained `DRAFT` (the new default); Company gained
`facebookUrl`, `instagramUrl`, `county`, `submittedAt`, `reviewedAt` and
`rejectionReason`; phone, email, address and city are now optional (a
draft has none yet); three notification types for submitted, approved and
sent back. Applied with `prisma db push`.

**Pages:** `/onboarding/step/1..4`, `/onboarding/pending`,
`/manager/overview`, `/manager/reviews`, `/manager/suspended`,
`/admin/companies`. `/dashboard` now only redirects by role (manager to the
overview or onboarding, player to Discover, admin to approvals), so old
links keep working.

**Approval (decided with the owner):** a minimal `/admin/companies` page
lists submitted venues with Approve and "Send back…" (a reason the manager
sees on every onboarding step). Both email the manager and add a
notification. Admins get a notification when a venue is submitted. The full
admin panel is E15.

**To try it with real services** (optional; everything works without them):

- Stripe Connect: in the Stripe sandbox, open Connect and finish its setup
  once. With the test keys in `apps/web/.env`, step 4 opens Stripe's hosted
  form; use the test values Stripe shows there.
- Maps: the browser key needs the **Geocoding API** enabled in Google Cloud
  for the pin to follow the address. A server-side `GOOGLE_MAPS_API_KEY`
  (optional) geocodes when the manager saves without a pin.

**E10 — Manager: Pitches & Pricing: ten tickets done (web and API).**

| Ticket                           | State                                                            |
| -------------------------------- | ---------------------------------------------------------------- |
| E10-01 create / edit basic info  | done, verified — starts inactive; usual dimensions filled in     |
| E10-02 photos                    | done, verified — 10 max, reorder together, gaps closed on delete |
| E10-03 amenities + pricing       | done, verified — one hourly rate (C-2), booking limits           |
| E10-04 shirts + hours + blocked  | done, verified — sets per colour (C-1); hours inside the venue's |
| E10-05 status, delete, list      | done, verified — on needs a photo and a price; soft delete       |
| E10-06 pitch list page           | done, verified in a browser — sort, switch, delete, empty state  |
| E10-07 basic info, photos, amen. | done, verified in a browser — upload needs Cloudinary keys       |
| E10-08 pricing tab               | done, verified in a browser — live price preview                 |
| E10-09 shirts tab                | done, verified in a browser                                      |
| E10-10 availability tab          | done, verified in a browser — venue-closed days locked           |

New endpoints: `POST /pitches`, `PUT`/`DELETE /pitches/:id`,
`PATCH /pitches/:id/status`, `POST /pitches/:id/photos`,
`PUT /pitches/:id/photos/reorder`, `DELETE /pitches/:id/photos/:photoId`,
`PUT /pitches/:id/amenities`, `PUT /pitches/:id/pricing`,
`PUT /pitches/:id/shirts`, `PUT /pitches/:id/availability` (the GET stays
the public slots), `POST /pitches/:id/exceptions`,
`DELETE /pitches/:id/exceptions/:exceptionId`, `GET /manager/pitches` and
`GET /manager/pitches/:id`. The upload signer accepts `PITCH` for the
pitch's own manager.

Schema: `Pitch.workingHours` (the pitch's own week; null follows the venue)
and `Pitch.deletedAt`. Availability uses the pitch's hours cut to the
venue's, so a venue that later shortens its hours can't leave a pitch open
outside them. Deleted pitches are gone from every player-facing read.

**Pages:** `/manager/pitches` and `/manager/pitches/:id/edit/{basic-info,
photos,amenities,pricing,shirts,availability}`. Pitches in the sidebar is
live.

**To add real photos** the Cloudinary keys must be in `apps/web/.env`
(they are on your machine); without them the Photos tab says so and the
rest works.

**E11 — Manager: Calendar & Bookings: nine tickets done, the mobile one built.**

| Ticket                         | State                                                                |
| ------------------------------ | -------------------------------------------------------------------- |
| E11-01 `GET /manager/bookings` | done, verified — filters, venue days, cursor pages, no player emails |
| E11-02 calendar feed           | done, verified — Monday to Sunday, pitch colours, cancelled left out |
| E11-03 booking detail          | done, verified — payout, history at this venue (no trust score)      |
| E11-04 no-show                 | done, verified — 30 min to 4 h after kick-off; twice is a no-op      |
| E11-05 complete + free time    | done, verified                                                       |
| E11-06 list page               | done, verified in a browser — URL filters, Load more, CSV export     |
| E11-07 week calendar           | done, verified in a browser — legend toggles, week navigation        |
| E11-08 booking page            | done, verified in a browser — actions with a confirm dialog          |
| E11-09 mobile screens          | **built** — list with status and pitch chips, detail with actions    |
| E11-10 utilities + nightly job | done, verified — `CRON_SECRET`, `vercel.json` at 02:00 UTC           |

New endpoints: `GET /manager/bookings` (now paged and filtered; C-8's
upcoming/recent shape is gone), `GET /manager/bookings/calendar`,
`GET /manager/bookings/:id`, `POST /manager/bookings/:id/complete`,
`GET /manager/pitches/:id/availability-gaps`, `/cron/auto-complete` (GET
for Vercel Cron, POST too). The C-8 attended and no-show endpoints stay.

**Pages:** `/manager/bookings` (list), `/manager/bookings/calendar` (week),
`/manager/bookings/:id` (detail and actions). Calendar in the sidebar is
live. On the phone, Profile → "Venue bookings" for managers.

**Setting up the nightly job:** set `CRON_SECRET` (16+ characters) in the
deployment; Vercel Cron sends it. Without it the job refuses every call and
nothing is settled except by the pages and the manual "Mark as complete".

**E12 — Penalty & Trust: nine tickets done, the mobile one already built in E08.**

| Ticket                             | State                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------- |
| E12-01 `applyTrustEvent`           | done, verified — one SQL update, clamped, with its history row         |
| E12-02 +2 per completed game       | done, verified — nightly job, players' reads and Mark as complete      |
| E12-03 late cancellation           | done, verified — −5 under 24 h, −10 under 2 h, confirmed bookings only |
| E12-04 disputes                    | done, verified — admin list and decision, minimal `/admin/disputes`    |
| E12-05 review +1, monthly job      | done, verified — recovery +1, scores rebuilt from history              |
| E12-06 booking gate                | done, verified — pitch minimum, Poor one at a time, Suspended none     |
| E12-07 mobile trust history        | built in E08 — awaiting mobile testing                                 |
| E12-08 web history + gate message  | done, verified in a browser                                            |
| E12-09 pitch minimum in the editor | done, verified in a browser — "Who can book", list column              |
| E12-10 shared tests and exports    | done                                                                   |

Every score change goes through `applyTrustEvent` (`src/lib/trust/apply.ts`):
completions (+2, at most +10 a calendar month), reviews (+1, once per
booking), late cancellations, no-shows (−20), won disputes (+10) and the
monthly recovery (+1 in a month with nothing negative). New endpoints:
`GET /admin/disputes`, `PUT /admin/disputes/:bookingId/resolve`,
`/cron/trust-monthly` (1st of the month, 03:00 UTC, same `CRON_SECRET`).
`PUT /pitches/:id` accepts `minTrustScore` (0, 50, 70 or 90).

Schema: `Pitch.minTrustScore`, `NoShow.resolution`.

**E15 — Admin Panel: all ten tickets done.**

| Ticket                        | State                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- |
| E15-01 guard + venue list     | done, verified — status and search filters, cursor pages               |
| E15-02 venue status           | done, verified — approve, send back, suspend, reinstate; 409 otherwise |
| E15-03 users                  | done, verified — filters, suspend, trust adjustment, delete players    |
| E15-04 disputes + reviews     | done, verified — decided disputes listed; reviews deleted with reason  |
| E15-05 stats + config         | done, verified — figures, commission on new bookings, maintenance mode |
| E15-06 layout + venues        | done, verified in a browser — sidebar, list, venue page                |
| E15-07 users page             | done, verified in a browser                                            |
| E15-08 disputes + reviews     | done, verified in a browser                                            |
| E15-09 overview + settings    | done, verified in a browser — maintenance as a visitor sees it         |
| E15-10 seed, bootstrap, smoke | done — `admin:bootstrap`, `e2e/web/smoke.spec.ts`                      |

**The panel** (`/admin`, a dark sidebar like the manager area, with counts of
what waits): Overview (figures, refreshed every minute, and what waits),
Venues (the approval queue and venue changes from before, plus every venue
with filters, and a page per venue to suspend or reinstate it), Users (search
and filters, a page per user to adjust the trust score with a reason, suspend
or reinstate, and delete a player), Disputes (open and decided), Reviews
(most reported first, deleted with a reason the author reads) and Settings.

**Suspending a user** ends their sessions on the web and the app and refuses
sign-in until reinstated; bookings already made stay. **Suspending a venue**
takes it off Discover and stops new bookings; the manager sees why.
**Maintenance mode** shows everyone but admins a message, and the API answers
503 `MAINTENANCE`; sign-in, the admin area, health checks, cron jobs and
Stripe's webhook stay open. **The commission** was removed by C-15:
Platform settings now holds the subscription prices.

**Making an admin:** the person registers, then
`pnpm --filter @pitchup/web admin:bootstrap their@email`.

Schema: `User.suspendedAt`, `suspensionReason`; `Company.suspensionReason`;
`TrustScoreEvent.note`; `ADMIN_ADJUSTMENT`, `ADMIN_NOTICE`; `PlatformConfig`.

**E14 — Analytics: nine tickets done, the mobile one built.**

| Ticket                      | State                                                                    |
| --------------------------- | ------------------------------------------------------------------------ |
| E14-01 revenue series       | done, verified — day, week or month, every bucket present                |
| E14-02 occupancy heatmap    | done, verified — booked over open time, venue hours, closed hours `null` |
| E14-03 per-pitch table      | done, verified — revenue, bookings, occupancy, rates, rating             |
| E14-04 KPI summary          | done, verified — five figures against the same length before             |
| E14-05 CSV export           | done, verified — 10,000 rows at most, `X-Truncated`, formulas defused    |
| E14-06 dashboard + cards    | done, verified in a browser — period and pitch in the URL                |
| E14-07 revenue chart        | done, verified in a browser — SVG, legend toggles, a table view          |
| E14-08 heatmap              | done, verified in a browser                                              |
| E14-09 pitch table + export | done, verified in a browser — sortable, CSV download                     |
| E14-10 mobile analytics     | **built** — Profile → Analytics, awaiting mobile testing                 |

**What revenue means** (decided 2026-10-17): what the venue earned. The full
price of games played (COMPLETED, or CONFIRMED once started), whether paid
online or at the venue; plus what it kept from late cancellations and
no-shows; less refunds. All of it is the venue's (C-15: no commission). Everything is in the
venue's days and hours (Europe/Bucharest), and periods end now.

New endpoints: `GET /manager/analytics/{revenue,occupancy,pitches,summary,export}`,
all with `period` (7d, 30d, 90d, 12m) and, except pitches, `pitchId`. Page:
`/manager/analytics` (the sidebar's Analytics is live). Rules in
`packages/shared/src/analytics.ts`, figures in `apps/web/src/lib/manager/analytics.ts`.

**E13 — Notifications: eight tickets done, the two mobile ones built.**

| Ticket                             | State                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------- |
| E13-01 model + dispatcher          | done, verified — `notify()` writes the inbox row, delivery after it    |
| E13-02 push (FCM)                  | done, unit-tested — HTTP v1 with a signed JWT; idle without Firebase   |
| E13-03 email                       | done, verified — templates for the main notices, a generic one else    |
| E13-04 SMS + 24-hour reminder      | done, verified — hourly job, reminders 23–25 h ahead, once each        |
| E13-05 booking lifecycle wired     | done, verified — every notice goes through `notify()`                  |
| E13-06 in-app feed                 | done, verified — unread count, `unreadOnly`, mark one or all read      |
| E13-07 preferences                 | done, verified — three channels, six groups, partial updates           |
| E13-08 mobile inbox + badge        | built in E08 — badge now refreshes every minute, awaiting mobile tests |
| E13-09 mobile preferences screen   | **built** — Profile → Notification settings, awaiting mobile testing   |
| E13-10 web bell + preferences page | done, verified in a browser — player header and manager shell          |

**How a notice travels:** `notify(tx, payload)` (`src/lib/notifications/dispatch.ts`)
writes the in-app row inside the caller's transaction, so a notice exists only
if what it announces happened; a type the user muted writes nothing. After the
response, `deliverSoon(userIds)` sends email, SMS and push for the new rows
(Next's `after()`), and the hourly `/cron/notifications` job sends anything
left over from the last two hours and queues the 24-hour reminders. Each row is
claimed (`deliveredAt`) before sending, so nothing goes out twice.

New endpoints: `GET /notifications/count`, `GET/PUT /notifications/preferences`,
`GET /notifications?unreadOnly=true`, `/cron/notifications` (hourly in
`vercel.json`, the same `CRON_SECRET`).

**Pages:** the bell in the player's header and the manager shell (unread count,
the latest five, mark all read); `/profile/notifications` (switches that save at
once, and every notice with Load more). On the phone, Profile → Notification
settings.

Schema: `NotificationPreference`, `Notification.deliveredAt`,
`Booking.reminderSentAt`, `TRUST_TIER_CHANGED`.

**Turning the channels on:** email needs `RESEND_API_KEY` (and Resend only
sends to your own address until a domain is verified); SMS needs the
`TWILIO_*` variables; push needs `FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` from a service account, and
the mobile app's Firebase wiring (E08-10). Without them each channel logs
instead of sending, and the inbox works regardless.

## Firebase and Google sign-in

Firebase project **`pitchup-3221c`** (Spark plan, Analytics unlinked). The
same Google Cloud project holds the OAuth clients: Web, Android
(`com.pitchup`, debug SHA-1) and iOS (`com.pitchup`). The consent screen is
in **Testing**: only listed test users can sign in with Google until it is
published.

**Where the secrets are.** None are in git.

- `apps/web/.env` holds `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY` (from the service-account key file),
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_IOS_CLIENT_ID`.
- `apps/mobile/android/app/google-services.json` and
  `apps/mobile/ios/PitchUp/GoogleService-Info.plist` are git-ignored: they
  carry an `AIzaSy…` API key, like the Maps key. Download them again from
  Firebase → Project settings → General if a checkout lacks them; the
  Android build fails without its file.
- The OAuth client IDs are public and are in `apps/mobile/src/config.ts`.

**Google sign-in.** Google proves who the person is; the account stays ours,
matched by email. There is no Firebase Authentication and no Auth.js
adapter: the unused `@auth/prisma-adapter` was removed, because with an
OAuth provider it would have needed Account/Session tables we don't have.

- Mobile: "Continue with Google" gets an ID token for the Web client and
  posts it to `POST /api/v1/auth/mobile/google`. A confirmed account signs
  in. A new address answers `PROFILE_NEEDED`; `SocialLoginScreen` asks for
  phone, city and date of birth and sends the token again with them. The
  account is created as a player with the email already verified, a random
  password nobody knows ("Forgot password" sets one). The phone is
  verified later, from Profile (see "Text messages: phone codes only").
- Web (the manager portal): the Auth.js Google provider, shown only when
  `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. It opens existing,
  confirmed, active accounts only; anyone else returns to
  `/login?error=GoogleNoAccount`. The redirect URI registered is
  `http://localhost:3000/api/auth/callback/google`. The production domain
  (and any tunnel URL) has to be added to the Web client before Google
  sign-in works there.

**Push.** `@react-native-firebase/app` and `/messaging` 21.6.1 (the
release contemporary with React Native 0.76).

- After sign-in, `startPush()` asks permission (Android 13+ and iOS),
  registers the FCM token and each refresh of it, and opens the screen a
  tapped push is about, including one that launched the app.
- Signing out deletes the token.
- The server sends through the service account (E13-02).

Native changes:

- **Android:** the google-services Gradle plugin and the
  `POST_NOTIFICATIONS` permission.
- **iOS:** the bundle id is now `com.pitchup` (was React Native's
  `org.reactjs.native.example…`).
  - `GoogleService-Info.plist` is in the app's resources.
  - `[FIRApp configure]` and Google's URL handler are in `AppDelegate.mm`, and
    the reversed client ID is a URL scheme in `Info.plist`.
  - The Podfile uses static frameworks, which React Native Firebase requires.

**Not done, and why:**

- **iPhone push** needs an APNs key from an Apple Developer account,
  uploaded to Firebase, plus the Push Notifications capability (an
  entitlements file). Adding the capability without a paid team breaks
  signing, so it was left out.
- **Sign in with Apple** needs the same account. The App Store requires it
  once the iPhone app offers Google.
- **A release build of Android** needs its own SHA-1 added to the Android
  OAuth client and to Firebase, or Google sign-in fails in release only.
- **The iOS build that works under Xcode 27 (cfa14ed) predates these modules.**
  On the Mac, run `pod install` again: the Podfile now builds pods as static
  frameworks, which React Native Firebase requires, and `Podfile.lock` is
  out of date until then. That build is the first real check of the iOS side.
- **Neither app has been built with these modules.** They follow the
  libraries' documented setup; the first Android build after this change is
  the real check (see "React Native version constraints").

## Romanian and English

Added 2026-10-20. Both apps are in **Romanian by default**, with English one
tap away. Every screen, email, push, notification and API error is
translated; the English text is word for word what it was before.

- **Where the text lives:**
  - `packages/shared/src/i18n/` — the translator, and the words both apps
    use: dates and months, statuses, trust tiers and rules, payment wording,
    amenities, sizes, surfaces, refund policy, notification groups, and
    every validation message of the shared Zod schemas (`v.*`).
  - `apps/web/src/i18n/en|ro/` — the web's own text, one file per area
    (auth, profile, manager, mBookings, mVenue, editor, analytics,
    onboarding, admin, api, email, notify, …).
  - `apps/mobile/src/i18n/en|ro/` — the app's own text (auth, discover,
    booking, bookings, profile, manager).
  - Each Romanian file is typed against its English one
    (`CatalogShape<typeof …En>`), so a missing or extra key fails
    `tsc`. Plurals have Romanian's three forms (`one`, `few`, `other`).
- **Choosing the language:**
  - Web: the RO/EN switch in the player's top bar, the manager's top bar,
    the onboarding header and the admin sidebar. It sets the
    `pitchup-locale` cookie and, when signed in, saves it on the account.
  - App: the RO/EN switch on the login screen and on Profile → Language.
    It is kept on the phone and, when signed in, on the account. Every
    request sends it as `x-locale`, so server messages come back in it.
  - Emails and pushes use the account's `User.locale`, or Romanian when
    it was never set.
  - `DEFAULT_LOCALE` (env) changes the default; the E2E run sets `en`, so
    the existing tests keep reading English.
- **API errors:** routes and libraries throw catalog keys (`api.*`, with
  params); `withErrorHandling` translates them, and the field messages of a
  validation error, into the request's language. Clients that branch on an
  error do it by `code` or `details.reason`, never by the message (the
  pitch editor's "save anyway" for shirts now reads `SHIRTS_PROMISED`).
- **Adding text:** add the English key, then the Romanian one (`tsc` says
  which are missing), and use `t('area.key')` (`useT()` in client
  components and the app, `await getT()` in server components).
- **Numbers and amounts** follow the language too (`formatNumber`,
  `formatRon`: "1.234,5 RON" in Romanian, "1,234.5 RON" in English).
- **Not translated:** venue-written content (names, descriptions, replies)
  and internal log messages.

## Error monitoring (Sentry)

Added 2026-10-20. Errors only, no performance tracing, and no personal data
(`sendDefaultPii: false`; the Sentry organisation should also have IP
storage off and data scrubbing on).

- **Web:** `@sentry/nextjs` 10.75.3.
  - `src/instrumentation.ts` covers the server and edge, and reports errors
    from rendering and routes (`onRequestError`).
  - `src/instrumentation-client.ts` covers the browser.
  - `app/global-error.tsx` catches a crash of the root layout.
  - `withErrorHandling` reports the unhandled errors it turns into a 500,
    which Next would otherwise never see.
  - Switched on by `NEXT_PUBLIC_SENTRY_DSN`, and
    `NEXT_PUBLIC_SENTRY_ENVIRONMENT` labels the environment. The tests
    blank the DSN.
- **Mobile:** `@sentry/react-native` 6.22.0, started in `index.js` before the
  first render, with the root wrapped so render crashes are reported.
  - Release builds only. Switched on by `SENTRY_DSN` in `src/config.ts`
    (empty means off).
  - It's a native module, so iOS needs `pod install`.
- **Not done:** uploading source maps, which needs a Sentry auth token in CI.
  Until then, browser and app stack traces show minified code; server
  traces are readable.

## Text messages: phone codes only

Decided 2026-10-20: **no text reminders or text notifications** for launch.
Reminders and every other notice go by push and email. The `sentSms` and
`smsEnabled` columns are gone, and so are the "Text messages" switches on
web and mobile. SMS is used for one thing: verifying the phone number.

**Phone verification (#163).** It was half-built: a code was texted at
sign-up but no screen took it. Now:

- Sign-up (password or Google) texts nothing.
- A signed-in person asks for a code:
  - Mobile: Profile → "Verify phone number" → `VerifyPhoneScreen`.
  - Web: Account settings → "Text me a code" under the phone field.
- `POST /api/v1/profile/phone/code` sends it (409 `ALREADY_VERIFIED`, 429 per-number quota).
- `POST /api/v1/profile/phone/verify { code }` checks it (400, 410, 429 as before).
- Verification is still optional; nothing requires it yet.

**Twilio account:** a free trial, "Limited trial" plan, Account SID
`AC3855…a3d8`.

- It may only send Twilio's own templates, so our own texts are refused
  (error 572006).
- Codes therefore go through **Twilio Verify**: Twilio makes, sends and
  checks them. The service "PitchUp" is `TWILIO_VERIFY_SERVICE_SID` in
  `apps/web/.env`.
- Without that variable, and in every test, the code stays ours and goes as
  a plain text (or to the log).
- Verified end to end on 2026-10-20: a code reached a Romanian number and
  was approved.

Trial limits:

- 30 days.
- About 40 verifications.
- Only to verified testers (the owner's number).
- Upgrading the account lifts these; nothing in the code changes.

## Next

Every epic (E01–E15) is built. What is left:

- **Your testing** of E09 onward, and the **mobile pass**: the mobile tickets
  stay open as "built, awaiting mobile testing".
- **Twilio beyond the trial:** the free trial (30 days, about 40 Verify
  codes, only to verified testers) has to be upgraded before real users
  verify their phones.
- **An Apple Developer account** for iPhone push (an APNs key uploaded to
  Firebase) and Sign in with Apple.
- **Before real data:** versioned migrations, a verified Resend domain, and
  live Stripe keys (see "Things that will need a decision").

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

- **iOS now builds and launches** (fixed 2026-10-19, see the known gaps for
  what's still unverified beyond the sign-in screen).

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
- **`react-native-screens@4.16.0.patch`** — fixes three upstream bugs in the
  Fabric native-component factory functions that the generated
  `RCTThirdPartyFabricComponentsProvider.mm` links against: six files under
  `ios/bottom-tabs/` and `ios/gamma/**` define their `*Cls(void)` factory
  without importing `<React/RCTFabricComponentsPlugins.h>`, so they compile
  with C++ name mangling instead of the C linkage the linker needs; a typo
  (`RNSBottomTabsScreen` instead of `RNSBottomTabsScreenCls`); and
  `ios/stubs/RNSGammaStubs.mm` (used when `RNS_GAMMA_ENABLED` is unset, which
  is always, since nothing sets it) defined the stub Objective-C classes but
  not their `*Cls` C factory functions. The old `react-native-screens@4.29.0.patch`
  mentioned in earlier revisions of this doc was against the wrong version
  (4.29.0 was never actually resolved by pnpm) and has been deleted.

The long-term fix for all of this is to upgrade React Native. These pins are
holding the tree at a version the ecosystem has moved past.

### Android: horizontal lists must not clip their subviews

Finishing the onboarding slides crashed the app with a red box:

> Cannot remove child at index 8 from parent ViewGroup [66], only 9 children
> in parent. Warning: childCount may be incorrect!

The red box hides the frame that matters. From `adb logcat`:

```
at SurfaceMountingManager.removeViewAt(SurfaceMountingManager.java:588)
at ReactClippingViewManager.removeViewAt(ReactClippingViewManager.java:77)
```

Line 77 is the subview-clipping branch, so clipping was on. It calls
`ReactViewGroup.removeViewWithSubviewClippingEnabled`, which does
`mAllChildren[indexOfChildInAllChildren(view)]` — that returns `-1` for a view
already detached, and the out-of-bounds access becomes the message above.
`parent [66]` was the `AndroidHorizontalScrollContentView` of the slide list,
and the hierarchy dump showed nine `RCTText` children, six of them with
`parentTag=null` (clipped, i.e. detached).

Two things combined:

1. **`FlatList` turns subview clipping on by default on Android**
   (`removeClippedSubviewsOrDefault` in `Libraries/Lists/FlatList.js` returns
   `Platform.OS === 'android'`). Clipping detaches off-screen children, so by
   the time the list unmounts the native child list and Fabric's shadow tree
   disagree.
2. **View flattening removed the slide wrapper.** The wrapper `View` had only
   layout styles, so Android dropped it and hoisted its three `Text`s into the
   scroll content view — three slides became nine direct children, and the
   index Fabric asked to remove was never the index that existed.

The fix is both halves, in `OnboardingScreen.tsx`: `removeClippedSubviews={false}`
on the list, and `collapsable={false}` on the slide wrapper so it survives
flattening. Guarded by a test in `src/screens/auth/auth.test.tsx` ("keeps every
slide mounted as its own native view") — a unit test cannot reproduce a native
crash, so it asserts the two props instead.

**The same shape exists elsewhere.** Any horizontal paging `FlatList` whose
item is a layout-only wrapper is exposed. `PhotoGallery.tsx` and
`PhotoLightbox.tsx` were given `removeClippedSubviews={false}` for the same
reason; their items are an `Image` and a `ScrollView`, which are not flattened,
so they need no `collapsable`. Clipping is a memory optimisation for long
lists — on a three-slide or a photo list it buys nothing. Prefer turning it
off on short horizontal lists.

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

### Product changes after E05 testing (milestone E17, #200–#202)

- **C-7 A pitch that lends no shirts says so** on the teams step ("This
  pitch doesn't lend shirts. Bring your own bibs or colours.") and the step
  is titled "Teams" there. Web and mobile.
- **C-6 How long, then a start time** (reversed 2026-10-21 after testing).
  The time step asks "How long?" first, from the pitch's minimum to maximum
  in half hours (the shortest is chosen to begin with), then lists start
  times in Morning / Afternoon / Evening groups. A start without room for
  the whole chosen length (before the next booking or closing) is disabled
  and read as "not enough time"; a length no start has room for is
  disabled. Choosing a longer length that the picked start can't take lets
  the start go; it is never shortened. (The old order kept a start and
  silently shortened the length to what fitted, which players read as a
  booking "half an hour off".) The start is kept as a time, not a position
  in the list. Shared rules: `durationChoices` and `startOptions` in
  `booking.ts`.
- **C-8 Pay at the venue.** `Company.paymentMode` (`ONLINE`, the default;
  `ONLINE_OR_VENUE`; `VENUE`) and `Company.depositPercent` (0–50, default
  20), set on `/manager/settings`. Players with trust 70+ may pay at the
  venue: (a) `VENUE_REFUND_DEPOSIT`, the deposit is refunded when the
  manager confirms they came and they pay the full price there; or (b)
  `VENUE_DEPOSIT_TOWARDS`, the deposit counts and they pay the rest there.
  With a 0% deposit nothing is charged online and the booking is confirmed
  at once. Below 70 a player pays online; at a venue-only venue they cannot
  book (the server refuses with `PAYMENT_METHOD_UNAVAILABLE`). The booking
  records `paymentMethod`, `depositAmount`, `dueAtVenue` and `attendedAt`.
  Cancelling refunds the deposit by the usual tiers. The minimal
  `/manager/bookings` page lists upcoming bookings and those started in the
  last 7 days, with **Confirm attended** (refunds the deposit for (a)) and
  **Report no-show** (from 30 minutes after kick-off: the venue keeps what
  was paid online, trust −20, the player is notified and can dispute).
  Rules shared in `packages/shared/src/payment.ts`. Web and mobile.

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

### Product changes after E13 testing (milestone E17, C-9 … C-13)

- **C-9 Late cancellation costs trust from 12 hours**, not 24: −5 under 12
  hours before kick-off, −10 under 2. The same at every venue.
- **C-10 Each venue's refund policy.** Default: everything back from 12
  hours before kick-off, 75% from 2 hours, nothing after. A manager sets the
  hours and the percentage in Settings; a booking keeps a copy of the policy
  it was made under (`Booking.refundPolicy`; none means the default).
  Shown on the pitch page, at checkout and on the booking.
- **C-11 The manager hears of every booking** (`BOOKING_RECEIVED`), in-app,
  by email, and by push once Firebase is set up. Muteable ("New bookings",
  shown to managers only).
- **C-12 The manager can cancel or decline** a booking, with a reason the
  player reads: everything paid online back, no trust lost.
- **C-13 Settings and approving by hand.** Settings has three tabs:
  Bookings and payments (approve automatically, the default, or each by
  hand; the refund policy; how players pay), Venue details (the onboarding
  forms) and Your account (links to the manager's own profile pages).
  - Approving by hand: a paid booking is `AWAITING_APPROVAL`, holding the
    slot; Accept confirms it, Decline refunds it. Unanswered, the hourly job
    declines and refunds it 24 hours after payment or 2 hours before
    kick-off, whichever is first (by kick-off for bookings made later). The
    player may withdraw a waiting request with everything back.
  - Venue details are approved again: a change is a proposal
    (`Company.pendingChanges`) that an admin approves or turns down on
    `/admin/companies`; the live page keeps the approved details meanwhile.
    The manager can withdraw it.

New endpoints: `POST /manager/bookings/:id/accept`, `POST
/manager/bookings/:id/cancel`, `GET/PUT /manager/settings/bookings`, `GET/DELETE
/manager/venue`, `PUT /manager/venue/{info,location,contact-hours}`, `GET
/admin/venue-changes`, `POST /admin/venue-changes/:companyId/{approve,reject}`.
Schema: `BookingStatus.AWAITING_APPROVAL`, three notification types,
`Company.autoApproveBookings`, `refundFullHours`, `refundPartialHours`,
`refundPartialPercent`, `pendingChanges`, `changesSubmittedAt`,
`changesRejectionReason`, `Booking.refundPolicy`, `Booking.approvalDeadline`.

### C-14 Covered season (winter dome, cold or hot air)

Plan: `docs/PLAN_COVERED_SEASON_AND_SUBSCRIPTIONS.md` (part A).

- Without a dome a pitch keeps **one price all year** (`Pitch.hourlyRate`).
- A venue may cover a pitch for **date ranges** (`PitchCoveredSeason`,
  first and last day included, on the venue's calendar; at most 200 days,
  no overlaps, starting today or later). While covered it offers **cold
  air, hot air or both**, each at its own **full** hourly price
  (`Pitch.coveredColdRate`, `coveredHotRate`; null = not offered). A season
  needs at least one of them, and the last one cannot be removed while a
  season exists (`COVERED_NEEDS_AIR`).
- **The booking's date decides the price**, not hour by hour. Cold air is
  the default; the player picks only when both are offered. The rate and
  the air are **snapshotted** on the booking (`pitchRateSnapshot`,
  `Booking.airType`): changing rates or seasons never reprices a booking.
- Rules in `packages/shared/src/covered.ts` (`isCoveredOn`, `airOptionsOn`,
  `rateFor`). The availability response carries the day's `covered`,
  `hourlyRate` and `airOptions`, so neither client repeats the rules.
- Managers set it on the pitch's Pricing tab (web only): the air prices save
  with the rest, the dates save at once, like blocked dates. Discover's
  "price from" stays the lowest uncovered rate.
- Seed: Bună Ziua's Teren 1 (cold 180, hot 220) and Sopor's Teren A (cold
  240 only), covered from 1 November (or today, in winter) to 31 March.

New endpoints: `POST /pitches/:id/covered-seasons`, `DELETE
/pitches/:id/covered-seasons/:seasonId`; `PUT /pitches/:id/pricing` takes
`coveredColdRate`, `coveredHotRate`; `POST /bookings` takes `airType`
(400 `AIR_NOT_OFFERED` when that air isn't offered that day). Schema: `enum
AirType`, `PitchCoveredSeason`, the two `Pitch` rates, `Booking.airType`
(all nullable or new: `prisma db push`, no data migration).

### C-15 Venue subscriptions, no commission

Plan: `docs/PLAN_COVERED_SEASON_AND_SUBSCRIPTIONS.md` (part B, decisions
1–9). Owner's decisions of 2026-10-21:

- **PitchUp takes no commission.** `Booking.platformFee`,
  `PlatformConfig.platformFeePercent`, `PLATFORM_FEE_PERCENT` and every fee
  and payout figure (booking detail, analytics, CSV, admin) are gone; the
  app is in test mode, so no fee history was kept.
- **Venues pay a subscription**, monthly or yearly (10 × monthly), VAT
  included: 10 lei/month or 100/year in the first paid year, 30 or 300
  after, plus 5 lei/month (50/year) for each **active** pitch beyond 2,
  counted when each bill is made. All are admin settings
  (`PlatformConfig.sub*`), these the defaults. Rules in
  `packages/shared/src/billing.ts` (`subscriptionPrice`, `isSubscribed`).
- **A free month first** (once per venue), card on file first; the
  discounted year starts when it ends (`Company.firstPaidAt`).
- **Onboarding is unchanged.** After approval the manager starts the free
  month in Settings → Subscription. Until then, and when a subscription is
  paused (unpaid 7 days after a failed bill) or has ended, the venue is
  **hidden and takes no new bookings** (`lib/venues/live.ts`, reason
  `VENUE_PAUSED`) but keeps the bookings it has. Paying brings it back
  without an admin.
- Statuses: `NONE → TRIALING → ACTIVE ⇄ PAST_DUE → PAUSED`, and
  `CANCELLING` until the paid period ends. Monthly/yearly changes apply
  from the next bill.
- **Providers**: Stripe Billing when the keys are set (the venue is its own
  Stripe customer; one Product, each bill priced inline; the webhook keeps
  the status; the daily job reprices a day before renewal). Otherwise the
  test provider: no card, the daily job bills when a period ends, and
  `POST /payments/test/subscription { outcome }` makes the next bill pay or
  fail.
- **Existing venues**: the seed puts demo venues in their free month with a
  test card; any other approved venue without a subscription gets a free
  month without a card and is paused when it ends unless one is added
  (`seedSubscriptions` in the seed).
- Managers see a banner on every page (web) and on Venue bookings and
  Analytics (app) while not live, in a free month without a card, after a
  failed payment, or paused; the subscription is managed on the web.
- Admin: Platform settings has the prices; the venue list a Subscription
  column and filter; the venue page status, interval and period end; the
  overview PitchUp's revenue (paid `SubscriptionInvoice`s) and venues by
  subscription status.

New endpoints: `GET /manager/billing`, `POST /manager/billing/{subscribe,
cancel,resume}`, `PUT /manager/billing/interval`, `POST
/payments/test/subscription`, `/cron/billing` (daily, vercel.json). The
webhook handles `customer.subscription.*`, `invoice.paid`,
`invoice.payment_failed`. Schema: `BillingInterval`, `SubscriptionStatus`,
`SubscriptionInvoice`, `NotificationType.SUBSCRIPTION_NOTICE`, the
`Company` subscription fields, the `PlatformConfig.sub*` prices; dropped
`Booking.platformFee` and `PlatformConfig.platformFeePercent` (`prisma db
push --accept-data-loss`, then `pnpm db:seed` to give venues their month).

### #188 Client IP and the per-account sign-in limit

Owner's decisions of 2026-10-22: 10 failed sign-ins per 15 minutes per
address (a stranger can lock an address out for 15 minutes; accepted),
`TRUSTED_PROXY_HOPS` defaults to 1, a throttled web sign-in says so.

- **Client IP**: `getClientIp` (`lib/api/rate-limit.ts`) returns the
  `X-Forwarded-For` entry `TRUSTED_PROXY_HOPS` from the right (the leftmost
  if the header is shorter), then `x-real-ip`, then `'unknown'`.
  `TRUSTED_PROXY_HOPS` is a server variable in `lib/env.ts`, an integer ≥ 1.
  No Vercel special case: Vercel overwrites the header, so 1 is right there.
- **Per-account limit**: `checkPassword` in `lib/auth/service.ts`, used by
  the mobile login (`loginWithPassword`) and the web `authorize`. Key
  `login-account:<email lowercased and trimmed>`, any address counted,
  registered or not. Read with `peekRateLimit` **before** the password is
  compared (while throttled, even the right password is refused); only
  wrong passwords and unknown addresses are counted (`checkRateLimit`).
  Limit in `AUTH.ACCOUNT_LOGIN_FAILURE_LIMIT` / `ACCOUNT_LOGIN_WINDOW_MINUTES`.
  `LoginSchema` now trims the email, so ` a@x.ro` is the same address.
- Mobile gets the IP limit's answer: 429 `RATE_LIMITED`, `api.tooManyLogins`,
  `details.retryAfterSeconds`; no new reason, no app change.
- Web: `authorize` throws `LoginThrottled` (a `CredentialsSignin`, code
  `rate_limited`); `LoginForm` shows `auth.login.tooMany` instead of
  `auth.login.wrong`, without the "not verified" hint.
- Per-IP limits are unchanged and still apply on top; web sign-in still has
  no per-IP limit (separate ticket). `POST /dev/reset-rate-limits` clears
  the per-account counters too (one map).

No new endpoints, no schema change.

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
  without a live account. Reversed in part on 2026-10-20: with
  `TWILIO_VERIFY_SERVICE_SID` set, Verify is used (a trial account can't
  send our own texts); without it, the code is still ours.
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

- **The player pays the pitch price, all of it the venue's.** E05-05's 5%
  fee on top of the price is not used. PitchUp's 8% commission (PRD §8) was
  removed by C-15 along with `Booking.platformFee`: venues pay a
  subscription instead. `Booking.totalAmount` is what the player pays.
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

### E09 — Onboarding & Dashboard

- **Manager pages are `/manager/*`**, not `/dashboard/*` (the owner's call);
  `/dashboard` redirects by role.
- **The access guard is in the layouts and API routes, not the edge
  middleware**, which cannot read the database. The middleware only checks
  for a session cookie on `/manager` and `/onboarding`.
- **Hours keep the existing format** (`[{day, openTime, closeTime,
isClosed}]`, 0 = Sunday), which Discover and the calendar already read,
  rather than the ticket's new shape. A closing time before the opening time
  means closing after midnight.
- **The logo is optional**; uploads need Cloudinary, and a venue may not
  have a logo yet.
- **Coordinates are optional.** Geocoding happens in the browser; the server
  geocodes only with its own key. A venue without coordinates is listed but
  not on the map.
- **Approval is a minimal admin page** (agreed), not the E15 panel.
- **Sections not built yet (Calendar, Bookings, Pitches, Analytics,
  Settings) show as "Soon"** in the sidebar instead of dead links.
- **Validation errors are 400**, like the rest of the API.
- **Seeded venues have no Stripe account**; anything not in DRAFT counts as
  past the payouts step.

### E15 — Admin Panel

- **Statuses kept as they are** (DRAFT, PENDING, ACTIVE, SUSPENDED): the
  tickets' APPROVED is ACTIVE, and REJECTED is "sent back" to DRAFT with a
  reason, so the manager fixes and resubmits (E09).
- **Venue and user detail are pages, not side panels**: linkable, and simpler
  to make accessible.
- **Trust adjustments go through the trust engine** (clamped, the monthly
  replay agrees), with the reason on the event and a notice to the player.
- **Deleting is for players only**, the same as their own deletion (bookings
  refunded, details wiped); a manager's or admin's account is suspended.
- **No default no-show fee setting**: there is no no-show fee (the venue
  keeps what was paid online, C-8).
- **The settings are cached in memory for a minute**, not with Next's data
  cache, which is kept on disk and served stale settings after the database
  was reset. Another server instance sees a change within the minute.
- **Maintenance is checked in the root layout and the API wrapper**, not in
  the edge middleware, which can't reach the database; the middleware only
  passes the path along.
- **Ratings need no recalculation** after a review is deleted: they are
  worked out from the reviews each time.
- **The seed adds no disputes or reported reviews**: every test shares the
  seeded database, and extra open disputes would upset the tests that count
  them. The tests create their own.
- **Not-admins are sent to their own area**, not to `/login`, when signed in;
  signed out, to `/login`.

### E14 — Analytics

- **Venue time, not UTC.** The tickets aggregate in UTC with `DATE_TRUNC`;
  that would put a 22:00 game on the next day for half the year. Figures are
  worked out in JavaScript in the venue's days and hours instead (one pass
  over the period's bookings and opening hours).
- **Occupancy is booked over open time**, from each pitch's real hours and
  closures, rather than a count over a guessed number of slots. Hours never
  open are `null` (hatched on the heatmap), so "closed" and "empty" differ;
  rows show the hours anyone was open, Monday first.
- **The server fills the gaps** in the revenue series; the tickets left it
  to the client.
- **No Recharts** (web) and **no react-native-svg** (mobile): the web chart
  is a small SVG with a table view, the phone's bars are plain Views, so no
  new dependency and no new native module.
- **RON, not pence or £.** Amounts are in RON with bani, as stored.
- **The dashboard renders on the server** from the URL, like the bookings
  list, rather than four client queries. No skeletons: a `loading.tsx` made
  Next 15.5 answer the filters' navigation with an empty response, so the
  filters show "Updating…" and wait instead.
- **Rates as % change**, as the tickets have them; a period with nothing
  before it shows "No earlier data".
- **The CSV has no trust score** (managers don't see it, PRD §9.1), a BOM
  for Excel, and cells starting with `= + - @` prefixed so they aren't run
  as formulas.

### E13 — Notifications

- **The existing `Notification` and `DeviceToken` models are reused**, with
  `deliveredAt` added, rather than new tables; `FcmToken` would duplicate
  `DeviceToken`.
- **Push uses FCM's HTTP v1 API directly**, signing the service account's JWT
  with Node's `crypto`, instead of adding `firebase-admin`. Dead tokens are
  removed when FCM says they're unregistered.
- **No React Email.** The emails use the existing HTML layout; three notices
  have their own template, the rest a generic one with a button.
- **An outbox, not sending inside the request.** The row is written in the
  transaction and delivered after the response; the hourly job is the safety
  net, and only for rows from the last two hours, so old rows aren't mailed
  out when the job first runs.
- **SMS only for urgent kinds** (reminders, a venue cancelling, a no-show), and only
  when the user switched it on. **Removed 2026-10-20**: no text
  notifications for launch (see "Text messages: phone codes only").
- **Muting is by group** (confirmed, reminders, cancellations, no-shows,
  reviews, trust); account and venue-approval notices can't be muted.
- **The existing `PATCH` read endpoints are kept**, and validation errors are
  400 as everywhere else, not 422.
- **No notice for a failed payment**: the checkout page already says so, and
  an unpaid booking simply lapses.
- **A trust tier change is its own notice** (`TRUST_TIER_CHANGED`). When it
  happens in a background job it is delivered by the next hourly run.
- **The 2-hour reminder type exists but nothing sends it yet**; only the
  24-hour reminder is scheduled.

### E12 — Penalty & Trust

- **Exactly 2 hours before kick-off counts as a late cancellation (−5)**,
  not very late, matching the refund tiers (50% back from 2 hours). The
  ticket's "no penalty at exactly 2h" contradicted its own table.
- **Only a confirmed booking's cancellation costs trust**; abandoning an
  unpaid checkout doesn't, nor does cancelling because the account is
  being deleted.
- **The history records each event's defined delta; the monthly job
  replays them with the clamp at every step** (`replayTrustScore`). Past
  the +10 monthly cap on completions no event is written at all, so the
  history and the score always agree.
- **Fair and Poor "card on file"**: their card is kept on their Stripe
  customer when they pay (`setup_future_usage`), rather than refusing a
  first booking until a card is saved. Poor players pay in full online
  (paying at the venue needs 70+, C-8) and hold one upcoming booking.
- **Pitch minimums are 0, 50, 70 or 90** (a tier's lower bound); "Poor" is
  not offered because Suspended players can't book anywhere.
- **Disputes use the existing `NoShow` row** (dispute status, resolution,
  resolver) rather than a new `Dispute` model. A player who wins gets +10,
  the booking counts as played, and a kept "deposit back" deposit is
  refunded. Managers have no trust score, so a wrong report costs the
  venue nothing (the ticket's open question).
- **A minimal `/admin/disputes` page** came with the endpoints so disputes
  can be decided now; E15 builds the full panel.
- **The trust history** is E08's `GET /profile/trust-score` (already paged
  with a cursor), not a second endpoint.
- **A completed game later reported as a no-show keeps its +2.**

### E11 — Calendar & Bookings

- **Another venue's booking is a 404**, not the ticket's 403.
- **No-shows from 30 minutes to 4 hours after kick-off**: PRD §9.3's 30
  minutes and the ticket's 4-hour limit together. Completed games (settled
  by a player's read) can still be reported inside that window. No no-show
  fee is charged (the venue keeps the deposit or the online payment, C-8);
  the trust change is still the direct −20 until E12.
- **Manager pages don't settle bookings when they read** (players' pages
  still do): a finished game stays Confirmed until the manager confirms
  attendance, reports a no-show or marks it complete, or the nightly job
  settles it.
- **The booking opens on its own page**, not a slide-in panel; the list
  links to it. "Confirm attended" and "Report no-show" moved there from
  C-8's list.
- **Pitch colours are derived, not stored**: by the pitch's place among the
  venue's pitches (deleted ones included), from the ticket's eight shades
  darkened for WCAG AA with white text. Played games are grey with the
  pitch colour on the side rather than faded (fading fails contrast).
- **The calendar draws the venue's opening hours** (widened to fit every
  booking), not a fixed 07:00–23:00.
- **CSV columns:** date, start, end, player, pitch, status, price, payment,
  due at the venue, reference. Fee and payout are on the booking page.
- **`calcPrice` is `bookingPrice`** in half-hour slots (C-2); there is one
  pricing function, not two. `generateSlots` and `isWithinNoShowWindow` are
  shared.
- **Mobile** filters by status and pitch; no date filter yet.

### E10 — Pitches & Pricing

- **Pricing follows C-2**: one hourly rate. The shortest booking is 1h,
  1h 30 or 2h and the longest 2h to 4h in half hours (the owner asked for
  half hours; `minBookingHours`/`maxBookingHours` are now decimals). "No
  limit" is not offered: 4 hours is the app-wide maximum.
- **Shirts follow C-1**: a "Lend shirts" switch and sets per colour, no
  price. Fewer sets than upcoming bookings were promised is **409**
  `SHIRTS_PROMISED` (not 412) with the booking ids; `force: true` saves
  anyway, and the tab offers that.
- **A pitch needs a price as well as a photo to be switched on** (the
  ticket allowed 0 RON; that would break payments). A new pitch is created
  at 0 RON, inactive.
- **Another venue's pitch is a 404**, not the ticket's 403, like bookings.
- **Photos reorder by drag and drop (native HTML) or with "Move
  earlier/later" buttons** for keyboards; no `@dnd-kit` dependency.
  Uploads show a status per file rather than a progress bar (`fetch` has no
  upload progress).
- **Blocked dates can't be added over bookings** (409 with the booking
  ids); there is no `force`, because managers can't cancel bookings until
  E11.
- **Pitches of a venue awaiting approval** can be created through the API
  (the ticket's pre-setup); the dashboard itself opens after approval, and
  pitches do not switch on by themselves.
- **The unsaved-changes dot** shows on the open tab only.

### C-6, C-7, C-8

- **Reporting a no-show was built here, minimally**, because C-8 needs it:
  status `NO_SHOW`, a `NoShow` row whose `penaltyAmount` is what the venue
  keeps (the deposit or the online payment), trust −20 with its history
  event, and a notification. PRD §9.3's flat fee and 20% penalty, and paying
  the venue out, are still E11/E14.
- **Settings shows the deposit in steps of 5%** (the API takes any whole
  number from 0 to 50). The rest of Settings is E12.
- **Attendance is confirmed from kick-off**, a no-show from 30 minutes after
  (PRD §9.3); neither has an end date yet.

## Known gaps

- **A client component with webpack module id 0 vanishes.** Next leaves it
  out of the client manifest and its page fails at runtime ("Could not find
  the module … in the React Client Manifest"). Ids follow file paths, so it
  hit `SummaryStep.tsx` when E15 added modules; renamed `SummaryAndPay.tsx`.
  If a page suddenly fails like that, check its component's id in the
  page's client chunk (`{0:(e,t,a)=>`) and rename the file.
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

- **iOS builds and launches** (fixed 2026-10-19). `pnpm ios` from
  `apps/mobile` builds, installs and runs on simulator; the sign-in screen
  renders and the JS bundle loads over Metro. Three unrelated things were
  broken at once:
  - The machine's system Xcode is 27.0, which replaced Simulator.app with
    DeviceHub.app — don't force `DEVELOPER_DIR` to an older Xcode install for
    iOS builds, it breaks CoreSimulatorService (`Failed to launch
AssetCatalogSimulatorAgent`).
  - react-native-screens@4.16.0 has the linker bug described above under
    "React Native version constraints" — fixed via
    `patches/react-native-screens@4.16.0.patch`.
  - Xcode 27's SDK requires UIScene lifecycle adoption or the app is killed
    right after launch; `Info.plist` now declares
    `UIApplicationSceneManifest` and `AppDelegate.mm` implements scene
    connection (including attaching the window to the actual `AppDelegate`
    singleton — the scene-delegate class UIKit instantiates from
    `configurationForConnectingSceneSession:` is a _second_, separate
    instance whose `window` is nil).
  - Pods also needed their minimum iOS deployment target raised to 15.1 and
    a CocoaPods `Pathname` patch in the `Podfile` for pnpm's
    null-byte-containing symlink paths, both required to build under Xcode 27.
    Not yet verified beyond the sign-in screen: the seven auth screens, and
    everything past login (same gap as Android, see below).
- **Test coverage stops at the device.** Unit, API and browser E2E cover
  backend and web; mobile has unit/component tests with mocked native modules
  only. Nothing runs the app on a device yet (#187). `pnpm format:check` is
  not in CI until its CRLF noise on Windows is sorted out (docs/TESTING.md).
- **The per-IP limits trust `X-Forwarded-For` only as far as the proxies
  in front** (#188): `getClientIp` reads the entry `TRUSTED_PROXY_HOPS`
  (default 1) from the right, which is right on Vercel and behind one
  appending proxy. A directly exposed `next start` keeps a header the client
  sent, so there the per-IP limits are still spoofable. Sign-ins are also
  limited **per address** (10 failures per 15 minutes, web and mobile
  together), which no header changes. Counters stay per process (Redis in
  v1.1).
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
  bundle and the first render are confirmed. Finishing the slides used to
  crash Fabric; fixed — see "Android: horizontal lists must not clip their
  subviews". The seven auth screens have not
  been walked through on a device against a live API;
  `docs/TESTING_E02_MOBILE.md` is the plan for doing that and has not been run.
- **`pnpm lint` is weaker than `next build`.** The build caught an unused
  import that lint passed, because the root ESLint config ignores `.next`
  and Next runs its own pass. Worth aligning before CI exists.
- **Nothing has been delivered to a real inbox or handset.** Templates and
  the signing algorithm are verified; delivery and rendering are not. Push
  (E13) has only run against a fake FCM; the real Firebase project exists
  now, but no phone with the app has received one yet.
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
  in later tickets but are not in the PRD or the schema. **Decided for E15
  (2026-10-17):** admins may adjust a player's score with a reason
  (`ADMIN_ADJUSTMENT`, in the history like any event); no manager score for
  now, admins see the venue's facts instead. `PROFILE_VERIFIED` stays
  dropped (E12).
- **E14 revenue (decided 2026-10-17):** the full value of played bookings,
  online and paid at the venue, with the split shown, less refunds.
- **Players who sign in on the web go to `/discover`**, not `/dashboard`.
  E02-13 sends every login to `/dashboard`, which is the manager area and has
  nothing for a player. The dashboard now redirects players; managers and
  admins are unaffected.
- **When to upgrade React Native.** The 0.76 pin is already forcing an
  rn-screens downgrade and two patches, and that cost will grow.
- The GitHub token in use is shared in the session transcript and should be
  rotated when the project is done with it.

## Running it

See `README.md` for setup.

**`pnpm dev` is for changing code; `pnpm preview` is for trying the app.**
The dev server compiles each page the first time it is opened (5–10 s for
some pages), ships unminified code, and re-renders without caches. `pnpm
preview` builds the production version into `apps/web/.next-preview` and serves
it on port 3000: pages answer in about 15–50 ms and API calls in 5–15 ms
(measured locally). Rebuild it after changing code. Every database query is
no longer printed by `pnpm dev`; set `PRISMA_LOG_QUERIES=1` to see them. `docs/ARCHITECTURE.md` explains why the
infrastructure is shaped the way it is — worth reading before changing the
schema or the auth flow. `docs/TESTING_E02_MOBILE.md` is the manual test plan
for the mobile auth screens.
