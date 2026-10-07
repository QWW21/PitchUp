#!/usr/bin/env bash
# e01.sh — create all E01 Infrastructure issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E01 — Infrastructure")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E01 — Infrastructure' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E01 — Infrastructure)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E01-01 — Prisma ORM setup + DB connection
# ─────────────────────────────────────────────────────────────────────────────
title="[E01-01] Configure PostgreSQL + Prisma ORM connection"
read -r -d '' body << 'BODY' || true
## Summary
Establish the PostgreSQL database connection via Prisma ORM. Create the `PrismaClient` singleton used by all API routes and the initial empty `schema.prisma`.

## Context
Every data operation in PitchUp goes through Prisma. This ticket must be completed before E01-02 (schema) and all backend work. Prisma lives in `apps/web` — the mobile app never connects directly to the DB.

## Files to create / modify
| File | Action |
|---|---|
| `apps/web/prisma/schema.prisma` | Create — datasource + generator only |
| `apps/web/src/lib/prisma.ts` | Create — singleton client |
| `apps/web/.env.example` | Add `DATABASE_URL` entry |
| `apps/web/package.json` | Add `db:push`, `db:generate`, `db:studio`, `db:seed` scripts |
| Root `package.json` | Add workspace-level `db:*` script aliases |

## Acceptance Criteria
- [ ] `pnpm --filter web db:push` applies the (empty) schema to a local Postgres DB without errors
- [ ] `pnpm --filter web db:generate` produces `@prisma/client` types
- [ ] `pnpm --filter web db:studio` opens Prisma Studio on port 5555
- [ ] Importing `prisma` from `@/lib/prisma` in any API route does not create a new client on every hot-reload (singleton confirmed)
- [ ] `apps/web/.env.example` documents `DATABASE_URL` with a local example value
- [ ] `schema.prisma` has `provider = "postgresql"` and `output = "../node_modules/.prisma/client"`

## Implementation notes

### Singleton pattern (prevents dev hot-reload connection leak)
```typescript
// apps/web/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### schema.prisma starter
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### package.json scripts
```json
"db:generate": "prisma generate",
"db:push":     "prisma db push",
"db:migrate":  "prisma migrate dev",
"db:studio":   "prisma studio",
"db:seed":     "tsx prisma/seed.ts"
```

## Edge cases & error handling
- If `DATABASE_URL` is missing at startup → Prisma throws `PrismaClientInitializationError` with URL guidance. Do **not** catch this — let it crash loudly.
- Local Postgres not running → same error. Add note in README on starting local DB (`brew services start postgresql@16`).
- Connection pool exhaustion in prod → configure `connection_limit` as a URL param: `?connection_limit=5&pool_timeout=10`

## Environment variable
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/pitchup_dev?schema=public"
```

## Definition of done
- [ ] `pnpm --filter web db:push` runs clean on a fresh local Postgres instance
- [ ] Singleton confirmed: console shows exactly one "Prisma Client initialized" log per process, not per request
- [ ] PR reviewed and merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: infrastructure","priority: critical","type: infra"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E01-02 — Complete Prisma data schema
# ─────────────────────────────────────────────────────────────────────────────
title="[E01-02] Define complete Prisma schema — all data models and enums"
read -r -d '' body << 'BODY' || true
## Summary
Implement the full Prisma schema for PitchUp based on PRD §13 (Data Models). All 11 models + all enums defined, relations correct, indexes on lookup fields.

## Context
This is the schema all features build on. Changes later are costly (migrations on live data). Get it right now. Reference: `PRD.md §13`.

## Models to define

### Enums
```
Role              PLAYER | MANAGER | ADMIN
CompanyStatus     PENDING | ACTIVE | SUSPENDED
BookingStatus     PENDING | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW
DisputeStatus     NONE | OPEN | RESOLVED_PLAYER | RESOLVED_MANAGER
ModerationStatus  APPROVED | PENDING | REMOVED
SurfaceType       NATURAL_GRASS | ARTIFICIAL_GRASS | FUTSAL
PitchSize         FIVE_A_SIDE | SEVEN_A_SIDE | ELEVEN_A_SIDE | CUSTOM
AmenityType       SHOWERS_FREE | SHOWERS_PAID | CHANGING_ROOMS | PARKING_FREE |
                  PARKING_PAID | NIGHT_LIGHTING | BALL_RENTAL_FREE | BALL_RENTAL_PAID |
                  REFRESHMENTS | LOCKERS | REFEREE | FIRST_AID | WHEELCHAIR | WIFI
TrustScoreReason  BOOKING_COMPLETED | REVIEW_LEFT | LATE_CANCEL | VERY_LATE_CANCEL |
                  NO_SHOW | DISPUTE_WON | MONTHLY_RECOVERY
NotificationType  BOOKING_CONFIRMED | BOOKING_REMINDER_24H | BOOKING_REMINDER_2H |
                  BOOKING_CANCELLED_PLAYER | BOOKING_CANCELLED_MANAGER | REFUND_PROCESSED |
                  NO_SHOW_REPORTED | PENALTY_CHARGED | DISPUTE_RESOLVED |
                  REVIEW_LEFT | MANAGER_REPLIED | OTP | PASSWORD_RESET
```

