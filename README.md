# PitchUp

Football pitch booking marketplace. Players find and book pitches; venue
managers list them and manage bookings.

Monorepo: `apps/web` (Next.js 15), `apps/mobile` (React Native 0.76),
`packages/shared` (types, Zod schemas, business constants used by both).

## Prerequisites

- Node 20+
- pnpm 9 (`corepack enable pnpm`)
- PostgreSQL 16 (`brew install postgresql@16 && brew services start postgresql@16`)

## Setup

```bash
pnpm install                      # also generates the Prisma client
cp apps/web/.env.example apps/web/.env
```

Fill in `apps/web/.env`. Only three variables are required to boot:

| Variable              | How to get it             |
| --------------------- | ------------------------- |
| `DATABASE_URL`        | see below                 |
| `NEXTAUTH_SECRET`     | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000`   |

The rest are optional until the epic that introduces them (Stripe in E05,
Cloudinary in E01-10, Resend/Twilio/FCM in E13). Their format is still
validated when a value is present.

Create the database:

```bash
createdb pitchup_dev
psql -d postgres -c "CREATE ROLE postgres LOGIN SUPERUSER PASSWORD 'password';"
```

Then push the schema and seed:

```bash
pnpm db:push
pnpm db:seed
```

## Running

```bash
pnpm dev          # web on :3000, Metro on :8082
pnpm db:studio    # browse the database on :5555
```

Metro uses 8082 rather than React Native's default 8081, which collides with
any other RN project's dev server on the same machine. `pnpm android` and
`pnpm ios` pass `--port 8082` so the app points at the same server — if you
launch the app by some other route, pass that flag yourself or it will look
for a bundler on 8081 and fail with "Unable to load script".

### Seeded accounts

Development fixtures only; skipped when `NODE_ENV=production`.

| Email              | Password                          | Role    |
| ------------------ | --------------------------------- | ------- |
| `admin@pitchup.ro` | `ADMIN_PASSWORD`, or `Admin1234!` | ADMIN   |
| `manager@demo.ro`  | `Manager1234!`                    | MANAGER |
| `player@demo.ro`   | `Player1234!`                     | PLAYER  |

The seed also creates sixteen Discover venues (mostly Cluj-Napoca, two in
București), each owned by a `venue-<slug>@demo.ro` manager with the player
password, plus completed bookings and reviews so ratings and sorting have data.

### Maps

The Discover map needs a Google Maps key; everything else works without one.

- **Web:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `apps/web/.env`. Without it the
  map tab shows a message instead.
- **Android:** `GOOGLE_MAPS_API_KEY` in the environment or in
  `~/.gradle/gradle.properties`, read at build time. Without it the map renders
  blank, with markers. Never commit the key.
- **iOS** uses Apple Maps and needs no key.

## Checks

```bash
pnpm typecheck      # tsc --noEmit across all three packages
pnpm lint           # ESLint
pnpm format:check   # Prettier
pnpm build          # production build

bash scripts/verify-e01.sh   # every E01 acceptance criterion, end to end
(cd apps/web && ./node_modules/.bin/tsx ../../scripts/verify-e03.ts)   # E03-01 + Discover helpers
(cd apps/web && ./node_modules/.bin/tsx ../../scripts/verify-e04.ts)   # E04 detail, availability, reviews
```

`verify-e01.sh` needs Postgres running and `apps/web/.env` filled in. It
starts a dev server, exercises the API, and shuts it down. `verify-e03.ts`
and `verify-e04.ts` expect a server already running on :3000 and a seeded
database.

A pre-commit hook runs ESLint and Prettier on staged files.

## Where things stand

`docs/HANDOVER.md` — what is done, what is next, which decisions are settled
and which gaps are known.

## Learning the codebase

`docs/ARCHITECTURE.md` walks through every decision in the infrastructure
epic — why money is `Decimal`, why the trust tier is derived rather than
stored, why login compares against a dummy hash — as a problem, the options,
and the reason one was chosen.

## Layout

```
apps/web/         Next.js — API routes, Prisma, auth
  prisma/         schema.prisma, seed.ts
  src/lib/        prisma, env, cloudinary
  src/lib/api/    response envelope, auth middleware, rate limiting
apps/mobile/      React Native
packages/shared/  types, Zod schemas, business constants
scripts/github/   issue-creation scripts, one per epic — the ticket specs
```

`PRD.md` and `UIUX_SPEC.md` are the product and design source of truth.
