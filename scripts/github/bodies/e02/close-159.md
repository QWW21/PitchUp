**The fix in 5ac82c3 was incomplete; the real one is e396f41.**

Reproduced on the current code: wrong password → button stuck on "Signing in…" at `/login?callbackUrl=%2Fdashboard`.

**Cause:** next-auth 5.0.0-beta.32 does not throw on bad credentials. Auth.js answers with HTTP 200 and the reason in the redirect URL, and `next-auth/react`'s `signIn()` returns `{ ok: true, error: 'CredentialsSignin' }`. The form treated `ok` as success, pushed `/dashboard`, the middleware bounced it back to `/login`, and the still-mounted form never cleared `loading`. The try/catch added in 5ac82c3 waits for an exception that never comes.

**Fix:** success requires `result.ok && !result.error`. The catch now handles what actually throws — a failed request — with a connection message instead of "Incorrect email or password".

**Verified:** wrong password and unknown email both show "Incorrect email or password." and the button resets; correct credentials still reach `/dashboard`.
