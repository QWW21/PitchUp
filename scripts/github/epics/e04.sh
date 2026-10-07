#!/usr/bin/env bash
# e04.sh — create all E04 Player: Pitch Detail issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E04 — Player: Pitch Detail")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E04 — Player: Pitch Detail' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E04 — Player: Pitch Detail)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E04-01 — Backend: GET /companies/:id
# ─────────────────────────────────────────────────────────────────────────────
title="[E04-01] [Backend] GET /companies/:id — company detail with pitches and reviews aggregate"
read -r -d '' body << 'BODY' || true
## Summary
Implement `GET /api/v1/companies/:id` returning full company detail: all metadata, working hours, active pitches (with summary data), aggregate rating, and review count. Public endpoint — no auth required.

## Reference
- PRD §7.3 (Company Detail), §14 (API Surface)
- UIUX_SPEC §6.1

## File to create
`apps/web/src/app/api/v1/companies/[id]/route.ts`

## Response shape
```json
{
  "data": {
    "id": "clxyz...",
    "name": "Demo Sports Club",
    "description": "Best sports complex in Cluj.",
    "logoUrl": "https://res.cloudinary.com/...",
    "websiteUrl": "https://demo.ro",
    "phone": "+40712345678",
    "email": "contact@demo.ro",
    "addressLine1": "Str. Sportului 1",
    "addressLine2": null,
    "city": "Cluj-Napoca",
    "country": "Romania",
    "postalCode": "400001",
    "lat": 46.77,
    "lng": 23.59,
    "workingHours": {
      "0": { "closed": true },
      "1": { "open": "08:00", "close": "23:00" },
      "2": { "open": "08:00", "close": "23:00" },
      "3": { "open": "08:00", "close": "23:00" },
      "4": { "open": "08:00", "close": "23:00" },
      "5": { "open": "08:00", "close": "23:00" },
      "6": { "open": "08:00", "close": "22:00" }
    },
    "isVerified": true,
    "avgRating": 4.3,
    "reviewCount": 127,
    "pitches": [
      {
        "id": "...",
        "name": "Pitch A",
        "surfaceType": "ARTIFICIAL_GRASS",
        "size": "FIVE_A_SIDE",
        "offPeakRate": 60,
        "peakRate": 80,
        "coverPhotoUrl": "https://...",
        "avgRating": 4.5,
        "reviewCount": 43,
        "isActive": true
      }
    ]
  },
  "error": null
}
```

## Implementation

```typescript
// GET /api/v1/companies/[id]/route.ts
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const company = await prisma.company.findUnique({
    where: { id: params.id, status: 'ACTIVE' },
    include: {
      pitches: {
        where: { isActive: true },
        include: {
          photos: { where: { order: 0 }, take: 1 },  // cover photo only
          _count: { select: { reviews: true } },
        },
        orderBy: { name: 'asc' },
      },
    },
  })

  if (!company) return err('NOT_FOUND', 'Company not found', 404)

  // Compute avgRating per pitch and for company overall
  // For v1.0: raw query or separate aggregation query
  const ratings = await prisma.review.groupBy({
    by: ['pitchId'],
    where: { pitch: { companyId: params.id }, moderationStatus: 'APPROVED' },
    _avg: { rating: true },
    _count: { rating: true },
  })

  // Shape response
  const ratingMap = Object.fromEntries(ratings.map(r => [r.pitchId, r]))
  const pitches = company.pitches.map(p => ({
    id: p.id,
    name: p.name,
    surfaceType: p.surfaceType,
    size: p.size,
    offPeakRate: p.offPeakRate,
    peakRate: p.peakRate,
    coverPhotoUrl: p.photos[0]?.url ?? null,
    avgRating: ratingMap[p.id]?._avg.rating ?? null,
    reviewCount: ratingMap[p.id]?._count.rating ?? 0,
    isActive: p.isActive,
  }))

  const allRatings = ratings.map(r => r._avg.rating).filter(Boolean) as number[]
  const avgRating = allRatings.length
    ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
    : null

  return ok({ ...company, pitches, avgRating, reviewCount: ratings.reduce((s, r) => s + r._count.rating, 0) })
}
```

## Acceptance Criteria
- [ ] `GET /companies/:id` with valid active company ID returns 200 with full data
- [ ] `GET /companies/:id` for non-existent or suspended company returns 404
- [ ] `pitches` array contains only `isActive: true` pitches
- [ ] `coverPhotoUrl` is `null` when pitch has no photos (not an error)
- [ ] `avgRating` is `null` when company has < 3 total reviews (PRD §11.2)
- [ ] `workingHours` JSON correct (keys 0–6, Sunday=0)
- [ ] No auth required — public endpoint
- [ ] Response time < 100ms (no N+1 — single query + one aggregate)

## Edge cases
- Company with 0 active pitches: `pitches: []` — valid response (company recently deactivated all pitches)
- Review with `moderationStatus: 'PENDING'` or `'REMOVED'`: excluded from rating aggregate
- No reviews at all: `avgRating: null`, `reviewCount: 0`

## Definition of done
- [ ] Tested with Postman (valid ID, invalid ID, suspended company)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-pitch-detail","priority: critical","type: backend"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E04-02 — Backend: GET /pitches/:id
# ─────────────────────────────────────────────────────────────────────────────
title="[E04-02] [Backend] GET /pitches/:id — full pitch detail: photos, amenities, pricing, shirt inventory, reviews preview"
read -r -d '' body << 'BODY' || true
## Summary
Implement `GET /api/v1/pitches/:id` returning complete pitch data: all photos (ordered), all amenities, pricing config, peak hours definition, shirt inventory, 3 most recent approved reviews, and parent company summary. Public endpoint.

## Reference
- PRD §7.4 (Pitch Detail), §14
- UIUX_SPEC §6.2

## File to create
`apps/web/src/app/api/v1/pitches/[id]/route.ts`

