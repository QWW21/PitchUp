# Architecture — what is built and why

A walkthrough of the decisions behind PitchUp so far: the infrastructure
(E01, sections 1–10), auth (11), Discover (12), venue time and availability
(13), the product changes after the E04 review (14), testing (15),
bookings and payments (16), what happens to a booking afterwards (17) and
reviews and the first manager page (18), and the player's own account (19). Each
section is a problem, the options, and why one was chosen, and ends with
**what to learn** to understand it properly. Written for someone who knows
React Native and is learning the backend and system-design side.

---

## 1. The monorepo and `packages/shared`

Two clients, one set of rules. A player's password must be ≥8 characters with
an uppercase and a digit — the mobile form should say so before a request is
sent, and the API must enforce it regardless, because an attacker can skip the
form entirely.

Three ways to handle that:

| Approach                      | Problem                                           |
| ----------------------------- | ------------------------------------------------- |
| Write the rule twice          | They drift. One is fixed, the other is forgotten. |
| Validate only on the server   | Every typo costs a round trip.                    |
| Write it once, import in both | What `packages/shared` is for.                    |

So `RegisterPlayerSchema` lives in `packages/shared/src/schemas/auth.ts`, and
both `apps/web` and `apps/mobile` import it.

**The constraint this creates.** Shared code is bundled by Metro for React
Native, which has no Node standard library. So nothing in `packages/shared`
may import `fs`, `path`, or `crypto`. That is why the age check in
`schemas/auth.ts` does date arithmetic by hand rather than pulling in a date
library with Node dependencies, and why hashing lives in `apps/web`, never in
shared.

**Client validation is a convenience, never a control.** The server re-parses
every request body with the same schema. Sharing the schema removes
duplication; it does not let the server trust the client.

### One source of truth, applied

`CITIES` is defined once in `packages/shared/src/constants/cities.ts`.
`prisma/seed.ts` imports it to populate the `City` table, and the city pickers
import it to render options. Add a city in one place and the database, the web
dropdown and the mobile picker all agree. Had the seed carried its own copy,
they would silently diverge the first time one was edited.

---

## 2. The Prisma client singleton

`src/lib/prisma.ts` is eleven lines and exists entirely because of one
development-mode behaviour.

