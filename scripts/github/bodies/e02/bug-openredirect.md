Found while testing the web login; fixed in e396f41.

**Symptom:** `/login?callbackUrl=//example.com` — after a successful sign-in the browser went to `https://example.com`. A phishing link could show the genuine PitchUp login and then hand the signed-in user to a look-alike site.

**Cause:** the form accepted any `callbackUrl` that `startsWith('/')`. `//host` is a protocol-relative URL to another origin, and browsers also read `/\host` as `//host`.

**Fix:** `safeCallbackPath()` in `LoginForm.tsx` resolves the value against the current origin and only keeps it if the origin is unchanged; anything else falls back to `/dashboard`.

**Verified:** `//example.com` now lands on `/dashboard`; a real path such as `/discover?city=Iași` still works.
