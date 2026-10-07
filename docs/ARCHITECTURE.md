# Architecture — what E01 built and why

A walkthrough of the decisions in the infrastructure epic. Each section is a
problem, the options, and why one was chosen. Written for someone who knows
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
offPeakRate  Decimal  @db.Decimal(10, 2)
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
platformFee        Decimal
totalAmount        Decimal
```

The price is copied onto the booking rather than read from the pitch at display
time. If a manager raises the hourly rate from 80 to 100 lei, every past
booking must still show what was actually charged. Joining to the live pitch
would silently rewrite history.

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

`scripts/verify-e01.sh` re-runs every acceptance criterion: queries the real
database, starts a dev server, exercises the API, shuts it down.

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

## Things deliberately left incomplete

Honest inventory, so none of it is mistaken for finished:

| Item                   | State                                                         |
| ---------------------- | ------------------------------------------------------------- |
| Rate limiting          | In-memory; resets on restart, per-instance                    |
| Edge middleware        | Cookie presence only; the page is the real gate               |
| Integration env vars   | Optional until their epic                                     |
| Cloudinary             | Signing verified against the algorithm; no live upload tested |
| `/login`, `/dashboard` | Placeholders. Real forms are E02                              |
| Mobile app             | One file proving the workspace link resolves                  |

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
