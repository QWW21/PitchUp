Implemented in e867add — `apps/web/src/app/api/v1/companies/[id]/route.ts`, logic in `apps/web/src/lib/venues/company.ts` (shared with the server-rendered web page).

**Verified** by `scripts/verify-e04.ts` against a running server: 200 with full data, no auth; pending/suspended/unknown → 404; active pitches only, sorted by name; `coverPhotoUrl` is the order-0 photo, `null` without photos; `avgRating` null below 3 reviews and with none; a PENDING review drops out of the aggregate; a company with no active pitches → `pitches: []`; ~9ms warm (three queries, no N+1).

**Deviations:**

- **`workingHours` is an array of seven `{ day, openTime, closeTime, isClosed }`**, Sunday first — the stored `WorkingHoursSchema` shape, normalised so missing days are explicit closed entries — not the `{ "0": { closed: true } }` object in the ticket.
- **Company rating = mean of its pitches' means** (PRD §11.2), via a shared `ratings.ts` that the Discover list now uses too.
- **Added `isOpenNow`**, and `phone` is `null` when blank so clients can hide the row.