## Response shape
```json
{
  "data": {
    "id": "...",
    "name": "Pitch A",
    "description": "A great 5-a-side pitch with all amenities.",
    "surfaceType": "ARTIFICIAL_GRASS",
    "size": "FIVE_A_SIDE",
    "widthMeters": 25,
    "lengthMeters": 45,
    "isActive": true,
    "offPeakRate": 60,
    "peakRate": 80,
    "peakHoursDefinition": [
      { "days": [1,2,3,4,5], "startTime": "17:00", "endTime": "23:00" },
      { "days": [0,6], "startTime": "07:00", "endTime": "23:00" }
    ],
    "minBookingHours": 1,
    "maxBookingHours": 4,
    "advanceBookingDays": 60,
    "hasShirts": true,
    "shirtRentalPrice": 10,
    "photos": [
      { "id": "...", "url": "https://...", "order": 0 },
      { "id": "...", "url": "https://...", "order": 1 }
    ],
    "amenities": [
      { "amenityType": "SHOWERS_FREE", "isPaid": false, "price": null },
      { "amenityType": "PARKING_FREE", "isPaid": false, "price": null },
      { "amenityType": "NIGHT_LIGHTING", "isPaid": false, "price": null }
    ],
    "shirtInventory": [
      { "colour": "RED",  "quantity": 14 },
      { "colour": "BLUE", "quantity": 12 }
    ],
    "avgRating": 4.5,
    "reviewCount": 43,
    "recentReviews": [
      {
        "id": "...",
        "rating": 5,
        "text": "Excellent pitch, great surface.",
        "isAnonymous": false,
        "playerName": "Alexandru D.",
        "playerAvatarUrl": "https://...",
        "photoUrls": [],
        "managerReply": null,
        "createdAt": "2026-10-01T14:32:00Z"
      }
    ],
    "company": {
      "id": "...",
      "name": "Demo Sports Club",
      "logoUrl": "https://...",
      "isVerified": true
    },
    "availabilitySchedule": {
      "0": { "closed": true },
      "1": { "open": "08:00", "close": "23:00" }
    }
  },
  "error": null
}
```

## Implementation details

### Photos — must be ordered
```typescript
photos: {
  orderBy: { order: 'asc' },  // cover photo (order: 0) first
}
```

### Reviews — 3 most recent approved only
```typescript
reviews: {
  where: { moderationStatus: 'APPROVED' },
  orderBy: { createdAt: 'desc' },
  take: 3,
  include: {
    player: { select: { name: true, profilePhotoUrl: true } },
  },
}
```
Player name: if `review.isAnonymous` → return `"Anonymous player"`, `playerAvatarUrl: null`.

### Rating aggregate
```typescript
const agg = await prisma.review.aggregate({
  where: { pitchId: params.id, moderationStatus: 'APPROVED' },
  _avg: { rating: true },
  _count: { rating: true },
})
const avgRating = agg._count.rating >= 3
  ? Math.round((agg._avg.rating ?? 0) * 10) / 10
  : null  // PRD §11.2: hide until 3+ reviews
```

### `availabilitySchedule`
The pitch has its own weekly schedule (separate from company working hours). Return it as a JSON object with day keys 0–6. Used by the availability preview grid and booking flow date picker.

## Acceptance Criteria
- [ ] Photos returned in `order` ascending (index 0 = cover)
- [ ] Amenities: all configured amenity types for this pitch returned
- [ ] Shirt inventory: all configured colours + quantities
- [ ] `recentReviews`: max 3, approved only, newest first
- [ ] Anonymous reviews: `playerName: "Anonymous player"`, `playerAvatarUrl: null`
- [ ] `avgRating: null` when `reviewCount < 3`
- [ ] Inactive pitch (`isActive: false`) still returned (player may have direct link) — but `Book Now` disabled on client
- [ ] Pitch belonging to suspended company: return 404
- [ ] No auth required

## Edge cases
- Pitch with 0 photos: `photos: []` (not an error)
- Pitch with `hasShirts: false`: `shirtInventory: []`
- `peakHoursDefinition` as empty array: all hours off-peak
- Review text with only a rating (no text): `text: null` in response

## Definition of done
- [ ] All fields populated correctly for a seeded dev pitch
- [ ] Photo order tested (swap order in DB → verify response reflects swap)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-pitch-detail","priority: critical","type: backend"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E04-03 — Backend: GET /pitches/:id/availability
# ─────────────────────────────────────────────────────────────────────────────
title="[E04-03] [Backend] GET /pitches/:id/availability?date= — slot availability grid for a date"
read -r -d '' body << 'BODY' || true
## Summary
Implement `GET /api/v1/pitches/:id/availability?date=YYYY-MM-DD` returning a 30-minute slot grid for the given date. Each slot is either `available`, `booked`, or `closed` (outside working hours or exception date). Used by the Pitch Detail availability preview AND the Booking Flow Step 2 time picker.

## Reference
- PRD §7.4 (Availability preview), §7.5 (Step 2 — Select Time Interval), §15 (Edge cases: booking conflicts)

## File to create
`apps/web/src/app/api/v1/pitches/[id]/availability/route.ts`

## Query parameters
| Param | Required | Notes |
|---|---|---|
| `date` | yes | ISO date `YYYY-MM-DD`, e.g. `2026-10-14`. Must not be in past. |

## Response shape
```json
{
  "data": {
    "date": "2026-10-14",
    "pitchId": "...",
    "openTime": "08:00",
    "closeTime": "23:00",
    "isClosed": false,
    "slots": [
      { "time": "08:00", "status": "available" },
      { "time": "08:30", "status": "available" },
      { "time": "09:00", "status": "booked" },
      { "time": "09:30", "status": "booked" },
      { "time": "10:00", "status": "available" }
    ]
  },
  "error": null
}
```

`isClosed: true` when date is an exception date or day is closed in schedule. In that case `slots: []`.

## Slot generation algorithm

```typescript
function generateSlots(
  date: string,
  openTime: string,
  closeTime: string,
  bookings: Array<{ startTime: Date; endTime: Date }>
): Slot[] {
  const slots: Slot[] = []
  const [openH, openM] = openTime.split(':').map(Number)
  const [closeH, closeM] = closeTime.split(':').map(Number)
  let current = openH * 60 + openM
  const end = closeH * 60 + closeM

  while (current < end) {
    const h = Math.floor(current / 60).toString().padStart(2, '0')
    const m = (current % 60).toString().padStart(2, '0')
    const slotStart = new Date(`${date}T${h}:${m}:00Z`)
    const slotEnd   = new Date(slotStart.getTime() + 30 * 60 * 1000)

    // Booked if any booking overlaps this 30-min window
    const isBooked = bookings.some(b =>
      b.startTime < slotEnd && b.endTime > slotStart
    )
    slots.push({ time: `${h}:${m}`, status: isBooked ? 'booked' : 'available' })
    current += 30
  }
  return slots
}
```

