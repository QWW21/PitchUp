# Where things stand

Last updated at the end of the session that implemented E02-08 to E02-14 and
scaffolded the mobile app.

## Done

**E01 — Infrastructure: complete.** All ten tickets closed.
`bash scripts/verify-e01.sh` re-runs every acceptance check (26 of them).

**E02 — Auth: six of fourteen closed.**

| Ticket                          | State                                                |
| ------------------------------- | ---------------------------------------------------- |
| E02-08 backend auth             | closed — register, login, refresh, logout, verify    |
| E02-09 Resend email             | closed — adapter + templates, inactive without a key |
| E02-10 Twilio SMS               | closed — adapter, inactive without credentials       |
| E02-11 password reset           | closed                                               |
| E02-13 web manager login        | closed                                               |
| E02-14 web manager registration | closed                                               |

## Next

**E02-12 (mobile API client) is half done** and committed in that state.

Already written:

- `apps/mobile/src/lib/tokenStorage.ts` — Keychain wrapper
- `apps/mobile/src/lib/apiClient.ts` — axios instance, refresh interceptor
- `apps/mobile/src/lib/authEvents.ts` — unauthorised signal
- `apps/mobile/src/config.ts` — base URL per platform

Still to write for E02-12:

- an auth API module wrapping register / login / verify / resend / reset
- a session store (zustand is already a dependency)
- navigation wiring, so `authEvents.emitUnauthorized()` actually sends the
  user to the login screen — nothing listens to it yet

Then the seven mobile screens: E02-01 splash and onboarding, E02-02 and
E02-03 registration, E02-04 phone OTP, E02-05 login, E02-06 forgot
password, E02-07 social login.

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

## Known gaps

- **No automated tests.** Everything was verified by hand with curl against
  a running server. A regression in, say, the enumeration defence would not
  be caught by anything.
- **No browser testing.** Three web pages were checked by inspecting
  markup, not by rendering. No viewport testing at 375 / 768 / 1280.
- **Neither mobile app has been built or run.** Metro bundles both
  platforms cleanly, but nothing has launched on a simulator — that needs
  Xcode, an Android SDK, and CocoaPods for iOS.
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
- A `/forgot-password` page is linked from the web login but is not in any
  E02 ticket. The reset email also points at `/reset-password`, which does
  not exist yet.
- The GitHub token in use is shared in the session transcript and should be
  rotated when the project is done with it.

## Running it

See `README.md` for setup. `docs/ARCHITECTURE.md` explains why the
infrastructure is shaped the way it is — worth reading before changing the
schema or the auth flow.