```typescript
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ ... })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Next.js hot-reloads by re-executing changed modules. A plain
`export const prisma = new PrismaClient()` therefore opens a **new connection
pool on every save**. After an afternoon of editing, Postgres refuses new
connections and the app dies with an error that points nowhere near the cause.

`globalThis` survives module reloads, so the client is created once and reused.
The production branch deliberately skips the global — each serverless instance
should own its client, and leaking it to global scope there risks sharing
state across requests.

This is a general pattern: **anything holding a connection pool needs the same
treatment** — Redis, a message queue client, an HTTP agent.

---

## 3. Schema design

`prisma/schema.prisma` has four decisions worth understanding.

### Money is `Decimal`, never `Float`

```prisma
hourlyRate  Decimal  @db.Decimal(10, 2)
```

Floating point cannot represent `0.1` exactly. Accumulate enough arithmetic and
`80.00 + 0.10` becomes `80.09999999999999`. On a booking total it rounds away;
across a month of Stripe payouts it becomes a reconciliation problem.
`Decimal(10, 2)` stores exact base-10 values with two decimal places.

The rule: **money, never float.** Either `Decimal` or integer minor units
(storing bani rather than lei).

### `onDelete`: `Cascade` versus `Restrict`

```prisma
pitch   Pitch @relation(..., onDelete: Cascade)    // on PitchPhoto
pitch   Pitch @relation(..., onDelete: Restrict)   // on Booking
```

The question for each relation is: _if the parent disappears, is the child
meaningless, or is it evidence?_

- A photo of a deleted pitch is meaningless → `Cascade`, delete it too.
- A booking of a deleted pitch is **a financial record**. Someone paid. It is
  needed for refunds, disputes, tax → `Restrict`, refuse to delete the pitch
  while bookings reference it.

Getting this backwards means a manager removing a pitch silently destroys the
payment history attached to it.

`User.deletedAt` exists for the same reason: PRD §6.5 says account deletion is
a soft delete, because the bookings must survive the user.

### Snapshots on `Booking`

```prisma
pitchRateSnapshot  Decimal
shirtSets          Int
platformFee        Decimal
totalAmount        Decimal
```

The price is copied onto the booking rather than read from the pitch at display
time. If a manager raises the hourly rate from 80 to 100 lei, every past
booking must still show what was actually charged. Joining to the live pitch
would silently rewrite history. `shirtSets` is the same idea: how many sets
were lent, even if the pitch later stops lending shirts.

**Rule of thumb: copy a value when you need what was true at that moment;
reference it when you need what is true now.**

### Derived versus stored — the trust tier

This is the decision I would most want you to take away.

A player has `trustScore` (0–100). Their tier — Excellent, Good, Fair, Poor,
Suspended — is a band of that score. The E12 ticket wanted a `trustTier`
column alongside the score.

That creates **two sources of truth that can disagree**. Every place that
changes a score must remember to recompute the tier. Miss one — an admin
adjustment, a failed transaction, a data migration — and the score says 95
while the column says `Poor`. Which is right? There is no way to tell from the
data, and the bug is invisible until a player is wrongly blocked.

Storing it buys one thing: you can filter and sort by tier in SQL.

The alternative is a function:

```typescript
export function deriveTier(score: number): TrustTierLabel {
  if (score >= 90) return 'Excellent'
  // ...
}
```

Now the tier cannot be wrong, because it is not stored. The admin filter
becomes a range query on the score instead — `trustScore: { gte: 90 }`.

**Default to deriving.** Store a derived value only when you have measured that
computing it is too slow, and then treat the stored copy as a cache with a
clear rule for rebuilding it.

---

## 4. Fail fast: environment validation

`src/lib/env.ts` parses `process.env` against a Zod schema at startup, and the
root layout imports it so it runs on boot.

Without this, a missing `STRIPE_SECRET_KEY` is discovered when the first
customer tries to pay. With it, the build fails and names the variable.

**The general principle: detect a configuration error at the earliest possible
moment.** Startup is better than first request, which is better than first
request _of that feature_.

Two details:

- `emptyStringAsUndefined: true` — a blank `FOO=` in `.env` is treated as
  unset. Otherwise `""` is a valid string and passes a `z.string()` check.
- Integrations not yet built are optional, **but their format is still
  enforced when present**. A `STRIPE_SECRET_KEY` starting with `pk_` (the
  publishable key — a classic mix-up) is rejected rather than ignored.

---

## 5. The API response envelope

Every endpoint returns the same shape:

```typescript
{ data: T,    error: null }
{ data: null, error: { code, message, details? } }
```

Without a convention, each client call site invents its own success check —
`if (res.ok)`, `if (data.user)`, `if (!data.message)`. Error handling ends up
inconsistent and some failures get rendered as content.

With one envelope the mobile client writes a single wrapper:

```typescript
if (response.error) {
  showError(response.error.code)
  return
}
```

`error.code` is a **stable string**, not a status code. `CONFLICT` means a slot
was taken; the client can show a specific message and refresh the slot picker.
HTTP 409 alone does not carry that meaning.

`withErrorHandling` wraps every route so an unexpected throw becomes a 500 in
the same shape, and the internal message goes to the server log rather than to
the client. **Error text leaks information** — a raw Prisma error reveals table
and column names.

---

## 6. Authentication

### Two layers, deliberately

```
middleware.ts        Edge    page routes    → redirect to /login
lib/api/middleware   Node    API routes     → JSON 401
```

Pages redirect; APIs return JSON. A mobile client cannot follow a redirect to
an HTML login page — it needs a 401 it can act on by refreshing its token.

Edge middleware only checks that a session **cookie exists**; it does not
verify it. Edge cannot run Prisma, so real verification is impossible there.
The page's own `auth()` call is the actual gate. The middleware is a UX
optimisation that avoids rendering a protected shell to an obviously
signed-out visitor — **not a security boundary**. Treating it as one would be
the mistake; a forged cookie passes the middleware and is rejected by the page.

### Not leaking which emails are registered

PRD §6.6 requires that a wrong password and an unknown email are
indistinguishable. Returning the same error message is the obvious half. The
subtle half is time:

```typescript
const DUMMY_HASH = bcrypt.hashSync('invalid-password-placeholder', 12)
// ...
const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
```

bcrypt at cost 12 takes roughly 250ms by design. If the code returns early when
no user is found, that path answers in ~5ms and the registered path in ~250ms.
An attacker measures the difference and enumerates your user base — the
messages were identical, the clock was not.

Comparing against a dummy hash makes both paths do the same work. Measured:
305ms versus 306ms.

**This generalises: any check on a secret should take the same time whether or
not the secret exists.** Timing is a side channel, as real as a response body.

### Why bcrypt is slow on purpose

Cost 12 means 2¹² internal iterations. For one login, 250ms is unnoticeable.
For an attacker with a stolen database trying billions of guesses, it is the
difference between hours and centuries. The slowness _is_ the feature — which
is why you never "optimise" it, and why a fast hash like SHA-256 is wrong for
passwords.

---

## 7. Rate limiting, and being honest about it

`lib/api/rate-limit.ts` keeps counters in a `Map`. PRD §6.6 asks for 5 login
attempts per 15 minutes per IP.

What it genuinely does: stops a single client hammering one server instance.

What it does **not** do, and the code says so:

- Counters are per process. Two serverless instances mean two independent
  budgets.
- They reset on restart or deploy.
- `x-forwarded-for` is a client-supplied header. Behind a trusted proxy it is
  reliable; directly exposed, it is trivially spoofed.

So it is a throttle, not a security control. A distributed attempt walks past
it. The production answer is a shared store (Redis), which v1.1 is noted for.

**The lesson is not the Map. It is that a control with known limits, written
down, is safe — and the same code with a comment saying "prevents brute force"
is dangerous**, because the next person builds on a guarantee that was never
there.

One detail: the map evicts expired entries past 10,000 keys. Otherwise a
long-running process accumulates an entry per IP forever — a slow memory leak
that only shows up in production.

---

## 8. Signed direct uploads

Pitch photos could be uploaded to the Next.js server, which forwards them to
Cloudinary. That means every megabyte crosses your server twice, and serverless
functions have request size limits and short timeouts.

The pattern used instead:

1. Client asks `POST /api/v1/upload/sign` for permission.
2. Server checks auth, file size and MIME type, then returns a **signature** —
   an HMAC of the upload parameters made with the API secret.
3. Client uploads **directly to Cloudinary** with that signature.
4. Cloudinary verifies the signature and accepts the file.

Image data never touches your server. The API secret never leaves it.

**The check happens before the signature is issued**, because that is the last
moment you control. Once the signature exists, the upload bypasses you
entirely — validating afterwards is validating nothing.

`lib/cloudinary.ts` starts with `import 'server-only'`. If anyone ever imports
it from a client component, the build fails rather than bundling the secret
into JavaScript shipped to browsers.

---

## 9. Tooling as an enforcement mechanism

ESLint, Prettier and the pre-commit hook are not about taste. They are about
removing a class of review comment entirely.

`@typescript-eslint/no-explicit-any` is an **error**, not a warning. Warnings
accumulate and get ignored; an error blocks the commit. `any` disables type
checking at exactly the point someone found the types hard — usually where the
bug will be.

The hook runs `eslint --fix` and `prettier --write` on staged files. Verified
both directions: a file with `any` has its commit rejected; a badly formatted
file is rewritten and committed.

Turborepo caches task results keyed by input hashes. A second `pnpm build` with
no changes finishes in 17ms instead of 13s, because nothing changed so nothing
reruns. `globalDependencies` lists `tsconfig.base.json` and the lint config, so
editing those correctly invalidates everything.

---

## 10. Verifying, and why the fresh-clone test mattered

`scripts/verify-e01.sh` re-ran every acceptance criterion: it queried the real
database, started a dev server, exercised the API and shut it down. Its checks
now live in the test suite (`apps/web/e2e/api/infra.spec.ts`,
`apps/web/src/lib/infra.test.ts`, `packages/shared/src/rules.test.ts`) and run
in CI.

Three bugs it caught that passing tests alone would not have:

- `@types/react` installed at two versions (React Native pins 18, the web app
  needs 19). `tsc --noEmit` passed; `next build` failed. **Different tools
  resolve modules differently** — typechecking passing does not mean building
  passes.
- `apps/mobile` resolved ESLint 8 via a transitive dependency and could not
  read the flat config.
- `@react-native-community/cli` was missing, so `pnpm dev` failed for mobile
  and took the web app down with it.

Then cloning the repo to a temporary directory and running the checks there
found a fourth: the Prisma client is generated code, not in git, so a fresh
clone had no `@prisma/client` types at all. Everything passed locally only
because `prisma generate` had been run by hand weeks earlier. Fixed with a
`postinstall` script.

**That is the most valuable check available: does it work somewhere that is not
your machine?** Local state accumulates invisibly. A clean clone has none of it
— which is exactly the situation a new teammate, or CI, is in.

---

---

## 11. Two kinds of session: auth for a website and an app (E02)

The web dashboard and the mobile app sign in against the same accounts, but
they cannot hold a session the same way.

| Client  | Holds                                                          | Why                                                                                    |
| ------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Browser | An Auth.js session in an `httpOnly` cookie                     | JavaScript on the page cannot read it, so an XSS bug cannot steal it                   |
| App     | A 15-minute **access token** (JWT) + a 7-day **refresh token** | An app has no cookie jar it can trust; it keeps both tokens in the Keychain / Keystore |

`requireAuth` (`apps/web/src/lib/api/middleware.ts`) accepts either, so every
endpoint serves both clients. The bug where it only read the cookie (#177)
made every app call a 401. That is why it now has a test of its own.

### Short-lived access, rotated refresh

A JWT is **stateless**: the server checks the signature and the expiry and
never looks at the database. That makes it fast, and also impossible to
revoke. So it lives for 15 minutes only.

The refresh token is the opposite: a random string the server **does** store,
as a SHA-256 hash (`RefreshToken.tokenHash`), never in plain text. Exchanging
it (`rotateRefreshToken` in `lib/auth/service.ts`) **rotates** it: the old one
is marked used and a new one is issued. If a thief copies a refresh token, the
thief and the real user now hold the same string, and whoever uses it second
presents a token that has already been rotated. The server cannot tell which
one is the thief, so it **revokes every token for that user** (reuse
detection). Both have to sign in again, and the stolen token is worthless.

On the app side, `apiClient.ts` makes sure concurrent 401s share **one**
refresh. Without that, three parallel requests would each rotate the same
token, and the second and third would look exactly like theft.

### Ending a stateless session

A password reset must sign out every device. App sessions are easy: revoke
the refresh tokens. A browser cookie session cannot be deleted from the
server. Instead, the user row has `passwordChangedAt`, the session remembers
when it began (`authAt`), and every session check compares the two
(`apps/web/src/auth.ts`). One indexed lookup per request buys revocation.

### Codes and secrets are hashed like passwords

Verification codes and reset tokens are stored as hashes, with an attempt
counter. A code is burned after three wrong guesses, and email and phone
codes are kept apart by a `channel` column (#156). A database leak hands
over nothing usable.

**What to learn:** JWT structure (header, payload, signature) and why it
can't be revoked; access versus refresh tokens; OAuth 2.0 refresh-token
rotation; `httpOnly`, `Secure` and `SameSite` cookies; XSS versus CSRF.

---

## 12. Discover: derived data, URL state and the map (E03)

### Sorting by values the database does not have

A Discover card shows a rating, a "from" price, a distance and an open badge.
**None of these is a column.** The rating is the mean of each pitch's mean
review (§3: derive, don't store). The price is the cheapest active pitch.
Distance depends on where the player is standing, and "open" depends on the
clock.

So `lib/discover/companies.ts` asks Postgres for everything that _can_ be
filtered in SQL (city, status, name, pitch attributes), then computes, sorts
and pages in memory. That is four queries whatever the result size, fine for
hundreds of venues per city. The file says what to do past that: denormalise
rating and price onto `Company` and move distance into PostGIS.

**Cursor pagination.** The client sends the id of the last card it saw, not
a page number. If a venue is added while someone scrolls, offset paging
would show one card twice; a cursor just continues after the last one. A
stable tie-break (name, then id) makes "after this one" mean the same thing
on every request.

### Filters live in the URL (web)

`/discover?city=Cluj-Napoca&size=SIX_A_SIDE&availableNow=true` _is_ the
filter state (`lib/discover/url-state.ts`). Back and forward work, a search
can be shared, and a refresh loses nothing. The reader drops anything it
doesn't recognise rather than forwarding it to the API. On mobile, the
filter sheet edits a **draft** that is applied when it closes, so the list
fetches once instead of on every tap.

### Two small techniques worth knowing

- **Debouncing.** Search waits until typing stops (300 ms) before asking the
  API; a test checks that typing a word sends exactly one request.
- **Nearest city instead of reverse geocoding.** `nearestCity()` picks the
  closest of the ten supported cities by straight-line distance (haversine).
  It works offline, needs no API key, and always returns a city the app
  supports. A suburb like Florești becomes Cluj-Napoca, not a name that
  matches nothing.

The map clusters pins when zoomed out (supercluster on mobile) because a
hundred overlapping markers are unreadable and slow to render.

**What to learn:** offset versus cursor pagination; when to denormalise; URL
as state; debounce versus throttle; the haversine formula; marker
clustering; TanStack Query (caching, `staleTime`, `useQueries`).

---

## 13. Time: the venue's clock, not the server's (E04)

"Is it open?" and "which slots are free?" are questions about **Romanian wall
time**. The server might run in UTC, and the player's phone might be abroad.
`packages/shared/src/schedule.ts` answers them in `Europe/Bucharest`:

- `venueClock(now)`: today's date and minute **at the venue**.
- `venueTimeToUtc(date, minutes)`: the instant a Bucharest wall time
  happens. It is not "subtract two hours": twice a year, daylight saving
  time makes one local hour not exist (spring) and another happen twice
  (autumn). Unit tests pin both.
- `isOpenAt`: handles overnight hours (18:00–02:00 belongs to the day it
  started), round-the-clock venues and closed days.

The availability endpoint splits a day into 30-minute slots. Each slot is
`available`, `booked` or `past`, the last being earlier today. The tickets
had only two states, which would have shown 9 a.m. as bookable at noon.

**Rule: store instants in UTC; do calendar arithmetic in the place's own
time zone; convert at the edge.**

**What to learn:** UTC versus local time; IANA time zones; DST edge cases;
`Intl.DateTimeFormat`; why a "date" and an "instant" are different types.

---

## 14. Changing the product after it is built (C-1 to C-5)

After testing E01–E04, the product owner changed five rules: shirts are
free, one hourly rate, size is a recommendation (with 6v6), no "Open now"
filter, and the map opens on the chosen city. Each one shows how a design
reacts to change.

### A schema change is a data migration too

Replacing `offPeakRate` + `peakRate` + `peakHoursDefinition` with one
`hourlyRate` is three lines in `schema.prisma`. Applying it to a database
**that already has pitches** is the real work. A new required column has no
value for existing rows, so `prisma db push` refuses. The order that keeps
the data:

1. Add `hourlyRate` as nullable.
2. Copy: `UPDATE "Pitch" SET "hourlyRate" = "offPeakRate"`.
3. Make it `NOT NULL`, then drop the old columns.

This project uses `prisma db push`, which compares the schema to the database
and applies the difference. That is fine while the only data is seed data.
Before real customers exist, switch to **`prisma migrate`**: each change
becomes a versioned SQL file, reviewed and run the same way on every
machine, with a data step like (2) written into it.

### Why the shared package paid off

The rules changed in one place, `packages/shared`:

- `SIZE_LABELS` and `SIZE_INFO`;
- `shirtSetsFor(teams, wants)` (two teams, one set);
- `mapCenter()`;
- the filter type without `openNow`.

The TypeScript compiler then listed **every** file in web, mobile, the seed
and the tests that still used an old field. Removing a field from a shared
type turns "find every place that uses it" into a compile error.

### Rules as named functions

"Shirt sets = teams − 1" could have been written inline in the booking
screen. As `shirtSetsFor()` it has a name, a unit test, and one place to
change if the rule changes again. The same goes for `mapCenter()`: "centre
on the player only if they are in the selected city" is a decision, so it is
a function with tests rather than an `if` buried in two map components.

### Removing a feature is a decision too

"Open now" and "Available now" differ in exactly one case: open, with every
pitch booked. For a booking app that case is useless, so the filter was
removed rather than explained. The "Open" badge stays, because it answers a
different question (can I call or drop by?). Fewer, clearer controls beat
complete ones.

**What to learn:** schema migrations versus `db push`; expand-and-contract
migrations (add, backfill, switch, remove); feature flags; how a typed
shared contract turns a breaking change into compile errors.

---

## 15. Testing: a pyramid, not a pile (E16)

| Layer                  | Tool                   | Speed   | Catches                                            |
| ---------------------- | ---------------------- | ------- | -------------------------------------------------- |
| Unit                   | Vitest, Jest           | seconds | rule mistakes: DST, ratings, schemas, `mapCenter`  |
| API                    | Playwright `request`   | ~1 min  | contract and security: enumeration, rotation, 410s |
| Browser E2E            | Playwright Chromium    | ~2 min  | wiring: forms, redirects, URL state, layout        |
| Accessibility          | axe-core in Playwright | in E2E  | missing labels, contrast                           |
| Device (not yet, #187) | Maestro / Detox        | slow    | native modules, gestures, real maps                |

Most tests sit at the bottom because they are fast and precise. Fewer sit at
the top because they are slow and, when they fail, they say less about why.

Three practices worth copying:

- **A test database that cannot be the dev one.** `assertTestDatabase`
  refuses any database whose name lacks "test" before it wipes anything.
- **Test hooks that do not exist in production.** The rate-limit reset route
  answers only with `ALLOW_TEST_HOOKS=1`, which the E2E server sets.
- **Screenshots as evidence.** `EVIDENCE=1` writes the screenshots linked
  from the tickets, so "it works" comes with a picture.

The accessibility scan found real problems on its first run. The brand
green, the grey hint text and the orange button all failed WCAG contrast,
and the Discover sort dropdown had no label. A missing label is invisible to
anyone who can see the screen; tools find what eyes skip.

**What to learn:** the test pyramid; test doubles (mocks, stubs, fakes); test
isolation; flaky tests and why `waitFor` beats `sleep`; WCAG 2.1 AA, colour
contrast and accessible names.

---

## 16. Taking money: bookings and payments (E05)

A booking is the first place where two people can want the same thing at the
same moment, and where a mistake costs real money. Five ideas carry it.

### A state machine, not a flag

```
create ──► PENDING ──payment succeeded──► CONFIRMED
              │
              ├─payment failed / replaced / service down──► CANCELLED
              └─(15 min, unpaid)── stops holding the slot
