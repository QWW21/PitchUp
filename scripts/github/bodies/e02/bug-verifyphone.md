## What happened

Registration sent a phone OTP but no endpoint consumed it, so `phoneVerified` could never become true for any user.

## Fix

Added `POST /auth/verify-phone`, scoped to the `PHONE` channel.

Note the mobile client still does not call this — see the phone OTP screen issue. The backend half is done.

Fixed in 38603d7. Found by reviewing E02-08 (#18).
