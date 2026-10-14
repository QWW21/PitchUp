Implemented in e867add — `apps/web/src/app/api/v1/pitches/[id]/availability/route.ts`, logic in `apps/web/src/lib/venues/availability.ts`, time helpers in `packages/shared/src/schedule.ts`. `PitchException` added to the schema as specified (`pnpm db:push`).

**Verified** by `scripts/verify-e04.ts`: missing, malformed and impossible dates (`2026-02-31`) → 400; past date and beyond `advanceBookingDays` → 400 with the ticket's messages; 08:00–23:00 → 30 slots, 22:30 last; an 18:00–20:00 booking marks 18:00–19:30 and leaves 20:00 free; a CANCELLED booking does not block; a fully booked day; an exception date and a closed weekday → `isClosed`; `Cache-Control: public, max-age=60`.

**Deviations:**

- **Slots are in venue time.** The ticket's sample builds slot instants as `${date}T08:00:00Z` — that is 10:00 or 11:00 in Bucharest, so every slot would be off by the zone offset. Slots are Bucharest wall-clock times, converted with `venueTimeToUtc` (DST-safe) for the overlap test; "today" and "past" are the venue's today.
- **Bookings are fetched by overlap with the day** (`startTime < dayEnd && endTime > dayStart`), not `startTime >= dayStart && endTime <= dayEnd`, which misses a booking that started the evening before.
- **Overnight hours** (16:00–02:00) give a date two intervals: 00:00–02:00 from the previous evening, and 16:00–24:00 (bookings never span midnight). Round-the-clock venues get 48 slots.
- **A `past` status** for slots earlier today; otherwise they read as available. `openTime`/`closeTime` are the first and last slot boundaries (`24:00` written as such).
- **An inactive pitch** returns `isClosed: true`.
