Found while reviewing the web auth forms; fixed in e396f41.

**Symptom:** if the request itself failed (dropped connection, server down), the registration, email-verification and resend buttons stayed on their spinner for good. The login form, in the same situation, said "Incorrect email or password".

**Cause:** `fetch()` rejects on a network failure instead of returning a response, and those handlers had no try/catch, so `setLoading(false)` was never reached. The forgot-password form already handled it.

**Fix:** each form catches the failed request, shows "Could not connect. Check your connection and try again." and resets its button.
