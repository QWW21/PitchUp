## What happened

The registration rate limit was charged before validation ran, so three malformed request bodies locked registration for an hour — for every user behind that IP. An office, a campus, or carrier NAT would be locked out by one broken client.

## Fix

Validation now runs before the limiter is charged. Verified four junk requests no longer block a real signup.

Fixed in 38603d7. Found by reviewing E02-08 (#18).
