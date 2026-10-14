Implemented in e867add — `apps/web/src/app/api/v1/pitches/[id]/route.ts`, logic in `apps/web/src/lib/venues/pitch.ts`.

**Verified** by `scripts/verify-e04.ts`: photos ascending by `order`, and swapping two photos' order in the DB reorders the response; every configured amenity returned; shirt inventory with `hasShirts`, `[]` without; peak windows parsed; `recentReviews` ≤ 3, approved only, newest first; anonymous review → "Anonymous player" with no avatar; rating-only review → `text: null`; `avgRating` null below 3; inactive pitch still returned with `isBookable: false`; pitch of a pending company → 404.

**Deviations:**

- **No per-pitch `availabilitySchedule`** — the schema has none. The pitch is bookable during its company's hours, returned as `workingHours` (seven entries, same shape as `GET /companies/:id`).
- **Reviewer names are "First L."** (e.g. "Demo P."), never the full name.
- **Added `isBookable`** (active pitch of an approved company) so clients do not re-derive it.
