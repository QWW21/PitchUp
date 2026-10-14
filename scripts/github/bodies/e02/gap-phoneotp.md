Split out of E02-04 (#14), which delivered the email verification screen instead.

`POST /auth/verify-phone` was added in E02-08 and nothing on mobile calls it, so `phoneVerified` cannot become true from the app. Registration already sends the SMS OTP.

The screen is largely a copy of `VerifyEmailScreen.tsx` pointed at the other endpoint:

- masked number in the subheading (country code + first 3 + XXX + last 3), per the original ticket
- reuse the existing `OtpInput` component
- call `verifyPhone()` and `resendCode(phone, 'PHONE')`
- decide where it sits in the flow — after email verification, or deferred to profile

Blocked on nothing; Twilio logs to console without credentials, so it is testable now.
