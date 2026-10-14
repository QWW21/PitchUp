Partially implemented in 7e5e894 as `ForgotPasswordScreen.tsx`.

**Built — the request half.** Email entry, and a single success state shown for every outcome: registered, unknown, or errored. That mirrors the API, which deliberately answers identically in all three cases so the screen cannot be used to test whether an address has an account.

**Not built — the reset half.** The ticket covers "forgot password **and reset password**". There is no screen that takes the emailed token and sets a new one, and `authApi.resetPassword()` exists but nothing on mobile calls it. The flow currently dead-ends: the user gets an email and has nowhere in the app to go.

This is the same gap as on web, where the reset email links to `/reset-password` and that page does not exist either. Both are tracked separately.