## Booking query (for a specific pitch + date)
```typescript
const dayStart = new Date(`${date}T00:00:00Z`)
const dayEnd   = new Date(`${date}T23:59:59Z`)

const bookings = await prisma.booking.findMany({
  where: {
    pitchId: params.id,
    status: { in: ['PENDING', 'CONFIRMED'] },
    startTime: { gte: dayStart },
    endTime:   { lte: dayEnd },
  },
  select: { startTime: true, endTime: true },
})
```

## Schedule & exception check
```typescript
// 1. Check pitch availability schedule
const dayOfWeek = new Date(date).getDay()  // 0 = Sunday
const schedule = pitch.availabilitySchedule as Record<string, { open: string; close: string } | { closed: boolean }>
const daySchedule = schedule[dayOfWeek.toString()]
if (!daySchedule || 'closed' in daySchedule) return closedResponse()

// 2. Check exception dates
const exception = await prisma.pitchException.findFirst({
  where: { pitchId: params.id, date: new Date(date) }
})
if (exception) return closedResponse()

const { open: openTime, close: closeTime } = daySchedule
```

**Note:** `PitchException` model needed — add to Prisma schema:
```prisma
model PitchException {
  id      String   @id @default(cuid())
  pitchId String
  date    DateTime @db.Date
  reason  String?
  pitch   Pitch    @relation(fields: [pitchId], references: [id], onDelete: Cascade)
  @@unique([pitchId, date])
}
```

## Validation
- `date` missing → 400 `VALIDATION_ERROR`
- `date` in the past → 400 `VALIDATION_ERROR` "Cannot check availability for past dates"
- `date` more than `pitch.advanceBookingDays` in future → 400 "Date beyond advance booking limit"
- Invalid date format (not `YYYY-MM-DD`) → 400

## Caching
Response can be cached for 60 seconds (availability changes when bookings are made):
```typescript
return ok(data, { 'Cache-Control': 'public, max-age=60' })
```

## Acceptance Criteria
- [ ] Returns correct slot grid for a date with no bookings (all `available`)
- [ ] Returns `booked` for 30-min windows overlapping a confirmed booking
- [ ] `CANCELLED` and `NO_SHOW` bookings do NOT mark slots as booked
- [ ] Closed day in schedule → `isClosed: true`, `slots: []`
- [ ] Exception date → `isClosed: true`
- [ ] Past date → 400 error
- [ ] Date beyond `advanceBookingDays` → 400 error
- [ ] Slots generated at 30-min intervals from `openTime` to `closeTime` (not including `closeTime` itself)
- [ ] Booking that ends at 10:00 does NOT mark the 10:00 slot as booked
- [ ] No auth required

## Concurrent booking edge case
This endpoint is read-only. Concurrency control (two users booking same slot simultaneously) is handled in the booking creation endpoint (E05) via DB transaction + conflict check.

## Definition of done
- [ ] Tested: date with bookings, date without bookings, closed day, exception date
- [ ] Slot boundaries verified (no off-by-one on booked window edges)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-pitch-detail","priority: critical","type: backend"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E04-04 — Mobile: Company Detail screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E04-04] [Mobile] Company Detail screen — hero, animated header, Pitches/Reviews tabs, working hours accordion"
read -r -d '' body << 'BODY' || true
## Summary
Build the Company Detail screen: parallax/transparent header that transitions to white on scroll, hero section with company info, sticky Pitches | Reviews tab bar, and the Pitches tab content (pitch cards). Reviews tab is handled in E04-07.

## Reference
- UIUX_SPEC §6.1
- PRD §7.3

## Files to create
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/discover/CompanyDetailScreen.tsx` | Main screen |
| `apps/mobile/src/components/company/CompanyHero.tsx` | Hero section |
| `apps/mobile/src/components/company/WorkingHoursAccordion.tsx` | Expandable hours |
| `apps/mobile/src/components/company/PitchListCard.tsx` | Pitch card in company pitch list |
| `apps/mobile/src/hooks/useCompany.ts` | TanStack Query hook for company detail |

## Navigation
- Route: `CompanyDetail` with param `{ id: string }`
- Stack push from CompanyCard tap (Discover list or map)

## Animated header (UIUX_SPEC §6.1)

### Scroll-driven transparency
Use `Animated.ScrollView` + `onScroll` to drive header opacity:
```typescript
const scrollY = useRef(new Animated.Value(0)).current
const headerBg = scrollY.interpolate({
  inputRange: [0, HERO_HEIGHT * 0.5],
  outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,1)'],
  extrapolate: 'clamp',
})
const headerShadow = scrollY.interpolate({
  inputRange: [HERO_HEIGHT * 0.4, HERO_HEIGHT * 0.5],
  outputRange: [0, 1],
  extrapolate: 'clamp',
})
```

### Back button (top-left)
- When over hero image: white circle bg `rgba(255,255,255,0.9)`, 36px circle, `shadow-sm`
- When header white: transparent bg, `#111827` icon
- `chevron-left` icon 24px, 44×44px tap target, 16px from left
- `useNavigation().goBack()`

### Share button (top-right)
- Same style as back button
- `share-variant` icon 24px
- `Platform.OS === 'ios' ? Share.share({ url }) : Share.share({ message: url })`
- URL: `https://pitchup.ro/discover/${companyId}`

### Title in header
- Hidden when scroll < 50px, visible (fade in) when scroll ≥ 100px
- Company name: `heading-sm` (16px/600), `#111827`, centered
- `opacity` animated via `scrollY.interpolate({ inputRange: [50, 100], outputRange: [0, 1] })`

## Hero section

### Layout (below navigation header space)
- Company logo: 80×80px, `radius-md` (12px), white bg, `shadow-sm`
  - Left-aligned, 16px left margin, 16px top margin below status bar
