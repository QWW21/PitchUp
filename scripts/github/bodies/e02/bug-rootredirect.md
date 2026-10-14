## What happened

`/` rendered a placeholder page instead of routing anyone anywhere.

## Fix

`/` now redirects to `/dashboard` when signed in and `/login` otherwise. Fixed in b30df45.
