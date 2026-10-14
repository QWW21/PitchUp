Fixed in the commit that closes this.

- `User.passwordChangedAt` (nullable) added to the schema — run `pnpm db:push`.
- `resetPassword()` stamps it in the same transaction that changes the hash and revokes the mobile refresh tokens.
- The NextAuth `jwt` callback records the sign-in time in ms (`token.authAt`; the JWT's own `iat` is whole seconds and would reject a sign-in made in the same second as a reset). On every later read it loads the user by id and returns `null` — which signs the browser out — if the password changed after that time, or if the user no longer exists or is soft-deleted.

**Verified in a browser on a production build:** signed in, completed a reset from outside that session, the session endpoint then returned no user and `/dashboard` redirected to login; a fresh sign-in with the new password stayed signed in across reloads.

Cost: one primary-key lookup per session read.