- Company name: `heading-xl` (24px/700), `#111827`, 8px below logo
- Verified badge (if `isVerified`): `check-decagram` icon 18px `#16A34A` + "Verified" `label-sm` `#16A34A`, inline after name, 4px gap
- Address row: `map-marker` icon 16px `#9CA3AF` + address text `body-md` `#6B7280`, 8px top
  - Tappable → `Linking.openURL('https://maps.google.com/?q=${lat},${lng}')`
- Phone row: `phone` icon 16px `#16A34A` + phone number `body-md` `#16A34A`, 4px top
  - Tappable → `Linking.openURL('tel:${phone}')`
- Rating row: 5 stars (filled/empty, `#FBBF24`, 14px) + "4.3" `body-sm` bold + "(127 reviews)" `body-sm` `#9CA3AF`, 8px top

### Working hours (WorkingHoursAccordion)
- Row: `clock-outline` 16px `#9CA3AF` + today's status text + expand chevron
- Status text (UIUX_SPEC §6.1):
  - Open now: "Open · Closes at 23:00" — `success-500` "Open", `body-md` rest
  - Closed now but opens today: "Opens at 17:00" — `#374151` `body-md`
  - Closed today: "Closed today" — `#EF4444` `body-sm`
- Chevron: `chevron-down` 16px `#9CA3AF`, rotates 180° on expand (`Animated.timing`)
- Expanded state: shows all 7 days as rows
  - Each day: day label (`label-md` `#6B7280` w=80px) + hours ("08:00 – 23:00" `body-md` `#111827`) or "Closed" (`#9CA3AF`)
  - Today's row: day label bold `#111827`
- Animate expand: `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)`

## Sticky tabs (Pitches | Reviews)

```typescript
// Implemented with Animated.ScrollView + stickyHeaderIndices
// OR react-native-tab-view for swipeable tabs
```
- Two tabs: "Pitches" | "Reviews"
- Active tab: 2px `#16A34A` bottom border, `#111827` text `heading-sm`
- Inactive: `#9CA3AF` text
- Tab bar height: 48px, white bg
- `sticky` — tabs stick to top of screen as user scrolls past them
- Swipe left/right between tabs

## Pitches tab

**Pitch list card (PitchListCard, UIUX_SPEC §6.1):**
- Row layout inside white card (`shadow-sm`, `radius-md`, 16px padding)
- Left: thumbnail 80×80px, `radius-sm`, cover-fit
- Right (flex-1, 12px gap):
  - Name: `heading-sm` (16px/600), `#111827`, `numberOfLines={1}`
  - Surface chip (surface-specific colour, `label-sm`) + size label `body-sm` `#6B7280`, 8px gap, row
  - Price: "from **XX RON**/h" — `body-sm`, price bold `#15803D`
  - Rating + review count (`body-sm`, `#6B7280`)
- Right edge: `chevron-right` 18px `#D1D5DB`
- Tappable → navigate to `PitchDetail` screen with `{ pitchId, companyId }`

## Data fetching
```typescript
// useCompany.ts
export function useCompany(id: string) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: () => api.get(`/companies/${id}`).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  })
}
```

## Acceptance Criteria
- [ ] Header transparent over hero, transitions to white on scroll (smooth, 60fps)
- [ ] Company name appears in header only after scrolling past hero
- [ ] Back button works correctly (white circle when over hero, plain when header white)
- [ ] Address tap opens native maps app with company location
- [ ] Phone tap opens native dialer
- [ ] Verified badge shown when `isVerified: true`
- [ ] Working hours accordion: today's status correct (open/closed/opens at)
- [ ] Accordion expands/collapses smoothly showing all 7 days
- [ ] Today's day bold in expanded accordion
- [ ] Tabs stick to top on scroll past hero
- [ ] Pitches tab: all active pitches shown as cards
- [ ] Pitch card tap navigates to PitchDetail with correct pitch ID
- [ ] Loading state: skeleton (hero area placeholder + 2 skeleton cards)
- [ ] Error state: "Couldn't load company" + Retry

## Edge cases
- Very long company name: truncate in header (1 line), full in hero
- No pitches: "No pitches available" empty state in Pitches tab
- Company has no phone: hide phone row entirely (not "N/A")
- 0 reviews: show "Not yet rated" instead of stars + count

## Definition of done
- [ ] Scroll animation tested at various scroll speeds (no jank)
- [ ] Tested on iPhone SE (375px) and Pro Max (430px)
- [ ] Deep link to `/discover/:companyId` opens this screen directly
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-pitch-detail","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E04-05 — Mobile: Pitch Detail — gallery, info, amenities, pricing
# ─────────────────────────────────────────────────────────────────────────────
title="[E04-05] [Mobile] Pitch Detail screen — photo gallery, info, amenities grid, pricing card"
read -r -d '' body << 'BODY' || true
## Summary
Build the first half of the Pitch Detail screen: full-width photo gallery with fullscreen lightbox, pitch header (name/surface/size/rating/company link), collapsible description, 2-column amenities grid, and pricing card with off-peak/peak rates.

## Reference
- UIUX_SPEC §6.2 (Photo gallery through Pricing section)
- PRD §7.4

## Files to create
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/discover/PitchDetailScreen.tsx` | Main screen (ScrollView) |
| `apps/mobile/src/components/pitch/PhotoGallery.tsx` | Horizontal paging photo list |
| `apps/mobile/src/components/pitch/PhotoLightbox.tsx` | Fullscreen lightbox modal |
| `apps/mobile/src/components/pitch/AmenitiesGrid.tsx` | 2-col amenity grid |
| `apps/mobile/src/components/pitch/PricingCard.tsx` | Pricing table card |
| `apps/mobile/src/hooks/usePitch.ts` | TanStack Query hook for pitch detail |

## Photo gallery (UIUX_SPEC §6.2)

### Container
- Full width, height: 240px
- No horizontal padding

### FlatList
```typescript
<FlatList
  data={photos}
  horizontal
  pagingEnabled
  showsHorizontalScrollIndicator={false}
  keyExtractor={item => item.id}
  renderItem={({ item }) => (
    <TouchableOpacity onPress={() => openLightbox(item.order)} activeOpacity={0.95}>
      <Image source={{ uri: item.url }} style={{ width, height: 240 }} resizeMode="cover" />
    </TouchableOpacity>
  )}
  onMomentumScrollEnd={e => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width)
    setCurrentPhoto(index)
  }}
