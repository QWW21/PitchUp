Partially implemented in 7e5e894.

**Built:** `VerifyEmailScreen.tsx` plus an `OtpInput` component — six digit boxes backed by a single hidden `TextInput`, auto-advance, a wrong-code error state, and a Resend link with a 60-second cooldown that mirrors the server's per-recipient throttle. It calls `verifyEmail()` and `resendCode(email, 'EMAIL')`.

**But this ticket is about phone, not email.** The ticket asks for `PhoneOTPScreen.tsx` verifying a masked `+40 7XX XXX XXX` number against the SMS OTP. What was built verifies the _email_ code. The backend endpoint the ticket depends on, `POST /auth/verify-phone`, was added in E02-08 and nothing on mobile calls it, so `phoneVerified` still cannot become true from the app.

Closing because the OTP screen and its reusable input component exist and work against the email channel. The phone channel is tracked as a separate issue — the screen is largely a copy of this one pointed at the other endpoint.
