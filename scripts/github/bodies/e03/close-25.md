Implemented in d276ee4.

**Built:**

- `apps/web/src/app/api/v1/companies/route.ts` — public `GET /api/v1/companies`. Repeated keys (`surface=A&surface=B`) are collected before validation; `validateQuery()` keeps only the last value of a repeated key.
- `apps/web/src/lib/discover/companies.ts` — the query. Four database queries per request whatever the result size: companies with their active pitches, one grouped review query for every company's ratings, and (only with `availableNow`) one query for free pitches.
- `apps/web/src/lib/discover/opening-hours.ts` — `isOpenAt()`, evaluated in Europe/Bucharest so a server running in UTC is not off by two or three hours. Handles overnight hours (`18:00`–`02:00`) and round-the-clock (`00:00`–`00:00`). Missing or malformed hours count as closed.
- `packages/shared/src/schemas/discover.ts` — `CompanyListQuerySchema`, `CompanyListItem`, `CompanyListPage`, shared with both clients.

**Verified:** `scripts/verify-e03.ts` re-runs every acceptance criterion against a running server — 45 checks, all passing, including the edge cases (empty city, no active pitches, distance sort without coordinates) and response time (~40ms warm for 13 companies). Prisma query log confirms no N+1.

**Deviations:**

- **`avgRating` is `null` below three reviews** (PRD §11.2), so a rating that must not be shown never leaves the server. `reviewCount` is still returned.
- **Company rating is the mean of its pitches' means**, per PRD §11.2, not the mean of all reviews pooled.
- **Amenities:** OR within a free/paid pair, AND across amenities, all on the same pitch. The ticket's single `amenityType: { in }` would make Showers + Parking mean "either".
- **`availableNow`** = open now and a matching pitch with no PENDING/CONFIRMED booking overlapping the next two hours. No five-minute cache: it is one indexed query.
- **Sort and pagination are in memory** over the whole filtered city, because three of the four sort keys are derived. The cursor is still the last company's id. Fine for v1.0 volumes; denormalise rating/price onto `Company` and move distance to PostGIS before it is not.
- **Extra validation:** unknown city, `lat` without `lng`, `priceMin > priceMax`, `limit > 50` and an unknown cursor are all `400 VALIDATION_ERROR`. The message is the first problem ("City is required"); every problem is in `details`.
- **Response adds `lat`/`lng`**, which the map views need.
- **Documentation** is the JSDoc on the route plus the shared types, not a separate `API.md`.