### Models
All fields match PRD §13. Key constraints:
- `User.email` — `@unique`
- `User.phone` — `@unique`
- `User.trustScore` — default 100, int
- `Company` → `User` via `ownerId` (one manager owns one company for v1.0)
- `Pitch` → `Company` via `companyId`
- `Booking.startTime` and `Booking.endTime` — `DateTime` (UTC)
- `Booking.teamsData` — `Json` (stores array of team objects)
- `NoShow.disputeEvidenceUrls` — `Json` (array of strings)
- `Review.photoUrls` — `Json` (array of strings)
- `Notification.data` — `Json`
- `ShirtInventory` — unique constraint on `(pitchId, colour)`

### Required indexes
```
@@index([companyId]) on Pitch
@@index([pitchId, startTime]) on Booking  — availability queries
@@index([playerId]) on Booking
@@index([userId, createdAt]) on Notification
@@index([pitchId]) on Review
@@index([city]) on Company
```

## Acceptance Criteria
- [ ] All 11 models defined: `User`, `Company`, `Pitch`, `PitchPhoto`, `PitchAmenity`, `ShirtInventory`, `Booking`, `NoShow`, `Review`, `Notification`, `TrustScoreEvent`
- [ ] All enums defined (see above)
- [ ] All relations correct (foreign keys, `onDelete` behavior set)
- [ ] `pnpm --filter web db:push` runs without errors on fresh DB
- [ ] `pnpm --filter web db:generate` produces types with no TS errors
- [ ] No field names conflict with Prisma reserved words

## `onDelete` rules
| Relation | onDelete |
|---|---|
| `Pitch.company` | `Cascade` — deleting company removes its pitches |
| `Booking.pitch` | `Restrict` — cannot delete pitch with bookings |
| `Booking.player` | `Restrict` — cannot delete user with bookings |
| `Review.booking` | `Cascade` |
| `NoShow.booking` | `Cascade` |
| `Notification.user` | `Cascade` |
| `TrustScoreEvent.user` | `Cascade` |
| `PitchPhoto.pitch` | `Cascade` |
| `PitchAmenity.pitch` | `Cascade` |
| `ShirtInventory.pitch` | `Cascade` |

## Edge cases
- `Booking.startTime`/`endTime` stored UTC, displayed in user's local tz on frontend
- `Booking` cannot span midnight — enforced in API layer, not DB (DB stores times, business rule lives in service)
- `teamsData` JSON shape: `[{ colour: string, playerCount: number, shirts: [{ colour: string, qty: number }] }]`
- `peakHoursDefinition` on `Pitch` JSON shape: `[{ days: number[], startTime: string, endTime: string }]` where days = 0-6 (Sunday = 0)

## Definition of done
- [ ] Schema pushed to local DB, no migration errors
- [ ] All Prisma types generated, imported in at least one file to verify no TS errors
- [ ] Schema reviewed by developer — field names and types match PRD §13 exactly
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: infrastructure","priority: critical","type: backend"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E01-03 — Database seed script
# ─────────────────────────────────────────────────────────────────────────────
title="[E01-03] Create database seed script — cities, admin user, dev fixtures"
read -r -d '' body << 'BODY' || true
## Summary
Seed script that populates required reference data (Romanian cities) and creates a dev admin user + optional dev fixtures (one company + pitch for local testing).

## Context
City list is mandatory — Discover tab requires a city to be selected from a predefined list. Admin user is needed to test approval flows. Dev fixtures let developers skip manual data entry when testing locally.

## File to create
`apps/web/prisma/seed.ts`

## Seed data

### Romanian cities (required for production)
At minimum, the 10 largest Romanian cities must be seeded:
`București`, `Cluj-Napoca`, `Timișoara`, `Iași`, `Constanța`, `Craiova`, `Brașov`, `Galați`, `Ploiești`, `Oradea`

Store as `City` model (create this model: `id String @id @default(cuid())`, `name String @unique`, `county String`, `country String @default("RO")`).

