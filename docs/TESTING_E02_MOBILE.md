# E02 Mobile Auth — Testing Guide

Step-by-step manual test plan for all 7 screens. Run these after the web server
and Metro bundler are both running.

---

## Setup

```bash
# Terminal 1 — web server (API)
cd apps/web
pnpm dev          # http://localhost:3000

# Terminal 2 — Metro bundler
cd apps/mobile
pnpm start        # port 8082 (pnpm ios / pnpm android point at it)

# Terminal 3 — simulator (iOS)
pnpm ios
# OR for Android emulator:
pnpm android
```

Make sure your `.env.local` in `apps/web` has:

- `DATABASE_URL` pointing to a local Postgres instance
- `NEXTAUTH_SECRET` set to any string
- `RESEND_API_KEY` (or leave empty — email sending will silently fail, which is fine for local testing)
- `TWILIO_*` (optional for SMS OTP tests)

To reset the database between test runs:

```bash
cd apps/web
pnpm prisma migrate reset   # drops and re-seeds
```

---

## How to check that your setup works first

```bash
# Should return {"data":{"status":"ok"},"error":null}
curl http://localhost:3000/api/v1/health

# Shared package check — shows in the Metro splash screen on first boot
# Look for: "shared: 10 cities · schema ok"
```

---

## Test 1 — E02-01: Onboarding

**Precondition:** Fresh install or cleared AsyncStorage (see "Reset" below).

1. Launch the app.
2. **Expect:** Three onboarding slides showing. Dots at the bottom track current slide.
3. Swipe left OR tap **Next** twice to advance through all three slides.
4. On slide 3, button label changes to **Get Started**.
5. Tap **Get Started**.
6. **Expect:** Navigate to Login screen.
7. Kill the app and relaunch.
8. **Expect:** Login screen shown directly — onboarding does NOT repeat.

**Reset onboarding** (to test it again without reinstalling):

```bash
# In React Native Debugger console or a screen component:
AsyncStorage.removeItem('onboardingSeen')
```

Or restart the app with the Metro cache cleared:

```bash
pnpm start --reset-cache
```

**Skip button:** On slides 1 or 2, tap **Skip** → lands on Login without completing all slides. Onboarding still marked seen.

---

## Test 2 — E02-05: Login (happy path)

**Precondition:** A verified player account exists in the DB.

Create one via the API directly (or via Test 3 below first, then come back):

```bash
# Quick seed via psql or a migration — see apps/web/prisma/seed.ts for examples
```

1. Navigate to the Login screen.
2. Enter a valid email + password.
3. Tap **Sign in**.
4. **Expect:** Spinner on button, then navigate to the Discover screen.
5. Open the Keychain / Keystore inspector (see below) to confirm tokens stored.

**iOS — inspect Keychain:**

```bash
# In Simulator: use the Keychain Viewer in Xcode → Window → Devices & Simulators
# Or via simctl:
xcrun simctl keychain booted dump | grep pitchup
```

**Android — inspect Keystore:**

```bash
adb shell run-as com.pitchup.mobile cat /data/data/com.pitchup.mobile/shared_prefs/...
# Keystore-backed entries are not readable directly; verify indirectly by restarting
# the app and confirming you land on Discover (checkSession succeeded).
```

---

## Test 3 — E02-05: Login (error paths)

| Scenario       | Input                         | Expected                           |
| -------------- | ----------------------------- | ---------------------------------- |
| Wrong password | Correct email, wrong password | "Incorrect email or password."     |
| Unknown email  | nonexistent@test.com          | "Incorrect email or password."     |
| Empty fields   | Submit with blank fields      | "Email and password are required." |
| Rate limited   | 5 failed logins quickly       | "Too many attempts…"               |

---

## Test 4 — E02-02 + E02-03: Registration (happy path)

1. On Login, tap **Sign up**.
2. **Step 1:** Fill in:
   - Name: `Test Player`
   - Email: a new unique email (e.g. `player+1@test.ro`)
   - Phone: `+40712345678`
   - City: tap picker → select any city → confirm selection shows in field
3. Tap **Continue** → lands on Step 2.
4. **Step 2:** Fill in:
   - Date of birth: `1995-06-15`
   - Password: `Parola123`
   - Confirm: `Parola123`
5. Tap **Create account**.
6. **Expect:** Navigate to **Verify Email** screen showing the email you entered.

---

## Test 5 — E02-02 + E02-03: Registration validation

**Step 1 errors:**

| Field | Bad input             | Expected error                             |
| ----- | --------------------- | ------------------------------------------ |
| Name  | `A` (1 char)          | "Full name must be at least 2 characters." |
| Email | `notanemail`          | "Enter a valid email address."             |
| Phone | `07123` (no + prefix) | "Enter a phone in E.164 format…"           |
| City  | Leave blank           | "Select your city."                        |

**Step 2 errors:**

