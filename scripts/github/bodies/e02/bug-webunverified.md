Found while testing the web login; fixed in e396f41.

**Symptom:** signing in on the web with the right password for an unverified account showed "Incorrect email or password" and the hint "we have sent a new code" — but no code was sent, and the server logged an error with a stack trace.

**Cause:** the NextAuth `authorize()` threw a plain `EmailNotVerifiedError`, which Auth.js turns into a configuration error. It never called the code-sending path. The mobile login (`loginWithPassword`) had always done this correctly.

**Fix:** `authorize()` now matches mobile: re-send the email code (a throttled or failed send does not change the answer) and fail exactly like a wrong password, so the response still reveals nothing about which addresses have accounts. `EmailNotVerifiedError` is removed.

**Verified:** login with a freshly registered, unverified account shows the usual message, the button resets, and a new code is issued.