> **Note:** `City` model is not in PRD §13 — add it to Prisma schema in E01-02 or as an addendum here.

### Admin user (required)
```
email: admin@pitchup.ro
password: hashed("Admin1234!")   ← bcrypt, cost 12
role: ADMIN
name: PitchUp Admin
emailVerified: true
phoneVerified: true
```
Use `process.env.ADMIN_PASSWORD` if set, else default to `"Admin1234!"`. Document in `.env.example`.

### Dev company + pitch (dev-only, guarded by NODE_ENV check)
```
Company: "Demo Sports Club" — Cluj-Napoca — ACTIVE
Pitch: "Pitch A" — ARTIFICIAL_GRASS — 5v5 — 80 RON/h peak, 60 RON/h off-peak
```
Skip if `NODE_ENV === 'production'`.

## Acceptance Criteria
- [ ] `pnpm --filter web db:seed` runs without errors on fresh seeded DB
- [ ] Re-running seed is idempotent (use `upsert` not `create` for cities and admin)
- [ ] All 10+ cities present in `City` table after seed
- [ ] Admin user exists with correct role and hashed password
- [ ] Dev company + pitch created only in development
- [ ] Seed logs each step to console for visibility

## Implementation pattern (idempotent upsert)
```typescript
await prisma.city.upsert({
  where: { name: 'Cluj-Napoca' },
  update: {},
  create: { name: 'Cluj-Napoca', county: 'Cluj', country: 'RO' },
})
```

## Edge cases
- Running seed on prod DB: dev fixtures must be guarded with `if (process.env.NODE_ENV !== 'production')`
- Admin password from env: if `ADMIN_PASSWORD` set, use it; else use default and print warning
- `bcrypt` import: use `bcryptjs` (pure JS, no native dep) for compatibility in both Next.js and seed script

## Definition of done
- [ ] Seed runs clean on fresh local DB
- [ ] Seed is idempotent (safe to run twice)
- [ ] Cities seeded and verified in Prisma Studio
- [ ] Admin login works via auth endpoint after seed
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: infrastructure","priority: high","type: backend"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E01-04 — packages/shared — Zod schemas + business constants
# ─────────────────────────────────────────────────────────────────────────────
title="[E01-04] Set up packages/shared — Zod validation schemas and business constants"
read -r -d '' body << 'BODY' || true
## Summary
Populate `packages/shared` with Zod validation schemas (used in both API request validation and mobile/web form validation) and business constants (trust score deltas, penalty amounts, cancellation windows).

## Context
`packages/shared` is already scaffolded in the monorepo. It's imported by `apps/web` (API routes) and `apps/mobile` (form validation). Zod runs in both environments. This avoids duplicating validation logic.

## Files to create in `packages/shared/src/`

### schemas/ — Zod schemas

| File | Schemas |
|---|---|
| `auth.ts` | `RegisterPlayerSchema`, `RegisterManagerSchema`, `LoginSchema`, `ResetPasswordSchema`, `VerifyOtpSchema` |
| `user.ts` | `UpdateUserSchema`, `UserProfileSchema` |
| `company.ts` | `CreateCompanySchema`, `UpdateCompanySchema` |
| `pitch.ts` | `CreatePitchSchema`, `UpdatePitchSchema`, `PitchAmenitySchema`, `ShirtInventorySchema` |
| `booking.ts` | `CreateBookingSchema`, `CancelBookingSchema`, `NoShowSchema`, `DisputeSchema` |
| `review.ts` | `CreateReviewSchema`, `UpdateReviewSchema`, `ManagerReplySchema`, `ReportReviewSchema` |

### constants/ — business constants

| File | Contents |
|---|---|
| `trust.ts` | `TRUST_SCORE_DELTAS`, `TRUST_TIERS` |
| `cancellation.ts` | `CANCELLATION_WINDOWS`, `REFUND_PERCENTAGES` |
| `penalties.ts` | `NO_SHOW_FLAT_FEE`, `NO_SHOW_PERCENTAGE`, `PLATFORM_FEE_PERCENT` |
| `shirts.ts` | `SHIRT_COLOURS` (predefined list: RED, BLUE, GREEN, YELLOW, ORANGE, WHITE, BLACK, PURPLE) |
| `cities.ts` | Romanian cities array (same list as seed — single source of truth) |

### index.ts — re-export everything

## Key schemas (examples)

