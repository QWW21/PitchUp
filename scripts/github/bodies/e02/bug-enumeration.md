## What happened

Registering an address and then signing in with the password just chosen returned `EMAIL_NOT_VERIFIED` when the address was free and `INVALID_CREDENTIALS` when it was already taken. Two requests were enough to test whether any address had an account — the same user-enumeration leak that PRD §6.6 closes on the login path, and that the register endpoint deliberately avoids by answering 201 either way.

## Impact

Full email enumeration against the whole user base.

## Fix

Login now returns `INVALID_CREDENTIALS` for an unverified account and re-sends the verification code, so whoever holds the real password gets what they need in their inbox and a prober learns nothing. Verified both paths return identical bytes.

Fixed in 38603d7. Found by reviewing E02-08 (#18).
