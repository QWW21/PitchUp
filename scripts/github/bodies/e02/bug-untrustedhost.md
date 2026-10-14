Found while testing the web auth flows on a production build; fixed in e396f41.

**Symptom:** on `next build && next start`, every sign-in failed. `/api/auth/providers`, `/session` and `/csrf` returned 500 and the login form landed on `/login?error=Configuration` with no message. The navbar never showed a signed-in user either, because `auth()` failed the same way.

**Cause:** Auth.js v5 only trusts the request's Host header automatically in development and on Vercel. Everywhere else it throws `UntrustedHost` unless `trustHost` (or `AUTH_TRUST_HOST`) is set. All earlier testing used `next dev`, so it never showed.

**Fix:** `trustHost: true` in `src/auth.ts`, with a comment on why. `NEXTAUTH_URL` still pins the canonical URL where it is set.

**Impact had it shipped:** nobody could sign in on any non-Vercel deployment.