| Field    | Bad input                   | Expected error                          |
| -------- | --------------------------- | --------------------------------------- |
| DOB      | `15-06-1995` (wrong format) | "Use the format YYYY-MM-DD…"            |
| DOB      | `2015-01-01` (under 16)     | "You must be at least 16 years old…"    |
| Password | `parola123` (no uppercase)  | "At least 8 characters, one uppercase…" |
| Confirm  | Different value             | "Passwords do not match."               |

**Duplicate phone:**

1. Register twice with the same phone number.
2. **Expect on second attempt:** "That phone number is already registered."

---

## Test 6 — E02-04: Email Verification

**Precondition:** Just completed registration (lands here automatically).

1. **Expect:** 6 empty digit boxes, email shown above.
2. Tap any box → keyboard appears (number pad).
3. Check the email inbox (or Resend logs in the terminal) for the 6-digit code.
4. Type the code — digits appear in boxes as you type.
5. Tap **Verify**.
6. **Expect:** Navigate to Login screen.
7. Log in with the new account → lands on Discover. ✓

**Resend flow:**

1. On Verify Email, tap **Resend**.
2. **Expect:** Button shows "Sending…" then a 60-second countdown appears.
3. A new code is sent; the old code is now invalid.
4. After 60 seconds, **Resend** becomes active again.

**Wrong code:**

1. Enter `000000`.
2. Tap **Verify**.
3. **Expect:** "That code is not correct or has expired." Boxes remain for retry.

**How to get the code without email configured:**

```bash
# Query the DB directly
cd apps/web && pnpm prisma studio
# Open EmailVerificationCode table → find the row for your email
```

Or watch the Next.js server logs — Resend in dev mode logs the email payload to the console if `RESEND_API_KEY` is missing.

---

## Test 7 — E02-06: Forgot Password

1. On Login, tap **Forgot password?**
2. Enter any email address, tap **Send reset link**.
3. **Expect:** Success screen with "Check your inbox" message — same message whether or not the email exists (intentional, prevents account enumeration).
4. If the email IS registered and Resend is configured: check inbox for reset link.
5. Tap **Back to login** → returns to Login.

**Rate limit:** Submit more than 5 times in 15 minutes → "Too many requests."

---

## Test 8 — E02-07: Social Login placeholder

1. On Login, tap **Continue with Google**.
2. **Expect:** "Google Sign-In — coming soon" placeholder screen.
3. Tap **← Back to login** → returns to Login.

---

## Test 9 — Session persistence (checkSession)

1. Log in successfully → land on Discover.
2. Kill the app (swipe away from recent apps).
3. Relaunch.
4. **Expect:** Spinner briefly, then the Discover screen again — no login required.
   This confirms tokens survived in the Keychain and `/me` validated them.

---

## Test 10 — Token refresh (interceptor)

This tests the refresh interceptor in `apiClient.ts`.

```bash
# In apps/web, find the access token TTL
grep -r "ACCESS_TOKEN_EXPIRY\|expiresIn\|signAccessToken" src/lib/auth/
```

1. Log in.
2. In `apps/web/src/lib/auth/tokens.ts` (or wherever `signAccessToken` is defined), temporarily reduce the access token lifetime to 5 seconds.
3. Restart the web server.
4. Log in on the mobile app.
5. Wait 6 seconds.
6. Trigger any authenticated action (e.g. navigate within the app or add a debug button that calls `/me`).
7. **Expect:** Action succeeds — the interceptor refreshed the token transparently.
8. Revert the lifetime change.

---

## Test 11 — Unauthorized signal (authEvents)

Simulates a revoked session (refresh token deleted from DB).

1. Log in on the mobile app.
2. In psql or Prisma Studio, delete the row from `RefreshToken` for the logged-in user.
3. Wait for the access token to expire (or reduce its TTL as in Test 10).
4. Trigger any authenticated action.
5. **Expect:** The refresh attempt fails → `authEvents.emitUnauthorized()` fires → `logout()` called → app navigates to Login screen automatically.

---

## Verification checklist

After running all tests, confirm:

- [ ] Onboarding shows once, never again after completion
- [ ] Login navigates to Discover on success, shows error on failure
- [ ] Registration step 1 validates all fields before advancing
- [ ] Registration step 2 validates DOB age, password policy, confirm match
- [ ] Successful registration navigates to Verify Email
- [ ] OTP entry auto-focuses keyboard, resend has 60s cooldown
- [ ] Correct OTP navigates to Login; wrong OTP shows inline error
- [ ] Forgot password shows same success message for known/unknown emails
- [ ] Social login shows placeholder screen (no crash)
- [ ] App restores session on relaunch without asking to log in again
- [ ] Expired/revoked session redirects to Login automatically
- [ ] No TypeScript errors (`pnpm typecheck` in `apps/mobile`)
- [ ] No lint errors (`pnpm lint` in `apps/mobile`)
