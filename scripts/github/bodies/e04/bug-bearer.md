Found while wiring E04's mobile screens to `/me`; fixed in e867add.

**Symptom:** every authenticated API call from the mobile app returned 401. On launch, `authStore.checkSession()` calls `/me`, gets 401, clears the stored tokens and shows Login — so a signed-in user was signed out every time the app started. Nothing had caught it because the app had not been run against the API end to end.

**Cause:** `requireAuth` (`apps/web/src/lib/api/middleware.ts`) only called NextAuth's `auth()`, which reads the web session cookie. The mobile access token issued by `/auth/mobile/login` was never checked: `verifyAccessToken` and `bearerFromHeader` in `lib/auth/tokens.ts` existed but nothing called them.

**Fix:** a request carrying `Authorization` is judged on that Bearer token alone — verified, then the user re-read so a deleted account's unexpired token stops working — and turned into the same `Session` shape the cookie gives. Requests without it use the cookie as before. Applies to every `requireAuth`/`requireRole` route.

**Verified:** token from `/auth/mobile/login` → `/me` 200 (now including `trustScore`); a bad token → 401; no auth → 401; the web cookie path still returns 200.