/>
```

### Photo counter (absolute, bottom-right of gallery)
- "3 / 8" — `body-sm` (12px/400), white text
- Background: `rgba(0,0,0,0.6)`, `radius-full`, 6px vertical 10px horizontal padding
- 8px from bottom, 12px from right

### No photos fallback
- Solid `#F5F5F5` bg 240px height
- `image-off` icon 48px `#9CA3AF` centered
- "No photos available" `body-sm` `#9CA3AF` below icon

## Fullscreen lightbox (PhotoLightbox)

### Presentation
- `Modal` `animationType="fade"`, `transparent={false}`, `statusBarTranslucent`
- Black background `#000000`

### Close button
- Top-right, `#FFFFFF` X icon, 24px, white circle 40×40px `rgba(255,255,255,0.15)` bg
- 16px from right, 56px from top (safe area)

### Counter
- "3 / 8" centered top, `body-sm` white, below close button

### Photo display
- `FlatList` `pagingEnabled` `horizontal` — same width/height as screen
- `Image` `resizeMode="contain"` (fullscreen: show whole photo, letterboxed)
- Pinch-to-zoom: use `react-native-gesture-handler` + `react-native-reanimated`
  - Scale range: 1× → 4×
  - Double tap: toggle 1× ↔ 2×
- Swipe: native via FlatList paging

### Open at index
When tapping gallery photo at index N → lightbox opens at N.
```typescript
flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false })
```

## Pitch header (UIUX_SPEC §6.2)

### Layout (16px horizontal padding, 16px top margin below gallery)
- **Pitch name**: `heading-xl` (24px/700), `#111827`
- **Surface + size row** (8px top): surface chip (surface-specific colour from §2.7) + size text `body-md` `#6B7280`, 8px gap
  - Surface chip: `label-sm`, `radius-full`, 4px v 8px h padding
  - Size examples: "5v5 (25×45m)", "7v7", "11v11"
- **Rating row** (8px top): star icon `#FBBF24` 14px + "4.5" `body-sm` bold + "(43 reviews)" `#9CA3AF`; if < 3 reviews: "Not yet rated"
- **Company name row** (8px top): "Demo Sports Club" `body-md` `#6B7280` + `chevron-right` 16px `#D1D5DB`
  - Tappable → `navigation.navigate('CompanyDetail', { id: company.id })`

## Description section (UIUX_SPEC §6.2)

### Collapsible text
- Section label: "About this pitch" — `heading-sm` (16px/600), `#111827`, 16px top
- 12px gap below label
- `numberOfLines={expanded ? undefined : 4}` on description `Text`
- "Show more" / "Show less": `label-md` (13px/500), `#16A34A`, right-aligned, 4px below text
- Only shown when text actually exceeds 4 lines (measure with `onTextLayout`)

```typescript
const [isExpanded, setIsExpanded] = useState(false)
const [isTruncated, setIsTruncated] = useState(false)
// onTextLayout: if lines > 4 → setIsTruncated(true)
```

## Amenities section (UIUX_SPEC §6.2)

### Grid layout
- Section label: "Amenities" — `heading-sm`, 16px top
- 2-column grid (`FlatList` with `numColumns={2}` or CSS-style `flexWrap: 'wrap'`)
- Each item: row with icon + label
  - Icon: 20px, `#16A34A` if available; `#D1D5DB` if not available
  - Label: `body-md` (14px/400), `#111827` if available; `#9CA3AF` + `textDecorationLine: 'line-through'` if not
  - Row height: 36px, 8px gap between icon and label

### Show ALL amenity types
Display all 14 amenity types always — show available ones highlighted, unavailable ones greyed + strikethrough. Do NOT hide unavailable amenities.

### Amenity icon mapping (MaterialCommunityIcons)
| AmenityType | Icon | Display label |
|---|---|---|
| SHOWERS_FREE | `shower` | Showers (free) |
| SHOWERS_PAID | `shower` | Showers (paid) |
| CHANGING_ROOMS | `locker-room` | Changing rooms |
| PARKING_FREE | `parking` | Parking (free) |
| PARKING_PAID | `parking` | Parking (paid) |
| NIGHT_LIGHTING | `stadium-outline` | Night lighting |
| BALL_RENTAL_FREE | `soccer` | Ball rental (free) |
| BALL_RENTAL_PAID | `soccer` | Ball rental (paid) |
| REFRESHMENTS | `food` | Refreshments |
| LOCKERS | `lock-outline` | Lockers |
| REFEREE | `whistle` | Referee |
| FIRST_AID | `medical-bag` | First aid kit |
| WHEELCHAIR | `wheelchair-accessibility` | Wheelchair access |
| WIFI | `wifi` | Wi-Fi |

## Pricing card (UIUX_SPEC §6.2)

### Card container
- `#FAFAFA` bg, `radius-md` (12px), 12px padding, 16px top margin

### Content rows
1. **Off-peak row**: "Mon–Fri 08:00–17:00" `body-sm` `#6B7280` (left) + "**60 RON**/h" `price` style (right)
2. **Divider**: 1px `#E5E7EB`
3. **Peak row**: "Mon–Fri 17:00–23:00 + Weekends" `body-sm` `#6B7280` + "**80 RON**/h" `price` style

Generate "time range" label from `peakHoursDefinition` JSON:
```typescript
function formatPeakLabel(peakHours: PeakHoursDef[]): string {
  // Parse days array + time range → "Mon–Fri 17:00–23:00 + Weekends"
}
```

4. **Footer note**: "Min. 1h · Billed per 30 min" — `body-sm` `#9CA3AF`, 8px top
5. **Shirt rental row** (if `hasShirts`): `tshirt-crew` icon 16px `#6B7280` + "Shirt rental: **XX RON**/shirt" `body-sm`, 8px top, divider above

## Acceptance Criteria
- [ ] Gallery: horizontal paging, photo counter bottom-right, correct "X / Y" count
- [ ] Tapping gallery photo opens lightbox at tapped index
- [ ] Lightbox: swipe between photos, pinch to zoom (1×–4×), double tap toggles 2×
- [ ] Lightbox close button works
- [ ] Pitch name, surface chip (correct colour), size shown
- [ ] Company name tappable → navigates to CompanyDetail
- [ ] Description truncated at 4 lines with "Show more", expands on tap
- [ ] "Show more"/"Show less" toggle only visible when text actually exceeds 4 lines
- [ ] All 14 amenity types shown — available highlighted, unavailable greyed strikethrough
- [ ] Pricing card: off-peak + peak rows with correct rates
- [ ] Peak time range label generated from `peakHoursDefinition`
- [ ] Shirt rental row shown only if `hasShirts: true`