```

A booking is created **before** the money moves, as PENDING, so the slot is
held while the player types their card. Every later event moves it along one
of these arrows and nothing else. "What can happen next?" has a short answer
in every state, which is what makes payments debuggable.

**The hold expires.** A player who closes the tab mid-checkout must not
block 18:00 for everyone forever. `liveBookingWhere()` counts a PENDING
booking only for its first 15 minutes, and availability, Discover's
"Available now" and booking creation all use that one definition (§1: one
source of truth). There is no cron job deleting stale rows: an expired hold
is simply no longer counted.

### Race conditions, and why the obvious lock fails

Two players press Pay for the same slot at the same millisecond. Both
requests check "is 18:00 free?", both see yes, both insert. Double booking.

The ticket suggested `SELECT … FOR UPDATE` on overlapping bookings. That
locks rows that already exist, but the competing booking does not exist yet.
There is nothing to lock, and both requests still slip through. This is the
classic **phantom** problem.

The fix (`lib/bookings/create.ts`) is a lock on the _idea_ of the pitch
rather than on a row:

```ts
await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pitch.id}))`
```

Inside the transaction, every booking of that pitch now queues behind this
line. The second request runs only after the first has committed, so it sees
the first booking and gets a 409. Bookings of different pitches never wait
for each other. The API test fires two players' requests together and checks
that exactly one wins. (A Postgres **exclusion constraint** on a time range
is the other well-known answer; it is stronger, but Prisma cannot express it.)

