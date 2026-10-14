## What happened

NextAuth v5 throws `CallbackRouteError` on bad credentials rather than returning `{ ok: false }` as v4 did. The call was not wrapped, so the thrown error made `setLoading(false)` unreachable: signing in with an unknown account or a wrong password left the button spinning forever with no error shown.

## Fix

Wrapped `signIn()` in try/catch so the error state is always set and loading always clears.

Fixed in 5ac82c3.