## Definition of done
- [ ] Gallery tested with 1 photo, 5 photos, 10 photos
- [ ] Lightbox zoom tested on device (not just simulator — gesture needed)
- [ ] Long description overflow tested
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-pitch-detail","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E04-06 — Mobile: Pitch Detail — availability preview + Book Now footer
# ─────────────────────────────────────────────────────────────────────────────
title="[E04-06] [Mobile] Pitch Detail — 7-day availability preview grid and Book Now sticky footer"
read -r -d '' body << 'BODY' || true
## Summary
Build the bottom portion of the Pitch Detail screen: 7-column availability preview grid (today + 6 days with dot indicators), reviews preview section, and the sticky "Book Now" footer with disabled states.

## Reference
- UIUX_SPEC §6.2 (Availability preview, Reviews preview, Book Now footer)
- PRD §7.4

## Files to create / modify
| File | Purpose |
|---|---|
| `apps/mobile/src/components/pitch/AvailabilityPreview.tsx` | 7-day grid |
| `apps/mobile/src/components/pitch/ReviewsPreview.tsx` | 2 recent reviews + "See all" |
| `apps/mobile/src/components/pitch/BookNowFooter.tsx` | Sticky bottom footer |
| Modify: `PitchDetailScreen.tsx` | Add these sections below pricing card |

## 7-day availability grid (UIUX_SPEC §6.2)

### Section label
"Availability" — `heading-sm` (16px/600), `#111827`, 16px top

### Grid layout
- 7 columns (`flexDirection: 'row'`, `justifyContent: 'space-between'`)
- Each column: `alignItems: 'center'`, 12px horizontal padding total

### Column content (top to bottom)
1. **Day label** (top):
   - "Today" for index 0: `label-sm` (11px/500), `#16A34A` (`primary-600`)
   - "Mon", "Tue" etc. for index 1–6: `label-sm`, `#6B7280` (`neutral-500`)
2. **Date number** (4px below label):
   - `body-sm` (12px/400), `#374151`
   - Format: today = `new Date().getDate()`, next days increment
3. **Dot indicator** (8px below date):
   - 8px diameter circle
   - `#16A34A` — has available slots
   - `#EF4444` (`error-500`) — fully booked
   - `#D1D5DB` (`neutral-300`) — closed day

### Dot state logic
For each of the 7 days, call `GET /pitches/:id/availability?date=YYYY-MM-DD` to get slot statuses.
- Available: at least one slot with `status: 'available'`
- Fully booked: all slots `status: 'booked'` (and `isClosed: false`)
- Closed: `isClosed: true`

**Performance:** Fetch all 7 days in parallel (`Promise.all`). Cache each date's response (TanStack Query with `staleTime: 5 * 60 * 1000`).

```typescript
const today = new Date()
const dates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(today)
  d.setDate(today.getDate() + i)
  return d.toISOString().split('T')[0]
})

const availabilities = useQueries({
  queries: dates.map(date => ({
    queryKey: ['pitch-availability', pitchId, date],
    queryFn: () => api.get(`/pitches/${pitchId}/availability?date=${date}`).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  })),
})
```

### Tap behaviour
- Tap any column → navigate to Booking Flow step 1 with that date pre-selected
- Tap fully booked day: navigate to Booking Flow but Step 1 will show "fully booked" snackbar
- Tap closed day: no navigation, `Toast.show('This pitch is closed on {dayName}')`

## Reviews preview section (UIUX_SPEC §6.2)

### Section label + rating summary
- "Reviews" — `heading-sm`
- Stars row + numeric rating (same as header rating)

### 2 compact review cards
From `pitch.recentReviews` (from E04-02 response — no additional API call):
- Avatar 32px + player name `label-md` `#111827` + date `body-sm` `#9CA3AF` — row
- Stars 14px below
- Review text `body-md` `#374151` (max 3 lines, no expand)
- Photos: not shown in preview (shown in full review list only)
- Manager reply: not shown in preview

If `reviewCount === 0`: "No reviews yet" `body-md` `#9CA3AF` centered.
If `reviewCount < 3`: show however many are available.

### "See all X reviews" link
- `label-md` (13px/500), `#16A34A`
- Arrow `chevron-right` 16px inline
- Navigates to `CompanyDetail` screen at Reviews tab, filtered to this pitch
- Route: `navigation.navigate('CompanyDetail', { id: company.id, initialTab: 'reviews', pitchId })`

## Book Now sticky footer (UIUX_SPEC §6.2)

### Container
- `position: absolute`, `bottom: 0`, `left: 0`, `right: 0`
- `padding: 12px 16px + useSafeAreaInsets().bottom`
- Background: white
- Top border: 1px `#E5E7EB`
- Shadow: `shadow-lg` upward

### Content row
- Left: "from **XX RON**/h"
  - "from " — `body-md` `#6B7280`
  - "XX RON" — `price` style (20px/700, JetBrains Mono), `#111827`
  - "/h" — `body-md` `#6B7280`
- Right: "Book Now" button — `cta` variant (`#F97316` accent-500), `lg` size (48px height), width 140px, `radius-md`

### Disabled states
| Condition | Button state |
|---|---|
| `pitch.isActive === false` | Disabled, grey, label "Not available" |
| Company status SUSPENDED | Disabled, grey, label "Not available" |
| User trust score tier = SUSPENDED (< 30) | Disabled, grey, label "Account restricted" |
| User not logged in | Button shows "Sign in to book" → navigate to Login |

Check trust score from auth store (available after login).

### Scroll padding
Add `contentContainerStyle={{ paddingBottom: FOOTER_HEIGHT }}` to main ScrollView so content isn't hidden behind fixed footer.

### On press (enabled state)
```typescript
navigation.navigate('BookingFlow', {
  pitchId: pitch.id,
  pitchName: pitch.name,
  companyName: company.name,
  offPeakRate: pitch.offPeakRate,
  peakRate: pitch.peakRate,
})
```

