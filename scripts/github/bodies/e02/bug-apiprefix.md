## What happened

Every path in `apps/mobile/src/lib/authApi.ts` carried an `/api/v1` prefix that the base URL in `config.ts` already included, so every request went to `/api/v1/api/v1/…` and 404'd. No mobile API call worked.

## Fix

Dropped the redundant prefix from all paths.

Fixed in 7e5e894, during the E02-01…07 screen work.
