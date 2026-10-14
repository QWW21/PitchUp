# Where things stand

Last updated at the end of the session that got the Android build running.

## Done

**E01 — Infrastructure: complete.** All ten tickets closed.
`bash scripts/verify-e01.sh` re-runs every acceptance check (26 of them).

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

## Next

**E02-07 (social login)** is the only open item in the epic, and it is blocked
on credentials rather than on code.

Otherwise E02 is done and **E03 — Player: Discover** is next.

Two things worth doing before moving on, neither of which is a ticket:

- **iOS has never built.** It is stuck at a linker error; see the known gaps.
- **There are no automated tests at all.** Every claim in this document was
  verified by hand.

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

## Known gaps

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
- **No automated tests.** Everything was verified by hand — curl against a
  running server for the backend, a live emulator for Android. A regression in,
  say, the enumeration defence would not be caught by anything.
- **No browser testing.** The web pages were checked by inspecting markup, not
  by rendering. No viewport testing at 375 / 768 / 1280.
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
- **`/reset-password` does not exist.** The reset email links to it. The
  `/forgot-password` page and both API routes are built, so the flow dead-ends
  at the last step. This is not in any E02 ticket.
- **When to upgrade React Native.** The 0.76 pin is already forcing an
  rn-screens downgrade and two patches, and that cost will grow.
- The GitHub token in use is shared in the session transcript and should be
  rotated when the project is done with it.

## Running it

See `README.md` for setup. `docs/ARCHITECTURE.md` explains why the
infrastructure is shaped the way it is — worth reading before changing the
schema or the auth flow. `docs/TESTING_E02_MOBILE.md` is the manual test plan
for the mobile auth screens.