## Acceptance Criteria
- [ ] 7 columns render, correct day labels ("Today" for day 0, abbreviated day names for 1–6)
- [ ] Dot colours: green (available), red (fully booked), grey (closed)
- [ ] Parallel availability API calls for all 7 days on mount
- [ ] Loading dots: grey animated pulse while fetching
- [ ] Tap available day → Booking Flow Step 1 opens with that date pre-selected
- [ ] Tap closed day → toast "Pitch is closed on {day}"
- [ ] Reviews preview shows max 2 recent reviews from pitch detail API response (no extra call)
- [ ] "See all X reviews" navigates to CompanyDetail Reviews tab
- [ ] Book Now footer fixed at bottom, above safe area
- [ ] Scroll content not hidden behind footer (paddingBottom applied)
- [ ] Book Now disabled with correct label for each disabled condition
- [ ] "Sign in to book" navigates to Login when unauthenticated

## Definition of done
- [ ] 7-day grid tested with mixed availability (some full, some closed, some available)
- [ ] Footer disabled states all verified manually
- [ ] Book Now → Booking Flow navigation wired (even if E05 not built yet — navigate to placeholder)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-pitch-detail","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E04-07 — Mobile: Reviews list (reusable)
# ─────────────────────────────────────────────────────────────────────────────
title="[E04-07] [Mobile] Reviews list — rating breakdown bar chart, review cards, manager replies, pagination"
read -r -d '' body << 'BODY' || true
## Summary
Build the full reviews list shown in the Company Detail Reviews tab. Includes a rating breakdown header with bar chart (5★→1★ distribution), paginated review cards with player avatars, review photos, and manager reply. Reused in any "See all reviews" context.

## Reference
- UIUX_SPEC §6.1 (Reviews tab content)
- PRD §7.3, §11

## Files to create
| File | Purpose |
|---|---|
| `apps/mobile/src/components/reviews/RatingBreakdown.tsx` | Rating header + bar chart |
| `apps/mobile/src/components/reviews/ReviewCard.tsx` | Single review card |
| `apps/mobile/src/components/reviews/ReviewPhotoStrip.tsx` | Horizontal photo scroll in review |
| `apps/mobile/src/hooks/useReviews.ts` | TanStack Query paginated reviews hook |

## Backend endpoint (existing from PRD §14)
```
GET /api/v1/reviews?pitchId=&companyId=&page=&limit=
```
Implement this endpoint if not yet done:
- `pitchId` OR `companyId` (filter — at least one required)
- `page`, `limit` (offset pagination, limit default 10)
- Returns: reviews with player info, sorted newest first
- Approved only (`moderationStatus: 'APPROVED'`)

Also needed: rating distribution query:
```typescript
// Group by rating value 1-5
const distribution = await prisma.review.groupBy({
  by: ['rating'],
  where: { pitchId: ..., moderationStatus: 'APPROVED' },
  _count: { rating: true },
})
```

## Rating breakdown header (UIUX_SPEC §6.1)

### Large rating number
- "4.3" — `display-md` (30px/700), `#111827`, left
- "out of 5" — `body-md` `#6B7280`, inline right of number, baseline aligned
- Stars row (24px each, `#FBBF24`), 8px below number
- "(127 reviews)" — `body-sm` `#6B7280`, 8px below stars

### Bar chart (5 rows, 5★ → 1★)
Each row:
- Star label: "5 ★" — `body-sm` `#6B7280`, width 32px
- Bar: `View` flex-1, height 8px, `radius-full`
  - Track: `#E5E7EB`
  - Fill: `#16A34A` (`primary-600`), width = `(count / totalReviews) * 100%`
  - `Animated.timing` fill from 0 to width on mount
- Count: review count for this star — `body-sm` `#6B7280`, width 32px, right-aligned

Missing star levels (0 count): show empty bar (0% fill).

## Review cards (UIUX_SPEC §6.1)

### Card layout (no outer card border — just vertical spacing)
- 16px top padding per card
- 1px `#E5E7EB` bottom divider

**Header row:**
- Avatar 32×32px, `radius-full`
  - `isAnonymous`: show grey circle + "?" initial
  - Has avatar: `Image` with `profilePhotoUrl`
  - No avatar: initials on `#DCFCE7` bg, `#15803D` text `label-sm`
- Right of avatar (12px gap):
  - Name: `label-md` (13px/500), `#111827` — or "Anonymous player" `#6B7280`
  - Date: `body-sm` (12px/400), `#9CA3AF` — formatted "Oct 1, 2026"
- Stars: 14px each, `#FBBF24`, 6px below avatar row

**Review text:** `body-md` (14px/400), `#374151`, full text (no truncation in list view), 8px top

**Review photos** (if any): ReviewPhotoStrip — horizontal scroll, 80×80px thumbnails, `radius-sm`, `object-cover`, 8px top, 8px gap
- Tap photo → fullscreen lightbox (reuse PhotoLightbox from E04-05)

**Manager reply** (if `managerReply` not null): 12px top
- Indented: 12px left margin
- Container: `#FAFAFA` bg, `radius-sm`, 8px padding
- "Response from manager" — `label-sm` (11px/500), `#6B7280`, `uppercase`, 4px bottom
- Reply text: `body-md` `#374151`

## Pagination (`useReviews` hook)
```typescript
export function useReviews(params: { pitchId?: string; companyId?: string }) {
  return useInfiniteQuery({
    queryKey: ['reviews', params],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/reviews', { params: { ...params, page: pageParam, limit: 10 } })
         .then(r => r.data.data),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.reviews.length === 10 ? allPages.length + 1 : undefined,
  })
}
```

FlatList with `onEndReached` → `fetchNextPage()` when within 300px of bottom.
Footer: spinner when `isFetchingNextPage`.

## Empty state
`reviewCount === 0`: "No reviews yet" illustration + "Be the first to review after your booking" `body-md` `#6B7280`

