@AGENTS.md

# PitchUp — rules for every Claude session and agent

PitchUp is a football-pitch booking app for Romania: a Next.js web app and
API (`apps/web`), a React Native app (`apps/mobile`) and shared rules, types
and Zod schemas (`packages/shared`). One owner works on it alone; it is not
in production, and Stripe runs in test mode.

## Read first

- `docs/HANDOVER.md`: what is built, every decision taken, known gaps.
- `docs/ARCHITECTURE.md`: why it is built this way.
- `docs/TESTING.md`: the test layers and how the E2E run is isolated.
- `docs/PLAN_AGENT_PIPELINE.md`: how work moves through tickets and agents.

## Work

- Tickets are GitHub Issues on `QWW21/PitchUp` (use `gh`). A ticket's
  numbered acceptance criteria (AC1, AC2…) are what "done" means.
- Business rules live in `packages/shared` (pure, unit-tested) and are used
  by the API, the web and the app alike; don't repeat a rule in a client.
- **Every text in English and Romanian**: `apps/web/src/i18n/{en,ro}`,
  `apps/mobile/src/i18n/{en,ro}`, shared words in
  `packages/shared/src/i18n`. The Romanian catalogs are typed against the
  English ones, so `tsc` lists what's missing.
- API errors are thrown as `api.*` catalog keys; machine-readable reasons go
  in `details.reason`. Clients branch on `code` / `details.reason`, never on
  the message.
- **Snapshot, don't recompute**: what a booking was agreed at (price, air,
  refund policy) is stored on it; nothing reprices an existing booking.
- PitchUp takes no commission; venues pay a subscription (C-15), and only
  subscribed, approved venues are live (`lib/venues/live.ts`).
- Write files as UTF-8 (a file saved in a Windows codepage broke the build).
- Match the surrounding code: its comment density, naming and idiom.

## Checks before handing work over

```bash
pnpm typecheck      # shared, web, mobile
pnpm lint
pnpm test           # shared + web unit tests (vitest)
pnpm test:mobile    # mobile Jest
pnpm test:e2e       # API + web Playwright, about 13 minutes
```

- **Mobile is checked with Jest only.** It is never built or run.
- E2E builds the app and serves it on **port 3100** with its own database
  (`pitchup_test`), blank Stripe keys and `DEFAULT_LOCALE=en`; keep it that
  way. A dev server for manual checks must use another port.
  `E2E_SKIP_BUILD=1` reuses the last build when only tests changed.
- Web E2E takes screenshots with `snap()`; `EVIDENCE=1` also writes them to
  `docs/test-evidence/web/<area>/NN-name.jpg`.
- Schema changes are applied with `prisma db push` (see HANDOVER).

## Never commit

`README.md`, the root `package.json`, `.claude/launch.json`,
`docs/PRODUCT_GAPS_AND_ROADMAP.md`, `.env`, the Firebase config files.
Before every commit, scan the staged diff for `AIzaSy`, `GOCSPX` and private
keys. Commit only when the owner asks; end commit messages with the
`Co-Authored-By` line the session gives.
