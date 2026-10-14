## What happened

A verification code expiring left the account permanently unreachable: login refuses an unverified account, and nothing else issued a new code.

## Fix

Added `POST /auth/resend-code`. It answers identically for unknown, already-verified and sent addresses, and is limited to 3 per 15 minutes — each call spends a real email or SMS, so an unlimited one is a spam cannon aimed at a third party and, for SMS, someone else's bill.

Fixed in 38603d7. Found by reviewing E02-08 (#18).