```typescript
// auth.ts
export const RegisterPlayerSchema = z.object({
  name:        z.string().min(2).max(100),
  email:       z.string().email(),
  phone:       z.string().regex(/^\+\d{8,15}$/, 'Phone must include country code'),
  password:    z.string().min(8).regex(/[A-Z]/, 'Must contain uppercase').regex(/\d/, 'Must contain number'),
  city:        z.string().min(1),
  dateOfBirth: z.string().datetime().refine(dob => {
    const age = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    return age >= 16
  }, 'Must be at least 16 years old'),
})

// trust.ts
export const TRUST_SCORE_DELTAS = {
  BOOKING_COMPLETED:  +2,
  REVIEW_LEFT:        +1,
  LATE_CANCEL:        -5,
  VERY_LATE_CANCEL:  -10,
  NO_SHOW:           -20,
  DISPUTE_WON:       +10,
  MONTHLY_RECOVERY:   +1,
} as const

export const TRUST_TIERS = [
  { label: 'Excellent', min: 90, max: 100 },
  { label: 'Good',      min: 70, max: 89  },
  { label: 'Fair',      min: 50, max: 69  },
  { label: 'Poor',      min: 30, max: 49  },
  { label: 'Suspended', min: 0,  max: 29  },
] as const
```

## Acceptance Criteria
- [ ] `packages/shared` compiles with `tsc --noEmit` — no TypeScript errors
- [ ] `apps/web` can import from `@pitchup/shared` without errors
- [ ] `apps/mobile` can import from `@pitchup/shared` without errors (no Node-only APIs used in shared code)
- [ ] `RegisterPlayerSchema` enforces age ≥ 16 (test with `1900-01-01` → fails, `2009-01-01` → passes)
- [ ] All business constants match PRD §9 (trust score) and §9.2 (cancellation policy) values exactly
- [ ] `SHIRT_COLOURS` matches UIUX_SPEC §7.3: RED, BLUE, GREEN, YELLOW, ORANGE, WHITE, BLACK, PURPLE

## Important constraints
- No Node.js-only imports (no `fs`, `path`, `crypto`) — `apps/mobile` uses Metro bundler
- `zod` version must match between `packages/shared` and both apps (use `peerDependencies`)
- Export only types and pure functions — no side effects at module level

## Definition of done
- [ ] All schemas and constants exported from `packages/shared/src/index.ts`
- [ ] Both `apps/web` and `apps/mobile` import and use at least one schema (to verify workspace linkage)
- [ ] `pnpm --filter shared build` succeeds
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: infrastructure","priority: critical","type: infra","type: cross-platform"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E01-05 — Environment variable validation
# ─────────────────────────────────────────────────────────────────────────────
title="[E01-05] Implement environment variable validation with Zod"
read -r -d '' body << 'BODY' || true
## Summary
Validate all environment variables at startup using Zod. Missing or malformed vars fail fast with a clear error — not silently at runtime when the feature is first used.

## Context
Without env validation, a missing `STRIPE_SECRET_KEY` is only discovered when a user tries to pay. Fail at process startup instead.

## File to create
`apps/web/src/lib/env.ts`

## Required environment variables

### Server-only (never exposed to browser)
```
DATABASE_URL          postgresql://...
NEXTAUTH_SECRET       random 32+ char string
STRIPE_SECRET_KEY     sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET whsec_...
CLOUDINARY_API_KEY    string
CLOUDINARY_API_SECRET string
RESEND_API_KEY        re_...
TWILIO_ACCOUNT_SID    AC...
TWILIO_AUTH_TOKEN     string
TWILIO_PHONE_NUMBER   +1... (E.164 format)
FCM_SERVER_KEY        string
ADMIN_PASSWORD        string (optional, defaults to dev password)
```

### Public (exposed to browser via NEXT_PUBLIC_ prefix)
```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME  string
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY    string
NEXT_PUBLIC_APP_URL                https://pitchup.ro
```

## Implementation using `@t3-oss/env-nextjs`
```typescript
// apps/web/src/lib/env.ts
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL:          z.string().url(),
    NEXTAUTH_SECRET:       z.string().min(32),
    STRIPE_SECRET_KEY:     z.string().startsWith('sk_'),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
    CLOUDINARY_API_KEY:    z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),
    RESEND_API_KEY:        z.string().startsWith('re_'),
    TWILIO_ACCOUNT_SID:    z.string().startsWith('AC'),
    TWILIO_AUTH_TOKEN:     z.string().min(1),
    TWILIO_PHONE_NUMBER:   z.string().regex(/^\+\d+$/),
    FCM_SERVER_KEY:        z.string().min(1),
    ADMIN_PASSWORD:        z.string().optional(),
    NODE_ENV:              z.enum(['development', 'test', 'production']),
  },
  client: {
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().min(1),
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:   z.string().min(1),
    NEXT_PUBLIC_APP_URL:               z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL:                      process.env.DATABASE_URL,
    NEXTAUTH_SECRET:                   process.env.NEXTAUTH_SECRET,
    // ... (all vars)
  },
})
```