### Idempotency: doing it twice must equal doing it once

Networks retry. Stripe delivers webhooks _at least once_, and sometimes the
player's app and the webhook report the same payment at the same time. So:

- The PaymentIntent is created with `idempotencyKey: booking-<id>`: a
  retried request for the same booking can never charge twice.
- Each webhook event id is stored (`StripeWebhookEvent`), and a repeat is
  acknowledged without being handled again.
- `confirmPaid()` re-reads the booking under the same lock and does nothing
  if it is already CONFIRMED. Even if both of the guards above failed, the
  outcome would not change.

**Design every handler so that running it twice is harmless.** Then retries,
which you cannot prevent, stop being dangerous.

### Webhooks: trust the signature, not the sender

`POST /payments/webhook` has no session: Stripe is calling, not a user.
Anyone on the internet could POST "payment succeeded" to it. So Stripe signs
each body with a secret only it and the server know, and
`constructWebhookEvent` verifies that signature over the **raw** body. Parsed
and re-serialised JSON would not match byte for byte. A handler error
answers 500 so Stripe retries; that is safe _because_ the handlers are
idempotent.

### Card numbers never touch our server

The card is typed into Stripe's own field (`CardElement` on the web,
`CardField` in the app). It goes straight to Stripe, which returns an id.
Our server only ever sees amounts and ids, and that keeps the app out of
most of PCI-DSS (the card-industry security rules). It is also why the
browser or phone **confirms** the payment (`confirmCardPayment`) rather than
the server: the server prepares the PaymentIntent and hands back a
`clientSecret` that only the client uses.

### Money in minor units, and a provider behind an interface

Stripe counts in bani (240 RON is 24000), and every conversion goes through
one function, `toBani`. Booking code talks to a `PaymentProvider` interface
(create, state, cancel, refund) with two implementations:

- **Stripe**, used when its three keys are set;
- **test payments**, used otherwise in development and E2E.

Test mode runs the very same booking and confirmation code, which is why the
whole flow is tested in CI without a Stripe account. Email and SMS (E02)
follow the same pattern, so a missing integration never blocks development.

**What to learn:** state machines; database transactions and isolation
levels; race conditions, phantoms and advisory locks; exclusion constraints;
idempotency keys and at-least-once delivery; webhook signatures (HMAC); PCI
scope and why tokenised card fields exist; Stripe PaymentIntents and
SetupIntents; storing money as integers in minor units.

---

## 17. After the booking: lifecycle, history and undo (E06)

E05 got a booking paid. E06 is everything after that: seeing it, cancelling
it, reviewing it, disputing it. Five problems came up.

### Who moves a booking from CONFIRMED to COMPLETED?

A game ends at 20:00; at 20:00 nobody calls the server. Two ways out:

| Approach                        | Cost                                                  |
| ------------------------------- | ----------------------------------------------------- |
| A scheduled job (cron)          | Needs a scheduler, a worker, monitoring when it stops |
| Settle lazily, on the next read | Correct only for data someone reads                   |

There is no scheduler yet (E11), so `settlePlayerBookings` runs at the start
of every My Bookings read: one `UPDATE` marks the player's finished
CONFIRMED bookings COMPLETED, another cancels unpaid ones whose 15-minute
hold ran out. The player always sees the right state, because the player is
the one reading. A manager's dashboard or a payout report would not trigger
it, which is why E11 still needs the job. This is the same idea as §12's
"derive rather than store", applied to state: when you can't keep a value
up to date, make sure it is correct when it's read.

### A history you can't rebuild, so record it

The detail page shows a timeline: booked, paid, cancelled. The booking row
only knows its current status and a few timestamps. So every status change
also inserts a `BookingStatusEvent` row, through one helper (`recordStatus`)
called inside the same transaction as the change, so the two never disagree.
This is an **append-only audit log**: rows are never updated, only added.
Bookings created before E06 have no events, so the timeline falls back to
what the timestamps can tell. Logs like this are also how disputes get
settled: "the venue marked it at 21:05" is a fact, not a memory.

### Undo with money attached

Cancelling has three parts that must all happen or none: check the booking
can still be cancelled, refund the card, mark it cancelled. The cancel runs
in one transaction holding the same per-pitch lock as booking (§16), and
calls the provider's refund **before** writing anything. If the refund fails,
the transaction rolls back and the player sees "try again" with nothing
changed. The opposite order would leave a cancelled booking with no money
returned. The refund amount comes from one shared function,
`cancellationRefund`, so the cancel sheet's preview and the server's actual
refund can't drift. Stripe's refund call is idempotent, so a retry after a
timeout doesn't refund twice.

### Deleting without losing

A deleted review is not removed. It gets a `deletedAt`, and its text and
photos are cleared. This is a **soft delete**: public queries filter
`deletedAt: null`, while the row still stops the same booking being reviewed
again, which would otherwise be a way to reset a bad rating. The cost is
that every query must remember the filter. Forget it once and deleted
reviews come back, so the three public review queries were changed together.

### Paging that doesn't skip

The lists use **cursor pagination** (`?cursor=<last id>`) rather than
`?page=3`. If a booking is cancelled while you scroll, offset paging shifts
every row by one and you see a duplicate or miss one; a cursor says "after
this row" and stays correct. The server fetches `limit + 1` rows to know if
there is a next page without a second `COUNT` query.

