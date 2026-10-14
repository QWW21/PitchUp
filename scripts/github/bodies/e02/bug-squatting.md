## What happened

Registration created a user before anyone proved they owned the address, so an attacker could register `victim@…` first and hold it permanently. The real owner would then get the "you already have an account" notice for an account they never created, with no way to take it over.

## Fix

An unverified record is now replaced by a later registration: whoever can read the inbox gets the account. Verified end to end, including that the attacker's password stops working.

Fixed in 38603d7. Found by reviewing E02-08 (#18).