## Acceptance Criteria
- [ ] `apps/web/src/lib/env.ts` exports `env` object with typed properties
- [ ] Removing `DATABASE_URL` from `.env` causes `next dev` to exit with a clear validation error listing the missing variable
- [ ] `apps/web/.env.example` documents every variable with a placeholder and one-line comment
- [ ] `NEXT_PUBLIC_*` vars are accessible from client components, server vars are not
- [ ] `env.ts` is imported in `apps/web/src/app/layout.tsx` (or any startup file) to trigger validation at boot

## Deployment note
Vercel: set all server vars in project settings (encrypted). Set `NEXT_PUBLIC_*` vars as environment variables (not secret, accessible in browser bundle). Document this in project README.

## `.env.example` structure
Group by service:
```
# Database
DATABASE_URL=

# Auth
NEXTAUTH_SECRET=   # generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Resend (email)
RESEND_API_KEY=

# Twilio (SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# FCM (push notifications)
FCM_SERVER_KEY=

# Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Definition of done
- [ ] `env.ts` implemented and imported at app startup
- [ ] `.env.example` complete and committed (no real values)
- [ ] `.env` (real values) is in `.gitignore` — verify it is not committed
- [ ] Missing var → clear console error at startup (tested manually)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: infrastructure","priority: high","type: infra"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E01-06 — Code quality tooling
# ─────────────────────────────────────────────────────────────────────────────
title="[E01-06] Configure ESLint, Prettier, and Husky pre-commit hooks"
read -r -d '' body << 'BODY' || true
## Summary
Set up consistent code quality tooling across the monorepo: ESLint (with TypeScript + React rules), Prettier (formatting), and Husky + lint-staged (enforced on commit).

## Context
Prevents style debates in PRs and catches obvious errors before they reach CI. Set up once, enforced automatically.

## Files to create / modify

| File | Action |
|---|---|
| `.eslintrc.js` (root) | Create — base config |
| `apps/web/.eslintrc.js` | Create — extends root + Next.js rules |
| `apps/mobile/.eslintrc.js` | Create — extends root + React Native rules |
| `.prettierrc` | Create — formatting rules |
| `.prettierignore` | Create |
| `.husky/pre-commit` | Create — runs lint-staged |
| `.lintstagedrc.js` | Create — per-file-type commands |
| Root `package.json` | Add `lint`, `format`, `format:check` scripts |

## ESLint config

### Root `.eslintrc.js`
```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
}
```

### `apps/web/.eslintrc.js`
Extends `next/core-web-vitals` + root.

### `apps/mobile/.eslintrc.js`
Extends `plugin:react-native/all` + root.

## Prettier config
```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100,
  "arrowParens": "avoid"
}
```

## Husky + lint-staged
```javascript
// .lintstagedrc.js
module.exports = {
  '**/*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '**/*.{json,md,css}': ['prettier --write'],
}
```

## Acceptance Criteria
- [ ] `pnpm lint` runs ESLint across all packages and exits non-zero on errors
- [ ] `pnpm format` formats all files with Prettier
- [ ] `pnpm format:check` exits non-zero if any file is not formatted (used in CI)
- [ ] Committing an unformatted `.ts` file triggers Prettier auto-fix via Husky
- [ ] Committing a file with a linting error blocks the commit with a clear message
- [ ] `@typescript-eslint/no-explicit-any` is an error (not warning)
- [ ] `no-console` is a warning (allows `console.warn` and `console.error`)

## Definition of done
- [ ] All existing files pass lint + format check after this ticket
- [ ] Pre-commit hook runs in < 10 seconds on typical change set
- [ ] CI pipeline runs `pnpm lint && pnpm format:check` (added to Turborepo lint task)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: infrastructure","priority: medium","type: infra"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E01-07 — Turborepo pipeline verification
# ─────────────────────────────────────────────────────────────────────────────
title="[E01-07] Verify and extend Turborepo pipeline — dev, build, lint, type-check"
read -r -d '' body << 'BODY' || true
## Summary
Audit and extend the existing `turbo.json` to ensure `dev`, `build`, `lint`, `type-check`, and `db:*` tasks work correctly across the monorepo with proper caching and dependency ordering.

## Context
`turbo.json` exists from initial scaffold but may not have correct `dependsOn` for the DB tasks or the new packages. This ticket hardens it before any feature work begins.

## Expected `turbo.json` pipeline

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    },
    "db:seed": {
      "cache": false,
      "dependsOn": ["db:push"]
    },
    "format:check": {}
  }
}
```

## pnpm workspace (`pnpm-workspace.yaml`)
Verify this file exists and includes:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

## Root `package.json` scripts
```json
{
  "scripts": {
    "dev":        "turbo dev",
    "build":      "turbo build",
    "lint":       "turbo lint",
    "type-check": "turbo type-check",
    "format":     "prettier --write .",
    "format:check":"prettier --check ."
  }
}
```

## Acceptance Criteria
- [ ] `pnpm dev` starts both `apps/web` (Next.js on :3000) and `apps/mobile` (Metro bundler on :8081) concurrently
- [ ] `pnpm build` builds `packages/shared` before `apps/web` (dependency order respected)
- [ ] `pnpm lint` runs across all packages
- [ ] `pnpm type-check` runs `tsc --noEmit` in all packages
- [ ] Turborepo cache works: second `pnpm build` with no changes completes in < 2 seconds (cache hit)
- [ ] `pnpm --filter web dev` starts only web (filter works)

## Workspace internal package resolution
`apps/web/package.json` must list `@pitchup/shared` as a dependency:
```json
"dependencies": {
  "@pitchup/shared": "workspace:*"
}
```
Same for `apps/mobile`. Verify `pnpm install` resolves internal packages correctly.

## Definition of done
- [ ] `pnpm dev` works end-to-end from fresh clone (`git clone → pnpm install → pnpm dev`)
- [ ] `pnpm build` succeeds in CI (no local-only workarounds needed)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: infrastructure","priority: medium","type: infra"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E01-08 — Next.js API base layer
# ─────────────────────────────────────────────────────────────────────────────
title="[E01-08] Create Next.js API base layer — response shape, auth middleware, rate limiting"
read -r -d '' body << 'BODY' || true
## Summary
Establish the foundational API infrastructure: standard response envelope, authentication middleware helpers, error handling, and basic rate limiting. All API routes build on these primitives.

## Context
Consistency in API response shape makes the mobile client predictable. Auth middleware prevents copy-pasting `if (!session) return 401` in every route.

## Files to create

### `apps/web/src/lib/api/`

| File | Purpose |
|---|---|
| `response.ts` | Standard response shape helpers |
| `middleware.ts` | `requireAuth()`, `requireRole()` |
| `errors.ts` | Typed API error classes |
| `rate-limit.ts` | Simple in-memory rate limiter |
| `validate.ts` | Zod request body validator |

### `apps/web/src/app/api/v1/health/route.ts`
Health check endpoint (no auth).

## Standard response shape

```typescript
// response.ts
type ApiSuccess<T> = { data: T; error: null; meta?: Record<string, unknown> }
type ApiError    = { data: null; error: { code: string; message: string; details?: unknown } }

export function ok<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ data, error: null, meta } satisfies ApiSuccess<T>)
}

export function err(code: string, message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json({ data: null, error: { code, message, details } } satisfies ApiError, { status })
}
```

## Error codes (string enum, used in `errors.ts`)
```
UNAUTHORIZED        401 — no session / invalid JWT
FORBIDDEN           403 — wrong role or ownership
NOT_FOUND           404
VALIDATION_ERROR    400 — Zod parse failure
CONFLICT            409 — e.g. booking slot taken
PAYMENT_REQUIRED    402
INTERNAL_ERROR      500
RATE_LIMITED        429
```

## Auth middleware pattern
```typescript
// middleware.ts
export async function requireAuth(
  request: NextRequest,
  handler: (req: NextRequest, session: Session) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return err('UNAUTHORIZED', 'Authentication required', 401)
  return handler(request, session)
}

export function requireRole(role: Role) {
  return (handler: RouteHandler) => async (req: NextRequest, session: Session) => {
    if (session.user.role !== role && session.user.role !== 'ADMIN') {
      return err('FORBIDDEN', 'Insufficient permissions', 403)
    }
    return handler(req, session)
  }
}
```

## Request validation helper
```typescript
// validate.ts
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse }> {
  const body = await request.json().catch(() => null)
  const result = schema.safeParse(body)
  if (!result.success) {
    return { error: err('VALIDATION_ERROR', 'Invalid request body', 400, result.error.flatten()) }
  }
  return { data: result.data }
}
```

## Rate limiter (in-memory, simple)
- 5 requests per 15 minutes per IP for auth endpoints
- 60 requests per minute per IP for general endpoints
- Use `Map<string, { count: number, resetAt: number }>` in memory
- Note: in-memory rate limiting resets on process restart — acceptable for v1.0. Upgrade to Redis in v1.1.

## Health endpoint
```
GET /api/v1/health
→ 200 { data: { status: "ok", version: "1.0.0", timestamp: "..." }, error: null }
```
No auth required. Used by Vercel health checks.

## Acceptance Criteria
- [ ] `GET /api/v1/health` returns `200` with correct shape
- [ ] Auth route without session returns `{ data: null, error: { code: "UNAUTHORIZED", ... } }` with status `401`
- [ ] `validateBody` with invalid input returns `{ error: { code: "VALIDATION_ERROR", details: { fieldErrors: {...} } } }`
- [ ] Rate limiter blocks 6th request within 15 min window on auth endpoints (returns `429`)
- [ ] All helpers have TypeScript return types — no `any` usage
- [ ] `ok()` and `err()` used consistently (no raw `NextResponse.json()` in route files)

## Definition of done
- [ ] All helpers implemented and exported
- [ ] Health endpoint deployed and returning 200
- [ ] At least one example route written using the middleware pattern (can be `GET /api/v1/health` itself)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: infrastructure","priority: critical","type: backend"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E01-09 — NextAuth.js v5 setup
# ─────────────────────────────────────────────────────────────────────────────
title="[E01-09] Configure NextAuth.js v5 — credentials provider, Prisma adapter, JWT for mobile"
read -r -d '' body << 'BODY' || true
## Summary
Configure NextAuth.js v5 with: Credentials provider (email + password), Prisma adapter for DB session storage, JWT strategy for mobile API clients, and Next.js middleware for route protection.

## Context
Web uses cookie-based sessions. Mobile uses JWT bearer tokens (stored in SecureStorage). NextAuth v5 supports both strategies simultaneously via callbacks.

## Files to create / modify

| File | Purpose |
|---|---|
| `apps/web/src/auth.ts` | NextAuth config (providers, adapter, callbacks) |
| `apps/web/src/middleware.ts` | Next.js middleware — protect `/dashboard`, `/api/v1/*` |
| `apps/web/src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler |
| `apps/web/src/types/next-auth.d.ts` | Module augmentation for session types |

## Auth config (`auth.ts`)

```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },   // JWT for both web and mobile
  providers: [
    Credentials({
      credentials: {
        email:    { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({ where: { email: credentials.email as string } })
        if (!user || !user.passwordHash) return null
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!valid) return null
        if (!user.emailVerified) throw new Error('EMAIL_NOT_VERIFIED')
        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      session.user.id   = token.id as string
      session.user.role = token.role as Role
      return session
    },
  },
  pages: {
    signIn:  '/login',
    error:   '/login',
  },
})
```

## Session type augmentation
```typescript
// types/next-auth.d.ts
import { Role } from '@prisma/client'
declare module 'next-auth' {
  interface Session {
    user: { id: string; role: Role; email: string; name: string }
  }
  interface JWT {
    id: string; role: Role
  }
}
```

## Mobile JWT flow
Mobile clients do not use cookies. They POST to `/api/auth/mobile/login` (custom route, not NextAuth) which returns a signed JWT. This custom route is built in E02. This ticket only sets up the NextAuth base — mobile custom route is E02.

## Route protection middleware
```typescript
// middleware.ts
import { auth } from '@/auth'

export default auth((req) => {
  const isAuth = !!req.auth
  const isManagerRoute = req.nextUrl.pathname.startsWith('/dashboard')
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/v1')
  const isAuthRoute = req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/register')

  if (isManagerRoute && !isAuth) {
    return Response.redirect(new URL('/login', req.url))
  }
  // API routes return JSON 401 (handled in route-level middleware from E01-08)
})

export const config = {
  matcher: ['/dashboard/:path*', '/api/v1/:path*'],
}
```

## Acceptance Criteria
- [ ] `POST /api/auth/callback/credentials` with valid email+password sets a session cookie
- [ ] Accessing `/dashboard` without session redirects to `/login`
- [ ] `auth()` called in a Server Component returns the user session
- [ ] `session.user.id` and `session.user.role` are typed and available
- [ ] Wrong password returns `CredentialsSignin` error (do not expose "user not found" vs "wrong password" distinction to client)
- [ ] Unverified email returns specific error code `EMAIL_NOT_VERIFIED` (handled in login form in E02)
- [ ] `bcryptjs` used (not native `bcrypt`) for cross-platform compatibility

## Definition of done
- [ ] Login via Credentials provider works end-to-end in browser
- [ ] Session persists across page refreshes
- [ ] `/dashboard` redirect to `/login` works when unauthenticated
- [ ] No `any` types in auth config
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: infrastructure","priority: critical","type: backend"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E01-10 — Cloudinary integration
# ─────────────────────────────────────────────────────────────────────────────
title="[E01-10] Set up Cloudinary SDK — upload utility, image presets, signed uploads"
read -r -d '' body << 'BODY' || true
## Summary
Configure Cloudinary for all file uploads (pitch photos, profile photos, review photos, company logos). Implement a server-side upload utility and define transformation presets. Use signed uploads so clients never receive the API secret.

## Context
Cloudinary stores and serves all images. No images are stored on the Next.js server or in the DB (only URLs stored). Unsigned uploads would expose the API secret to clients — use signed upload signatures generated server-side.

## Files to create

| File | Purpose |
|---|---|
| `apps/web/src/lib/cloudinary.ts` | SDK config + upload utility |
| `apps/web/src/app/api/v1/upload/sign/route.ts` | Signed upload signature endpoint |

## Cloudinary config
```typescript
// lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary'
import { env } from '@/lib/env'

cloudinary.config({
  cloud_name: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key:    env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure:     true,
})

export { cloudinary }
```

## Image upload folders
| Context | Cloudinary folder |
|---|---|
| Pitch photos | `pitchup/pitches/{pitchId}/` |
| Company logos | `pitchup/companies/{companyId}/` |
| Profile photos | `pitchup/users/{userId}/` |
| Review photos | `pitchup/reviews/{reviewId}/` |

## Transformation presets (eager transformations)

| Preset name | Dimensions | Format | Quality | Use |
|---|---|---|---|---|
| `pitch_cover` | 800×600 (crop: fill) | WebP | auto | Company list cards |
| `pitch_thumb` | 80×80 (crop: fill) | WebP | auto | Pitch card thumbnails |
| `pitch_gallery` | 1200×800 (crop: limit) | WebP | auto | Gallery full view |
| `avatar_sm` | 64×64 (crop: fill, gravity: face) | WebP | auto | User avatars |
| `logo` | 400×400 (crop: pad, bg: white) | WebP | auto | Company logos |

## Server upload function
```typescript
export async function uploadImage(
  file: Buffer | string,  // Buffer for server-side, base64 string or URL
  folder: string,
  publicId?: string,
): Promise<{ url: string; publicId: string }> {
  const result = await cloudinary.uploader.upload(file, {
    folder,
    public_id: publicId,
    eager: [{ width: 800, height: 600, crop: 'fill', format: 'webp' }],
    overwrite: true,
  })
  return { url: result.secure_url, publicId: result.public_id }
}

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}
```

## Signed upload signature endpoint
Mobile + web clients request a signature, then upload directly to Cloudinary (no data goes through Next.js server — saves bandwidth).

```
POST /api/v1/upload/sign
Auth: required
Body: { folder: string, publicId?: string }
Response: { signature, timestamp, apiKey, cloudName }
```

Client uses signature with Cloudinary's upload widget or SDK.

## Acceptance Criteria
- [ ] `uploadImage()` successfully uploads a test image and returns a `secure_url`
- [ ] `deleteImage()` removes image from Cloudinary
- [ ] `POST /api/v1/upload/sign` returns valid signature (can be verified via Cloudinary's signature check)
- [ ] Direct upload using signature from `/upload/sign` succeeds from browser fetch
- [ ] All uploaded images served over HTTPS
- [ ] API secret never appears in client-side code or browser network tab

## Edge cases
- File size limit: reject uploads > 5MB (pitch photos) / 2MB (logos/avatars) at the sign endpoint before generating signature
- Invalid file type: only allow `image/jpeg`, `image/png`, `image/webp` — check MIME type at sign endpoint
- Cloudinary error: wrap in try/catch, return `INTERNAL_ERROR` — do not leak Cloudinary error details to client
- Orphaned images: if DB write fails after upload, image stays on Cloudinary — acceptable for v1.0, add cleanup job in v1.1

## Definition of done
- [ ] Test image upload works locally
- [ ] Signed upload flow tested via browser fetch (simulates mobile client)
- [ ] No API secret in client bundles (verify with `grep -r "CLOUDINARY_API_SECRET" apps/web/.next/` — should return nothing)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: infrastructure","priority: high","type: backend"]' \
  "$MILESTONE"

echo ""
echo "✓ E01 — Infrastructure: 10 issues created"
BODY