**What to learn:** scheduled jobs vs lazy evaluation (and when each breaks);
audit logs and event sourcing; ordering side effects around a transaction
(and the outbox pattern for when you can't); soft deletes and their query
discipline; cursor (keyset) vs offset pagination; authorization by ownership
(why a 404 rather than a 403 hides other users' data).

---

## 18. Reviews: who may see and change what (E07)

Reviews look simple: a number and some text. Most of E07 is about
permissions, and about one choice of what to store.

### Store the average, or compute it?

The ticket wanted `avgRating` and `reviewCount` columns on the pitch,
updated after every review change. That is **denormalisation**: copying a
value you could compute, so reading is cheap. The price is that every write
path must remember to update the copy (create, edit, delete, moderation,
an admin's hard delete), and one forgotten path leaves a wrong number on the
page until someone notices.

PitchUp keeps computing it: one `groupBy` over an index on `pitchId`, in the
same query that fetches the reviews. At thousands of reviews per pitch that
is still milliseconds. The day it is not, the fix is a cached copy, and the
code that computes it today becomes the code that refreshes the copy.
"Derive rather than store" (§12) is a default, not a law: measure before
paying for a copy.

### One reply per review, enforced by the shape of the data

A reply could be its own table with a unique index on `reviewId`. Here it
is two columns on the review: `managerReply` and `managerRepliedAt`. With
only one place to put a reply, there can't be two. Two managers clicking at
once are handled by a **conditional update**:

```ts
prisma.review.updateMany({ where: { id, managerReply: null }, data: { … } })
```

The database applies the condition and the write together. If the count
comes back 0, someone else replied first and the API answers 409. This is
**optimistic concurrency**: no lock is taken, and the loser is told.

### Authorisation is more than a role

`requireRole('MANAGER')` says _what kind of user_ you are; it doesn't say
_which reviews are yours_. Every reply and list call also checks that the
review's pitch belongs to the signed-in manager's company. Without that
check, any manager could reply on a rival's page. Getting this wrong is
called **broken object-level authorisation** (BOLA). It's the most common
API security bug, because the role check feels like enough. A manager who
asks about another company's review gets **404, not 403**: telling them it
exists but isn't theirs would itself leak information.

The same thinking shapes what the manager sees. An anonymous review stays
"Anonymous player" in the manager's list, and the name search skips
anonymous reviews. Otherwise searching a name would reveal who wrote the
anonymous one.

### Reports: flag, don't act

A report doesn't hide the review. If it did, one competitor with a few
accounts could remove every good review a venue has. Instead the report is
stored (once per person, enforced by a unique index on
`[reviewId, reporterId]`), the review is flagged, and admins are notified.
A person decides (E15). Automating the decision is tempting; it's also an
attack surface.

### The server's clock decides

"Can I still edit this?" is computed on the server and sent as
`isEditable`. A phone with the wrong date would otherwise show an Edit
button that fails, or hide one that would work. The server enforces the
window anyway; sending the answer just keeps the screen honest. The same
goes for `reply.isEditable` on the manager page.

### URL state on the server

The manager page reads its filters (`?pitch=&sort=&q=&page=`) on the
server and renders the list there. The filter bar only changes the URL. So
Back works, a filtered view can be bookmarked, and the page needs no
client-side data fetching. Typing in the search box waits 300 ms after the
last key (**debouncing**) so each letter doesn't trigger a request.

### Telling search engines about ratings

The pitch page includes a small JSON-LD block (schema.org
`AggregateRating`). Google reads it to show stars in search results. It's
only emitted once the rating is public (3+ reviews), and `<` is escaped so
review-derived text can never close the `<script>` tag. That's the same
class of bug as XSS.

**What to learn:** denormalisation and cache invalidation; optimistic
concurrency and conditional updates; object-level authorisation (OWASP API
Top 10 #1, BOLA/IDOR); privacy by default (anonymity has to survive every
view, including search); moderation design (flag, then a human decides);
server vs client clocks; URL-driven server rendering and debouncing;
structured data (schema.org, JSON-LD) and escaping data inside HTML.

---

## 19. The account: identity, sessions and leaving (E08)

E08 is the player's own account: what they can see and change, how to change
a password safely, how to leave, and how a phone gets notified.

### Ask for the password again before anything dangerous

Changing the password and deleting the account both ask for the current
password, even though the player is signed in. A session can be stolen (a
shared laptop, a leaked token); **re-authentication** limits what a stolen
session can do. Those two endpoints also share a limit of five attempts per
15 minutes per user, so a stolen session cannot be used to guess the
password either.

A wrong password answers **400, not 401**. The status code is part of the
contract with the client: the app treats 401 as "your session is gone" and
signs out. Using it for "you typed the wrong password" would sign people out
for a typo. Pick status codes by what the _client_ should do next.

### Ending sessions you cannot reach

After a password change every session must end, including ones on other
devices. The app's sessions are refresh tokens in the database, so they are
revoked: easy. The web's are **stateless JWT cookies**: the server keeps no
list of them, so there is nothing to delete. Instead each user has
`passwordChangedAt`, and every request compares it with when the session was
issued; older sessions are rejected. This is the general trade-off of
stateless tokens: cheap to check, but revoking one needs a little state
anyway (a timestamp, a version number, or a deny-list).

### Leaving: erase, or anonymise?

Deleting everything sounds most respectful, but other people's records
depend on this account: a venue's bookings and payouts, the reviews that
make up a pitch's rating, a dispute in progress. PitchUp **anonymises**:
everything that identifies the person (name, email, phone, photo, birth
date, Stripe customer, sessions, device tokens, notifications) is removed
or overwritten, while bookings and reviews remain, attributed to "Former
player". The row itself stays, with `deletedAt`, so foreign keys keep
working and the email and phone (unique columns) are freed by replacing
them with values that cannot collide.

Order matters again (§17): upcoming bookings are cancelled and refunded
**first**. If a refund fails, nothing has been anonymised yet and the player
can try again. Doing it the other way round could leave an anonymous account
owed money with nobody to pay it to.

In privacy law terms (GDPR's "right to erasure"), anonymised data is no
longer personal data, while keeping what is needed for accounts and
disputes is allowed. That is the reasoning to check with a lawyer before
launch, not a legal opinion.

### Partial updates and fields that must not change

`PUT /profile` accepts any subset of name, phone, city and photo. The schema
simply has no `email` or `role`, and Zod drops unknown keys, so a request that
sends `role: 'ADMIN'` changes nothing. This is the fix for **mass
assignment**: never pass a request body straight to the database, list the
fields that may change. Changing the phone also resets `phoneVerified`: data
the system had checked is no longer checked once it changes.

### Push notifications: the parts you can build first

A push reaches a phone through Apple's or Google's service (FCM), which
needs a token per installed app. The server stores those tokens
(`DeviceToken`, one row per token; a token that signs in as someone else
moves to them) and later sends to them (E13). On the phone, a tapped
notification must open the right screen whether the app was in the
foreground, the background, or closed. All three paths call one function,
`openNotification`, which uses the same rule (`notificationTarget` in
`@pitchup/shared`) as tapping an item in the in-app list. Only the Firebase
SDK and its config files are missing, and they are not needed to build or
test the rest.

### Native modules have a cost

The tickets asked for an SVG ring, swipe gestures and a photo picker, each a
native module. Every native module means rebuilding the app for both
platforms, more to break on upgrades (§ "React Native version
constraints" in HANDOVER), and something tests can only mock. Since nobody
could run the app here, E08 used plain React Native for all three. The
choice is easy to revisit; the point is that it is a choice.

**What to learn:** re-authentication for sensitive actions; HTTP status
codes as a client contract (400 vs 401 vs 403 vs 409); stateless vs stateful
sessions and how to revoke JWTs; anonymisation vs deletion, and GDPR's right
to erasure; mass assignment and allow-listing fields; push notification
architecture (APNs, FCM, device tokens, deep links); the cost of native
dependencies in React Native.

---

## 20. Letting businesses in: onboarding and approval (E09)

E09 lets a venue manager create their company in four steps, has an admin
approve it, and gives approved managers a dashboard.

### A state machine, written down

A company is `DRAFT` while the manager fills it in, `PENDING` once submitted,
`ACTIVE` once an admin approves it, and `SUSPENDED` if it is taken down. An
admin who sends it back moves it to `DRAFT` again, with a
`rejectionReason`. Every rule hangs off that one field: Discover shows only
`ACTIVE` venues, the dashboard needs `ACTIVE`, onboarding pages may be edited
only in `DRAFT` or `PENDING`, and an approve or reject on anything but
`PENDING` is refused (409 `NOT_PENDING`). Writing the states and allowed
moves down first, and checking the current state before every move, is what
stops two admins approving the same venue or a manager editing a live venue
through an old onboarding page.

### Wizards: save each step, derive where the user is

Each step saves on "Next", so closing the browser loses nothing. The server
does not store "current step"; it **derives** it from what is filled in
(`onboardingStatus`): name present means step 1 is done, an address means
step 2, and so on. Derived state cannot get out of sync with the data. The
same function guards the pages, so a manager who types `/onboarding/step/3`
before finishing step 1 is sent back to step 1.

### Where to put an access check

Next's edge middleware runs before every request but cannot reach the
database, so it only checks for a session cookie. The real checks ("is this
a manager, and is their venue approved?") are in the layouts and API routes,
which can read the database. The middleware is a fast first filter; the
server code is the gate. The admin page checks the role again in the page
itself, because layouts and pages render in parallel and a layout's redirect
does not stop the page's data from loading.

### Payments to someone else: Stripe Connect

The venue, not PitchUp, receives the money. Stripe Connect gives each venue
its own **connected account**; Stripe hosts the identity and bank checks
(KYC), and PitchUp only stores the account id. The manager is sent to a
Stripe page through a one-time **account link**, returns to
`/api/v1/onboarding/stripe-connect/return`, and the server asks Stripe
whether the details were submitted before moving the venue to `PENDING`.
The return URL is never trusted on its own: anyone can open it. Without
Stripe keys (local and E2E runs) a test account is used, as with test
payments in §16.

### Geocoding: the browser finds, the person confirms

An address becomes coordinates by **geocoding**. The pin map geocodes in the
browser while the manager types (debounced, so one request per pause, not
per key) and lets them drag the pin, because geocoders are often a few
hundred metres off and only the manager knows where the gate is. The server
geocodes only as a fallback, and only if it has its own key; coordinates
stay optional, so a missing key never blocks onboarding.

### Numbers for one day, in the venue's timezone

The overview's numbers (revenue, bookings, occupancy, no-shows) are
computed with a few aggregate queries over a time range in the venue's
timezone, not by loading every booking. "Today" is a range in Bucharest
time turned into UTC (§17's venue clock), and every number is compared with
the same weekday last week, which is a fairer comparison than yesterday.

**What to learn:** finite state machines for business entities; derived vs
stored state; defence in depth (edge filter, server gate); marketplace
payments (Stripe Connect, connected accounts, KYC, account links);
geocoding and its accuracy; debouncing; aggregate queries and timezone-aware
date ranges.

---

## 21. Listening to users: three changes after testing (C-6, C-7, C-8)

The owner tested the booking flow and asked for three changes. Each one
teaches something different about changing a product that already works.

### An empty space reads as a bug (C-7)

A pitch with no shirts simply hid the shirts section. The code was correct,
but the owner reported it as a bug: a gap looks like something failed to
load. The fix is one sentence ("This pitch doesn't lend shirts...") where
the switch would be. **Say why something is missing**; an explicit "no" is
part of the interface.

### Make the impossible unclickable (C-6)

The old time grid asked for two clicks (start, then end) and the user had
to work out what a second click would do. The new step asks two questions a
person already has in mind: when do we start, and for how long? Every
choice that cannot work is shown but disabled, with the reason read out to
screen readers ("19:30, not enough time"). This is the general idea of
**constraining input instead of validating it**: rather than letting the
player pick 19:30–21:30 and then saying "that overlaps a booking", the
option is not offered.

The rules (which starts fit, which lengths fit, what to keep when the start
changes) are one set of pure functions in `@pitchup/shared`, used by web
and mobile alike and unit-tested for the awkward cases: overnight venues, a
booking in the middle, closing time, past slots. Pure functions are where
such rules are cheapest to test.

### Money in two places (C-8)

Paying at the venue means part of the money moves outside the system. The
design question is: what does PitchUp still know and control?

- **A deposit is a commitment device.** Taking a little money up front makes
  a no-show cost something, without asking for the full price. The venue
  picks how much (0–50%); at 0% it accepts the risk, and the trust score
  (only 70+ may pay at the venue) is the only protection left.
- **Record the split at booking time.** The booking stores how it is paid,
  the deposit and what is due at the venue. Changing the venue's settings
  later must not change what an existing booking owes, the same reason the
  hourly rate is copied onto the booking (`pitchRateSnapshot`).
- **The server decides; the client explains.** The app shows the choices
  the server allows (`GET /pitches/:id/payment-options`), and creating the
  booking checks the same rule again (`paymentMethodsFor`). A modified
  client cannot pay at the venue with a low trust score.
- **Refund what was charged, not what it cost.** Every refund (cancelling,
  a slot lost while paying, a confirmed attendance) is taken from the amount
  actually charged by card (`chargedOnline`). Mixing "price" and "amount
  paid" is a classic money bug.
- **A human closes the loop.** Only the manager knows whether the player
  came. Confirm attended and Report no-show are that signal. Both run under
  the same per-pitch lock as booking, so a double click can't refund twice,
  and one excludes the other.

**What to learn:** empty states and explaining absence; constraining input
versus validating it; pure functions for business rules shared across
platforms; deposits and no-show economics; snapshotting values onto a
transaction; server-side enforcement of rules shown on the client;
idempotency and locks around refunds.

---

## 22. Managing what you sell: pitches (E10)

E10 gives managers the editor for their pitches: details, photos,
amenities, price, shirts, hours and blocked days.

### Ownership through the parent

A pitch has no owner field; its company does. Every pitch endpoint finds
the pitch _within the manager's company_ (`ownedPitch(companyId, id)`), so
another venue's pitch is simply not found. Checking ownership through the
parent record keeps one source of truth: if a company changed hands, every
pitch would follow without touching them. Answering 404 rather than 403
also avoids telling a stranger that the id exists.

### Soft delete

Deleting a pitch sets `deletedAt` instead of removing the row. Bookings
and reviews point at it; a hard delete would either fail (foreign keys) or
take a venue's history with it. The cost of a soft delete is that every
read has to remember `deletedAt: null`. That is why the player-facing reads
share a few functions (pitch detail, availability, company page) rather
than each writing its own query. Deleting is also refused while bookings
are still to be played: there must be nobody left holding a booking for a
pitch that no longer exists.

### Ordered lists: positions, gaps and races

Photos have an `order`. Three things make that harder than it looks:

- **Reordering sends the whole list** of ids in the new order, applied in
  one transaction, so a failure leaves the old order intact. If the list
  the client sends doesn't match what is stored (a photo was deleted in
  another tab), the server refuses with `OUT_OF_SYNC` rather than guessing.
- **Deleting closes the gap**, so orders stay 0…n-1 and "the first photo is
  the cover" stays true.
- **Ten uploads finishing at once** would all count nine photos and all
  take order 9. A short lock per pitch (`pg_advisory_xact_lock`) makes them
  queue, the same technique as booking a slot (§16). The test fires ten
  uploads in parallel to prove it.

### Rules that depend on other rules

A pitch's hours must sit inside its venue's. The rule is checked when the
manager saves (with a clear message per day), but the venue's hours can
change later. So availability does not trust the saved pitch hours alone:
it **intersects** them with the venue's (`intersectIntervals`). Validating
on write and still enforcing on read is cheap insurance when one record's
validity depends on another that can change.

### Forms that know they are dirty

Each tab compares its current values with what was loaded or last saved
(`useEditorForm`). That one comparison drives the "Unsaved changes" text,
the dot on the tab and whether Save is enabled. Deriving it, rather than
setting a flag on every change, means undoing an edit by hand clears it
too.

**What to learn:** authorisation through parent records; 403 vs 404 for
resources you don't own; soft delete and its read-side cost; ordering with
position columns, atomic reorders and optimistic concurrency checks;
serialising concurrent writers with advisory locks; validating on write
and enforcing on read; derived "dirty" state in forms; native drag and
drop with a keyboard alternative.

---

## 23. The venue's day: lists, a calendar and a nightly job (E11)

E11 gives managers their bookings three ways (a filtered list, a week
calendar, one booking in full) and settles finished games every night.

### Filters belong in the URL

The list's filters (pitch, status, dates, player) are query parameters, not
component state. Changing one navigates; the server renders the first page
for those parameters. That makes a filtered view something you can reload,
bookmark or send to a colleague, and the back button undoes a filter. The
search box waits for a pause in typing (debouncing) and for two letters, so
typing a name doesn't fire a request per key.

### Cursor pages

"Load more" asks for the rows after the last one shown (`cursor` = its id),
not "page 3". With rows ordered by start time and id, a booking created
while the manager scrolls can't shift a page and make a row appear twice or
not at all, which offset paging (`skip 40`) allows. The CSV export follows
the same cursors to fetch everything that matches the filters, not just the
page on screen.

### Dates are the venue's days

"Bookings on 4 November" means 4 November in Bucharest. The API turns each
venue day into a UTC range (`venueTimeToUtc`) before querying, as the
availability code does (§17). Writing `T00:00:00Z` would cut the day two or
three hours off.

### Lazy and scheduled work

Players' pages settle bookings when they read them (§17): cheap and always
right for what that player sees. But nothing would ever settle a booking
nobody looks at, so a nightly job (Vercel Cron, 02:00 UTC) runs the same
settling for everyone. It is an ordinary HTTP endpoint guarded by a shared
secret, compared in constant time (`timingSafeEqual`) so the response time
leaks nothing about the token. The manager's pages deliberately don't
settle on read: a game that has just ended is still the manager's to
confirm, report or complete.

### Drawing a calendar

Each booking becomes a block positioned by arithmetic: top = minutes since
the first hour ÷ 30 × 48 px, height = duration ÷ 30 × 48 px. Bookings that
overlap in a day (two pitches at once) are given lanes, the same greedy
interval-colouring a meeting calendar uses, and share the column's width.
Colours carry meaning (which pitch), so each must still meet contrast with
white text, and a status is shown by more than colour alone (a cross for a
no-show, grey for played, stripes for unpaid).

### A bug worth remembering

The tables overflowed the page on a phone even though they sit inside a
horizontal scroller. The cause was the screen-reader-only labels in their
headers: `sr-only` is `position: absolute`, and an absolutely positioned
element is placed against its nearest _positioned_ ancestor. The scroller
wasn't one, so the labels escaped it and widened the whole page. Making the
scroller `relative` fixed it.

**What to learn:** state in the URL; debouncing; cursor vs offset
pagination; timezone-correct date ranges; lazy vs scheduled work and cron
endpoints; constant-time secret comparison; laying out calendar events and
interval colouring; colour plus a second cue for accessibility; CSS
containing blocks for absolutely positioned elements.

---

## 24. A score people can trust: the trust engine (E12)

E12 turns the trust score from a number set in a few places into an engine
with one entry point, a ledger, and rules that use it.

### One door for every change

Every change to a player's score goes through `applyTrustEvent`. Before,
the no-show report updated the score itself; with completions, reviews,
late cancellations, disputes and a monthly bonus coming, six places doing
their own arithmetic would drift apart. One function means one place for
the clamp (0–100), the history row and the monthly cap.

### A ledger, and a score you can rebuild

Each change writes a `TrustScoreEvent` (who, why, how much, which booking)
in the same transaction as the score. The score is then a **cached
summary of the ledger**, the way a bank balance summarises transactions.
The monthly job replays every player's events (`replayTrustScore`) and
corrects any score that disagrees, whether from a manual database edit or
a bug. Two details make the replay exact: the clamp is applied at every
step, as the live score does (a +2 at 100 is lost), and when the monthly
cap stops a completion point, no event is written at all.

### Lost updates, and why one SQL statement fixes them

Two events at once (a review and a completed game, say) would each read
85, add their delta, and write back: one change lost. The engine updates
the score with `trustScore = LEAST(100, GREATEST(0, trustScore + delta))`
in a single statement, so the database applies both, one after the other.
A short per-player lock also makes the monthly cap check-then-write safe.
This "read-modify-write race" is one of the most common concurrency bugs.

### Rules as data, decided in one place

What a tier allows (card on file, upfront payment, one active booking,
no booking) is a table in `@pitchup/shared`, and `bookingTrustGate` turns
it plus the pitch's minimum into one decision with a reason. The API
enforces it; the pitch page and the booking flow call the same function to
explain the refusal before the player gets as far as paying. Showing a
rule and enforcing it from the same code means they can't disagree.

### Fairness

Managers never see a player's score (PRD §9.1); they see what the player
did at their venue. A disputed no-show can be reversed (+10), and losing a
dispute costs nothing extra, so players aren't discouraged from
challenging a genuine mistake. Incentives are part of the design.

**What to learn:** single entry points for state changes; ledgers and
derived balances (event sourcing, lightly); lost updates and atomic
updates; advisory locks; rules as data shared by client and server;
incentive design in reputation systems.

---

## 25. Telling people things: notifications (E13)

E13 sends every notice through one function and up to four channels: the
in-app inbox, email, text messages and push.

### Write first, send later (the outbox)

Sending an email inside a database transaction has two failure modes: the
email goes out and the transaction rolls back (a confirmation for a booking
that doesn't exist), or the provider is slow and holds the transaction open.
So `notify()` only **writes a row** in the caller's transaction. Sending
happens after the response (`after()` in Next.js), and an hourly job picks up
anything that was missed. This is the **transactional outbox** pattern: the
database row is the promise, delivery is a separate step that can be retried.

### At most once, by claiming

Two deliverers (the after-response hook and the hourly job) could see the
same row. Each one first sets `deliveredAt` with `WHERE deliveredAt IS NULL`
and only sends if it won. The same trick claims a booking's reminder
(`reminderSentAt`). Updating "only if still unclaimed" is how to make work
happen once without a queue or a lock.

### Preferences decide what exists

A muted kind of notice isn't hidden, it is never written. Channels (push,
email, SMS) are checked at delivery time instead, so switching email back on
doesn't resend old notices. Groups ("Booking reminders") map to several types,
and the UI and API share the list in `@pitchup/shared`.

### A provider without its SDK

Push uses Firebase Cloud Messaging's HTTP API directly: build a JWT, sign it
with the service account's RSA key (`node:crypto`), swap it for an access
token, cache that for an hour. About 100 lines instead of a large SDK, and the
unit test signs with a throwaway key and checks the signature for real. When
FCM says a token is unregistered, it is deleted, so dead phones stop costing
requests.

### Polling is a fine first version

The bell asks for the unread count every 30 seconds. WebSockets or
server-sent events would be instant, but need a long-lived connection that
serverless hosting handles badly. A count is one indexed query; polling it is
cheap and good enough until it isn't.

**What to learn:** the transactional outbox; at-least-once versus at-most-once
delivery and idempotency; compare-and-set claims; OAuth 2 service accounts and
JWT signing; polling versus push for live updates; notification fatigue and
why muting by group beats a switch per type.

---

## 26. Rules that belong to the venue (C-9 … C-13)

After E13 testing the owner moved several platform rules into each venue's
hands. Three ideas carry most of it.

### Snapshot what the customer agreed to

A venue can change its refund policy at any time, but a player booked under
the old one. So each booking stores a copy of the policy (`refundPolicy`)
when it is made, and cancellation reads that copy. It is the same reason an
order stores the price paid rather than looking up today's price: terms are
fixed at the moment of agreement. Bookings made before the change have no
copy and fall back to the default.

### A state that holds without committing

Approving by hand adds `AWAITING_APPROVAL` between paid and confirmed. It
has to behave like a confirmed booking in some ways (it holds the slot, so
`liveBookingWhere` includes it) and not in others (no reminder, no
attendance, no trust penalty if withdrawn). Adding a state to a state
machine means visiting every place that asks "which states count?"; the
type checker found the label maps, and a search for each status found the
queries. A deadline (24 hours, or 2 hours before kick-off) keeps a request
from holding a slot forever, and the hourly job enforces it.

### Propose, don't edit

A venue's public details must be checked again after approval, but the
venue must not disappear while they are. So an edit is stored beside the
live record as a proposal (`pendingChanges`), the page keeps showing the
approved details, and the admin sees a field-by-field comparison. Approving
copies the proposal over; turning it down deletes it with a reason. This is
the pattern behind pull requests, Wikipedia's pending changes and most
content moderation: the live version and the draft are separate rows (or
fields), and promotion is one explicit step.

**What to learn:** snapshotting terms at the moment of agreement; adding
states to a state machine safely; deadlines and sweepers for pending work;
draft/live separation and review workflows.

---

## 27. Numbers a manager can trust: analytics (E14)

### Decide what a number means before computing it

"Revenue" sounds obvious until a booking is paid at the venue, cancelled
late with 25% kept, or ends in a no-show. The owner decided: what the venue
earned, online or not, less refunds. That rule lives in one pure function
(`bookingEarned`) used by the chart, the cards, the table and the CSV, so
they always agree. Most analytics bugs are definitional, not arithmetic.

### Time zones decide which day a sale belongs to

Grouping by `DATE_TRUNC` in UTC puts a 22:00 game in Bucharest on the next
day for half the year. The dashboard works in the venue's local days and
hours instead. When the database can't easily do that, doing it in code over
a modest set of rows is fine; it only needs moving into SQL once a venue has
far more bookings than a dashboard reads.

### A rate needs the right denominator

Occupancy is booked time over _open_ time, from each pitch's real hours and
closures. Counting bookings over an assumed number of slots would show a
pitch closed on Sundays as "0% busy" on Sundays. And a cell that was never
open is `null`, not 0: "closed" and "empty" are different answers.

### Compare like with like

Each card compares with the same length of time just before. With nothing
before, the change is unknown (`null`), not +100% or infinity.

### A chart is also a table

The SVG chart has a "Show as a table" view and a text label, and the heatmap
cells carry their figure for screen readers. A chart without its numbers is
inaccessible and, often, less useful.

**What to learn:** metric definitions; time zones in reporting; denominators
and survivorship in rates; period-over-period comparison; CSV injection;
accessible data visualisation.

---

## 28. Running the platform: the admin panel (E15)

### Every lever leaves a trail

An admin changing a trust score is the platform overruling its own rules,
so it goes through the same engine as everything else (clamped, in the
ledger, replayable) with a written reason, and the player is told. The same
for suspending a venue or deleting a review: the person affected reads why.
Admin power that leaves no record is how trust in a marketplace erodes.

### Suspend, don't delete

Deleting a venue would orphan its bookings, payouts and reviews. Suspending
is reversible and keeps history intact: the venue drops off Discover, new
bookings stop, existing ones stand. Accounts work the same way, and the
check sits where the session is read (cookie and Bearer token), so a
suspension takes effect on the next request, not at the next sign-in.

### A switch every request reads

Maintenance mode and the commission are read constantly, so they are cached
for a minute in memory. The first version used Next's data cache, which is
written to disk and survived a database reset with stale values: a cache
must be no more durable than what it caches. And the check can't live in
edge middleware, which has no database; it sits in the root layout and the
API wrapper, with the paths an admin needs left open.

**What to learn:** audit trails and accountable admin actions; soft states
(suspended) versus destructive ones; where to enforce access (at the
session); cache lifetime and invalidation; feature flags and kill switches.

---

## 29. Borrowing Google's proof, keeping our accounts (E02-07, E08-10)

### Identity is not the account

Google sign-in could have meant Firebase Authentication, a second user store
with its own ids. But everything in PitchUp hangs off our `User`: trust
score, bookings, roles, suspension. So Google is used only for what it is
good at, proving that someone controls an address. The app gets an ID token
(a JWT Google signs) and the server checks it like any other JWT: the
signature against Google's published keys (`jose` caches them and follows
rotation), the issuer, the audience (our Web client, so a token minted for
another app is useless here), the expiry, and `email_verified`. The address
then finds our account, exactly as the password login does. The same
reasoning removed the unused Auth.js Prisma adapter: with an OAuth provider
it would have started writing Account rows for a model we don't keep.

### A new person still owes us what Google doesn't know

Registration needs a phone, a city and a date of birth. A first Google
sign-in answers `PROFILE_NEEDED` instead of inventing them, and the app sends
the same token again with them. The token is the proof both times, so
nothing about the half-finished sign-up has to be stored. The email counts
as verified, because Google verified it; the phone still gets its SMS code
(HANDOVER: "phone verification claims nothing until a real SMS confirms it").
The web portal is stricter: it only opens accounts that already exist,
because venues are created through registration and approval.

### Push: a token per phone, owned by whoever signed in

FCM gives each install a token; the server keeps it per user and sends to it
(§25). Two lifecycle rules matter. The token can change, so every refresh is
registered again. And it belongs to the person, not the phone, so signing
out deletes it; otherwise the next person to sign in would get the
previous one's notifications until the server noticed.

### Config with a key in it is still a secret

`google-services.json` and `GoogleService-Info.plist` look like
configuration, but they carry an API key. They are git-ignored like the Maps
key and documented for download, and the OAuth client ids, which really are
public, sit in the source.

**What to learn:** federated identity versus identity providers as user
stores; verifying OIDC ID tokens (JWKS, `aud`, `iss`); account linking by
verified email and its risks; push token lifecycles; which "config" is
secret.

---

## Things deliberately left incomplete

Honest inventory, so none of it is mistaken for finished:

| Item                 | State                                                             |
| -------------------- | ----------------------------------------------------------------- |
| Rate limiting        | In-memory; resets on restart, per-instance                        |
| Edge middleware      | Cookie presence only; the page is the real gate                   |
| Integration env vars | Optional until their epic                                         |
| Cloudinary           | Signing verified against the algorithm; no live upload tested     |
| Schema changes       | `prisma db push`, not versioned migrations (see §14)              |
| Social login         | Google built; Apple needs an Apple Developer account              |
| Mobile app           | Built, typechecked and unit-tested; not yet run on a device       |
| Mobile colours       | Spec palette; not yet checked for WCAG contrast                   |
| Stripe               | Unit-tested with fakes; never run against a real account          |
| Booking completion   | Nightly job needs `CRON_SECRET` in the deployment                 |
| Review moderation    | Reports flag reviews; no profanity filter, admin tools in E15     |
| Manager dashboard    | Everything but Analytics and the rest of Settings (later epics)   |
| Pay at the venue     | Commission recorded, not billed (E14); no-show penalty fee is E11 |
| Admin panel          | Built (E15); no default no-show fee, settings cached a minute     |
| Push notifications   | Sending built (E13); needs a Firebase project and app wiring      |
| Legal pages          | Mobile links to pitchup.ro terms/privacy/help that don't exist    |

---

## The ideas worth carrying forward

1. **One source of truth.** Duplicated values diverge. Always.
2. **Derive rather than store.** A computed value cannot be stale.
3. **Fail at the earliest possible moment.** Startup beats first request.
4. **Validate at the boundary, and never trust the client.** Sharing a schema
   removes duplication; it does not transfer trust.
5. **Copy a value when you need what was true then; reference it when you need
   what is true now.**
6. **Timing is a side channel.** Identical messages are not identical
   responses.
7. **Write down what a control does not do.** An honest limitation is safe; an
   overstated guarantee is not.
8. **Test somewhere that is not your machine.**
9. **A rule with a name is a rule you can test.** `shirtSetsFor`,
   `mapCenter`, `trustTier`: a decision becomes a function, not an `if`.
10. **Every schema change is also a data change.** Decide what happens to
    the rows that already exist.
11. **Store instants in UTC; reason in the place's time zone.**
12. **Fewer, clearer controls beat complete ones.**
13. **Lock what does not exist yet.** A row lock cannot stop a row that has
    not been inserted; lock the thing being competed for.
14. **Make every handler safe to run twice.** Retries are not optional.
15. **Do the part that can fail outside your control first.** Refund, then
    write; if the refund fails, nothing changed.
16. **If you can't recompute it, record it.** Current state is a row;
    history is a log.
17. **A role is not a permission.** Check that this object belongs to this
    user, every time.
18. **Store a copy only when computing it hurts.** Every copy is a promise
    to keep it in sync.
19. **A status code tells the client what to do next.** Choose it for them.
20. **Leaving should remove the person, not the history others rely on.**