## Acceptance Criteria
- [ ] Rating breakdown header shows correct aggregate rating and star display
- [ ] Bar chart bars fill to correct proportions (e.g. 70 out of 127 five-star = 55% width)
- [ ] Bar fill animates from 0% on mount
- [ ] Review card shows: avatar (or initials), name (or "Anonymous player"), date, stars, text
- [ ] Anonymous reviews hide player name and use grey avatar with "?"
- [ ] Manager reply shown indented with "Response from manager" label
- [ ] Review photos scroll horizontally, tap opens lightbox
- [ ] Pagination: scrolling to bottom loads next page (no visible reset of position)
- [ ] Empty state shown when no reviews

## Edge cases
- Review with rating only (no text): card shows stars but no text — no empty line gap
- Manager reply edited: shows updated reply (no "edited" indicator in v1.0)
- Review with 3 photos: photos scroll horizontally, don't wrap

## Definition of done
- [ ] Reviews tab in Company Detail populated with real data
- [ ] Pagination confirmed (≥ 2 pages loaded)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-pitch-detail","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E04-08 — Web: Company + Pitch Detail pages
# ─────────────────────────────────────────────────────────────────────────────
title="[E04-08] [Web] Company Detail and Pitch Detail pages for web players"
read -r -d '' body << 'BODY' || true
## Summary
Build the web versions of Company Detail (`/discover/[companyId]`) and Pitch Detail (`/discover/[companyId]/[pitchId]`). Reuses the same backend APIs as mobile. Responsive layout — all content accessible on desktop and mobile web.

## Reference
- UIUX_SPEC §6 (mobile spec — adapt layout for web)
- PRD §5.3 (Web app — Player)

## Files to create
| File | Purpose |
|---|---|
| `apps/web/src/app/(player)/discover/[companyId]/page.tsx` | Company Detail page |
| `apps/web/src/app/(player)/discover/[companyId]/[pitchId]/page.tsx` | Pitch Detail page |
| `apps/web/src/components/company/CompanyHeroWeb.tsx` | Hero section |
| `apps/web/src/components/pitch/PhotoGalleryWeb.tsx` | Web photo gallery |
| `apps/web/src/components/pitch/BookNowSidebarWeb.tsx` | Sticky sidebar CTA (desktop) |

## Company Detail page — layout

### Hero section (full width)
- Company logo 80×80px (shadcn/ui `Avatar`), `rounded-xl`, float left on desktop
- Company name `text-3xl font-bold` + verified badge (Lucide `BadgeCheck` 20px `#16A34A`)
- Address (Lucide `MapPin` 16px) — tappable → Google Maps link `target="_blank"`
- Phone (Lucide `Phone` 16px) — `tel:` link
- Rating + review count
- Working hours: expandable `Disclosure` (headlessui) or shadcn/ui `Collapsible`

### Tab navigation (shadcn/ui `Tabs`)
- "Pitches" tab: responsive grid of pitch cards (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- "Reviews" tab: rating breakdown + review list

### Pitch card (web)
Same data as mobile PitchListCard — white card, cover photo, name, surface/size, price, rating.
Responsive: full-width on mobile web, 3-column grid on desktop.

### Reviews (web)
Same content as mobile ReviewCard — rating breakdown bar chart (CSS width %), review cards.

## Pitch Detail page — layout

### Desktop layout (≥ 1024px): 2-column
```
[Photo gallery — 60%] [Book Now sidebar — 40%]
[Info sections — 100% below gallery]
```

### Photo gallery (web)
- `react-image-gallery` library or custom:
  - Main image: full width of column, `aspect-ratio: 4/3`, `object-cover`
  - Thumbnails strip below: horizontal scroll, 80px thumbnails
  - Click thumbnail → show main image
  - Click main image → lightbox (`yet-another-react-lightbox` or similar)
- Photo counter shown as "3 / 8" overlay top-right

### Book Now sidebar (desktop, sticky)
```
[Price: from XX RON/h]
[7-day availability mini-grid]
[Book Now button — full width, accent-500]
[Cancellation policy note]
```
Sticky: `position: sticky, top: 80px` (below topnav).

On mobile web: sidebar moves below gallery, becomes full-width section before info.

### Info sections (below gallery / sidebar)
Same content as mobile, web layout:
- Description with Read more/less (`line-clamp-4` Tailwind, toggle with JS)
- Amenities: 2-column `grid` on desktop, 1-column on mobile
- Pricing: shadcn/ui `Table` or card div
- Reviews preview: 2 cards + "See all" link

### Book Now button behaviour (web)
- If authenticated: navigate to `/booking/new?pitchId=XXX` (booking flow web page — E05)
- If not authenticated: navigate to `/login?redirect=/booking/new?pitchId=XXX`

## Server-side rendering
Both pages use Next.js App Router:
```typescript
// page.tsx
export default async function PitchDetailPage({ params }: { params: { pitchId: string } }) {
  const pitch = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/v1/pitches/${params.pitchId}`)
    .then(r => r.json())
  // Pass as props to Client Component for interactivity
}
```
- Company + pitch detail data fetched server-side (for SEO + fast first paint)
- Availability grid fetched client-side (dynamic, changes frequently)

## SEO metadata
```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const pitch = await fetchPitch(params.pitchId)
  return {
    title: `${pitch.name} — ${pitch.company.name} | PitchUp`,
    description: pitch.description?.slice(0, 155),
    openGraph: {
      images: [pitch.photos[0]?.url],
    },
  }
}
```

## Acceptance Criteria
- [ ] `/discover/[companyId]` renders company info + pitches tab + reviews tab
- [ ] `/discover/[companyId]/[pitchId]` renders full pitch detail
- [ ] Desktop: Book Now sidebar sticky (visible while scrolling info sections)
- [ ] Mobile web: sidebar collapses to full-width section
- [ ] Photo gallery works: click thumbnail → show main, click main → lightbox
- [ ] 7-day availability grid correct dot colours
- [ ] "Book Now" for unauthenticated user → redirect to login with `redirect` param
- [ ] Page title + OG meta correct for each pitch
- [ ] Server-side fetch for company/pitch data (not loading spinner on first paint)

## Definition of done
- [ ] Both pages tested on desktop (1280px) + mobile web (375px)
- [ ] Lighthouse SEO score ≥ 90 for pitch detail page
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-pitch-detail","priority: medium","type: frontend-web"]' \
  "$MILESTONE"

echo ""
echo "✓ E04 — Player: Pitch Detail: 8 issues created"
BODY
