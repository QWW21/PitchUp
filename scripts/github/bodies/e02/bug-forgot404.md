## What happened

The web login form linked to `/forgot-password`, which did not exist — the link 404'd.

## Fix

Added the page in 5b835f5, with the same enumeration-safe behaviour as the API: identical success copy for known, unknown and errored addresses.

Note the flow is still incomplete — the reset email links to `/reset-password`, which does not exist yet. Tracked separately.
