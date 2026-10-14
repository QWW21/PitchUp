## What happened

Phone OTPs and email verification codes shared one table with no channel marker, so a code delivered by SMS could be used to verify an email address, and vice versa.

## Fix

`VerificationCode` now carries a channel, and each verification endpoint is scoped to its own.

Fixed in 38603d7. Found by reviewing E02-08 (#18).
