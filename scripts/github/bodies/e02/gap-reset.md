Split out of E02-06 (#16) on mobile and noted on web.

The forgot-password request works on both platforms and the reset email sends. Neither platform has anywhere to land:

- **Web:** the email links to `/reset-password`, which does not exist. Both API routes (`/api/v1/auth/forgot-password`, `/api/v1/auth/reset-password`) are built.
- **Mobile:** `authApi.resetPassword()` exists and nothing calls it. No screen takes the token.

So password reset is currently unusable end to end on either platform, despite every other piece being in place. Needs the web page, the mobile screen, and a decision on how the emailed link reaches the app (deep link, or paste the token).
