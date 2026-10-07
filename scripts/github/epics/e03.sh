#!/usr/bin/env bash
# e03.sh — create all E03 Player: Discover issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E03 — Player: Discover")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E03 — Player: Discover' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E03 — Player: Discover)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E03-01 — Backend: GET /companies
# ─────────────────────────────────────────────────────────────────────────────
title="[E03-01] [Backend] GET /companies — city filter, sort, search, amenity/surface filters, pagination"
read -r -d '' body << 'BODY' || true
## Summary
Implement `GET /api/v1/companies` — the main endpoint powering the Discover screen. Supports city filter (required), text search, surface/size/amenity multi-filters, price range, availability toggles, sort options, and cursor-based pagination. Returns enriched company data including pitch count, average rating, and distance.

## Reference
- PRD §7.2 (Discover — Company List), §14 (API Surface)

## File to create
`apps/web/src/app/api/v1/companies/route.ts`

## Query parameters

| Param | Type | Required | Notes |
|---|---|---|---|
| `city` | string | **yes** | Exact city name (from predefined list) |
| `search` | string | no | Searches company name |
| `sort` | `distance\|rating\|price\|newest` | no | Default: `distance` if lat/lng provided, else `rating` |
| `lat` | number | no | User latitude — required for `distance` sort and distance field |
| `lng` | number | no | User longitude |
| `surface` | `NATURAL_GRASS\|ARTIFICIAL_GRASS\|FUTSAL` | no | Multi-value: `surface=NATURAL_GRASS&surface=FUTSAL` |
| `size` | `FIVE_A_SIDE\|SEVEN_A_SIDE\|ELEVEN_A_SIDE` | no | Multi-value |
| `amenities` | AmenityType enum values | no | Multi-value |
| `priceMin` | number | no | Min off-peak rate (RON/h) |
| `priceMax` | number | no | Max off-peak rate (RON/h) |
| `availableNow` | boolean | no | Only companies with pitch available in next 2 hours |
| `openNow` | boolean | no | Only companies where working hours include current time |
| `cursor` | string | no | Pagination cursor (company ID of last item) |
| `limit` | number | no | Default 20, max 50 |

## Response shape
```json
{
  "data": {
    "companies": [
      {
        "id": "...",
        "name": "Demo Sports Club",
        "logoUrl": "https://res.cloudinary.com/...",
        "city": "Cluj-Napoca",
        "address": "Str. Sportului 1",
        "avgRating": 4.3,
        "reviewCount": 127,
        "pitchCount": 3,
        "priceFrom": 60,
        "isOpenNow": true,
        "distanceKm": 1.4,
        "isVerified": true
      }
    ],
    "nextCursor": "clxyz...",
    "total": 42
  },
  "error": null
}
```

`distanceKm` is `null` if `lat`/`lng` not provided.
`nextCursor` is `null` when no more results.

## Prisma query strategy

### Base query
```typescript
const companies = await prisma.company.findMany({
  where: {
    status: 'ACTIVE',
    city,
    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    ...(surface.length || size.length || amenities.length || priceMin || priceMax
      ? {
          pitches: {
            some: {
              isActive: true,
              ...(surface.length ? { surfaceType: { in: surface } } : {}),
              ...(size.length    ? { size: { in: size } } : {}),
              ...(priceMin       ? { offPeakRate: { gte: priceMin } } : {}),
              ...(priceMax       ? { offPeakRate: { lte: priceMax } } : {}),
              ...(amenities.length ? {
                amenities: { some: { amenityType: { in: amenities } } }
              } : {}),
            },
          },
        }
      : {}),
  },
  include: {
    pitches: {
      where: { isActive: true },
      select: { offPeakRate: true, peakRate: true },
    },
    _count: { select: { pitches: { where: { isActive: true } } } },
  },
  take: limit + 1,  // fetch one extra to determine nextCursor
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
})
```

### Computed fields (in-memory after DB fetch)
- `avgRating`: `SELECT AVG(r.rating) FROM Review r JOIN Pitch p ON r.pitchId = p.id WHERE p.companyId = $id`
  - Optimise: add `avgRating Float?` and `reviewCount Int @default(0)` denormalized on `Company` model. Update via trigger / service call when review created/deleted.
  - For v1.0: compute in memory (acceptable for small dataset)
- `priceFrom`: `Math.min(...pitches.map(p => p.offPeakRate))`
- `isOpenNow`: check `company.workingHours` JSON against current time (UTC, convert to company local time)
- `distanceKm`: Haversine formula (see below)

### Distance sort (Haversine)
```typescript
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
```
After DB fetch, compute distance for each company, sort ascending, slice for pagination.

**Note:** For production scale, use PostGIS `ST_Distance`. For v1.0 with < 1000 companies, in-memory Haversine is acceptable.

### `availableNow` filter
Companies that have at least one pitch with an available 2-hour slot starting within the next 2 hours:
```typescript
const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
// Query: pitch has no Booking overlapping [now, twoHoursFromNow]
// AND pitch working hours include current time
```
This is expensive — execute only when `availableNow=true`. Cache result for 5 minutes per city (in-memory Map with TTL).

### `openNow` filter
```typescript
function isCompanyOpen(workingHours: Json, now: Date): boolean {
  const day = now.getDay()  // 0 = Sunday
  const hours = workingHours[day]  // { open: '08:00', close: '23:00' } or { closed: true }
  if (!hours || hours.closed) return false
  const [openH, openM] = hours.open.split(':').map(Number)
  const [closeH, closeM] = hours.close.split(':').map(Number)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return nowMinutes >= openH * 60 + openM && nowMinutes < closeH * 60 + closeM
}
```

## Acceptance Criteria
- [ ] `GET /companies?city=Cluj-Napoca` returns active companies in Cluj-Napoca
- [ ] `city` missing → 400 `VALIDATION_ERROR` "City is required"
- [ ] `search=demo` filters by company name (case-insensitive)
- [ ] `sort=rating` returns companies sorted by avgRating descending
- [ ] `sort=distance&lat=46.77&lng=23.59` returns companies sorted by distance ascending, `distanceKm` populated
- [ ] `sort=price` returns companies sorted by `priceFrom` ascending
- [ ] `surface=FUTSAL&surface=ARTIFICIAL_GRASS` returns companies with at least one pitch of either type
- [ ] `priceMin=50&priceMax=100` returns only companies with off-peak rate in that range
- [ ] `openNow=true` excludes companies closed at current time
- [ ] Pagination: `nextCursor` present when more results available, `null` when exhausted
- [ ] `limit=5` returns max 5 results
- [ ] `distanceKm` is `null` when `lat`/`lng` not provided
- [ ] Response time < 200ms for < 100 companies (no N+1 queries)
- [ ] Auth not required (public endpoint)

## Edge cases
- City with no active companies: returns empty array (not 404)
- Company with no active pitches: excluded from results (`pitchCount: 0` should not appear)
- `priceFrom` when company has no pitches: skip (should not reach this state — see above)
- Distance sort without lat/lng: fall back to rating sort, log warning

## Definition of done
- [ ] All filter combinations tested with Postman/curl
- [ ] No N+1 queries (verify with Prisma query log)
- [ ] Endpoint documented in a simple `API.md` or inline JSDoc
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-discover","priority: critical","type: backend"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E03-02 — Location permission + GPS city detection
# ─────────────────────────────────────────────────────────────────────────────
title="[E03-02] [Mobile] Location permission flow — GPS detection and reverse geocode to city"
read -r -d '' body << 'BODY' || true
## Summary
Implement GPS location permission request, position retrieval, and reverse geocoding to a city name. Persists selected city across sessions. City is mandatory before showing company list — blocks Discover tab if no city selected or detected.

## Reference
- PRD §7.1 (Location & City Selection)
- UIUX_SPEC §5.1 (Location banner), §5.3 (City Selector)

## Libraries
- `react-native-geolocation-service` — GPS position
- `@react-native-google-maps/google-geocoding` or direct `fetch` to Google Geocoding API

## Files to create / modify
| File | Purpose |
|---|---|
| `apps/mobile/src/hooks/useLocation.ts` | Location permission + GPS + geocode hook |
| `apps/mobile/src/store/discoverStore.ts` | Zustand: selectedCity, userCoords, filters, sort |
| `apps/mobile/src/screens/discover/CityBlocker.tsx` | Blocking UI when no city selected |

## Platform setup

### iOS — `Info.plist`
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>PitchUp uses your location to show pitches near you.</string>
```

### Android — `AndroidManifest.xml`
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

## `useLocation` hook
```typescript
export function useLocation() {
  const { setCity, setCoords } = useDiscoverStore()

  async function requestAndDetect(): Promise<'detected' | 'denied' | 'error'> {
    // 1. Request permission
    const status = await Geolocation.requestAuthorization('whenInUse')
    if (status !== 'granted') return 'denied'

    // 2. Get position (timeout 10s)
    return new Promise(resolve => {
      Geolocation.getCurrentPosition(
        async position => {
          const { latitude, longitude } = position.coords
          setCoords({ lat: latitude, lng: longitude })

          // 3. Reverse geocode
          const city = await reverseGeocodeToCity(latitude, longitude)
          if (city) {
            setCity(city)
            await AsyncStorage.setItem('selected_city', city)
            resolve('detected')
          } else {
            resolve('error')  // GPS worked but no city matched
          }
        },
        () => resolve('error'),
        { timeout: 10000, enableHighAccuracy: false, maximumAge: 300000 }
      )
    })
  }

  return { requestAndDetect }
}
```

## Reverse geocode function
```typescript
async function reverseGeocodeToCity(lat: number, lng: number): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}&result_type=locality`
  const res = await fetch(url)
  const data = await res.json()
  const locality = data.results?.[0]?.address_components?.find(
    (c: any) => c.types.includes('locality')
  )?.long_name ?? null

  // Match against known cities list from packages/shared
  if (!locality) return null
  const known = CITIES.find(c =>
    c.name.toLowerCase() === locality.toLowerCase() ||
    locality.toLowerCase().includes(c.name.toLowerCase())
  )
  return known?.name ?? null
}
```

## City persistence (Zustand + AsyncStorage)
```typescript
// discoverStore.ts
interface DiscoverState {
  selectedCity: string | null
  userCoords: { lat: number; lng: number } | null
  setCity: (city: string) => void
  setCoords: (coords: { lat: number; lng: number }) => void
  // ... filters state added in E03-06
}
```
On app start: hydrate `selectedCity` from `AsyncStorage.getItem('selected_city')`.

## City blocker screen
Shown on Discover tab when `selectedCity === null` AND location permission denied/not-yet-requested:
- Center of screen: `map-marker` icon 64px `primary-600`
- "Where are you playing?" — `heading-xl`, centered
- "Select your city to find pitches near you." — `body-md`, `neutral-500`, centered
- "Detect my location" — `primary` button, full width, 40px horizontal margin, calls `requestAndDetect()`
- "Select city manually" — `secondary` button, full width, opens CitySelector modal
- 12px gap between buttons

Blocker is shown as an overlay on the Discover tab (not a separate screen — the tab is mounted but covered).

## Discover tab first-launch flow
1. Tab mounted → check `selectedCity` in store
2. If city set: show company list normally
3. If no city:
   a. Auto-request permission (once, on first Discover tab visit)
   b. If granted → detect → set city → show list
   c. If denied → show CityBlocker

## Acceptance Criteria
- [ ] On first Discover tab visit: permission dialog shown automatically
- [ ] Permission granted → GPS acquired → city detected → location banner shows city name
- [ ] Permission denied → CityBlocker shown (not an error, just the manual selector prompt)
- [ ] Detected city persists after app restart (AsyncStorage)
- [ ] `userCoords` stored in discoverStore — used by company list API call (`lat`/`lng` params)
- [ ] If GPS city does not match any city in predefined list: fall back to CityBlocker
- [ ] `maximumAge: 300000` (5 min) — do not re-request GPS if recent position available
- [ ] No crash if location permission denied on Android (no exception — return `'denied'`)

## Edge cases
- iOS: permission status "restricted" (parental control) — treat same as denied
- Android: permission permanently denied ("don't ask again") — show system settings deep link button: `Linking.openSettings()`
- No internet for geocoding: GPS coords available but city unknown → show CityBlocker
- City on border (e.g., Florești near Cluj-Napoca): nearest known city matched

## Definition of done
- [ ] Tested on iOS simulator + Android emulator (location simulation)
- [ ] Tested with permission denied scenario on both platforms
- [ ] City persists across app kills (AsyncStorage confirmed)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-discover","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E03-03 — City selector modal
# ─────────────────────────────────────────────────────────────────────────────
title="[E03-03] [Mobile] City selector modal — searchable city list with GPS detect row"
read -r -d '' body << 'BODY' || true
## Summary
Full-screen modal presenting a searchable list of predefined cities. First row: "Detect my location" GPS option. Tapping a city persists selection and closes modal. Opened from location banner ("Change") and CityBlocker.

## Reference
- UIUX_SPEC §5.3

## Files to create
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/discover/CitySelector.tsx` | Full-screen modal component |
| Already exists: `packages/shared/src/constants/cities.ts` | City list source of truth (from E01-04) |

## Layout (UIUX_SPEC §5.3)

### Presentation
- Slides up as full-screen modal
- `Modal` component with `animationType="slide"`, `presentationStyle="fullScreen"` (iOS) / default (Android)
- Safe area applied

### Header (fixed)
- Height: 56px
- "Select city" — `heading-lg` (20px/600), `#111827`, left, 16px margin
- X close button: top right, 44×44px tap target, `#111827`
- Bottom border: 1px `#E5E7EB`

### Search input (below header, fixed)
- Same style as Discover search bar (height 44px, `#F5F5F5` bg, `radius-full`)
- `magnify` icon left, placeholder "Search cities..."
- 8px vertical margin, 16px horizontal margin
- Filters city list live as user types (no debounce needed — in-memory filter)

### City list (scrollable, below search)

**First item — "Detect my location" row:**
- Height: 56px
- Left: `crosshairs-gps` icon 20px `#16A34A` (`primary-600`)
- Text: "Detect my location" — `body-lg` (16px/400), `#16A34A`
- 16px left padding
- Bottom border: 1px `#F5F5F5`
- On tap:
  1. Show inline loading spinner (replaces icon)
  2. Call `requestAndDetect()` from `useLocation` hook
  3. On success: close modal, update discoverStore city + coords
  4. On denied: show inline message "Location permission denied. Select manually."
  5. On error: show "Couldn't detect location. Try selecting manually."

**Section header (if grouping by country — v1.0: only Romania)**
- "ROMANIA" — `label-sm` (11px/500), `#9CA3AF` (`neutral-400`), uppercase
- 12px top padding, 16px left padding, `#FAFAFA` bg

**City rows:**
- Height: 56px (min), auto if text wraps
- Left: city name — `body-lg` (16px/400), `#111827`
- Below city name: county — `body-sm` (12px/400), `#6B7280` (`neutral-500`)
- Right: `check` icon 20px `#16A34A` — only on selected city row
- 16px horizontal padding
- 1px `#F5F5F5` bottom separator
- Tap → `setCity(city.name)` → `AsyncStorage.setItem('selected_city', city.name)` → close modal

**Empty search result:**
- "No cities found for '{query}'" — `body-md`, `#6B7280`, centered, 40px top padding

## Filtering logic
```typescript
const filtered = useMemo(() =>
  CITIES.filter(c =>
    c.name.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .includes(query.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())
  ),
[query])
```
Strip diacritics before comparing — "Cluj" matches "Cluj-Napoca".

## City data shape (from packages/shared)
```typescript
export const CITIES = [
  { name: 'București',  county: 'Ilfov',    country: 'RO' },
  { name: 'Cluj-Napoca', county: 'Cluj',    country: 'RO' },
  { name: 'Timișoara',  county: 'Timiș',    country: 'RO' },
  // ... all 10+ cities
] as const
```

## Acceptance Criteria
- [ ] Modal slides up from bottom on trigger
- [ ] Close (X) tapped: modal closes, city selection unchanged
- [ ] "Detect my location" row appears first, above city list
- [ ] Typing in search filters list instantly (no loading indicator)
- [ ] Diacritic-insensitive search: "timis" matches "Timișoara"
- [ ] Selected city shows `check` icon on right
- [ ] Tap city → modal closes → location banner updates to "Pitches in **{City}**"
- [ ] Selection persisted (reload app → same city shown)
- [ ] Empty search state shown when no city matches query
- [ ] GPS detect row shows spinner while detecting, message on deny/error

## Definition of done
- [ ] City list includes all cities from `packages/shared/src/constants/cities.ts`
- [ ] Tested on iOS and Android
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-discover","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E03-04 — Discover screen — list view shell
# ─────────────────────────────────────────────────────────────────────────────
title="[E03-04] [Mobile] Discover screen — list view: header, location banner, search, sort chips, FlatList"
read -r -d '' body << 'BODY' || true
## Summary
Build the Discover screen list view: fixed header with filter icon, location banner, debounced search bar, horizontally scrollable sort chips, map/list toggle, and a FlatList wired to the companies API with pull-to-refresh and infinite scroll.

## Reference
- UIUX_SPEC §5.1

## Files to create / modify
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/discover/DiscoverScreen.tsx` | Main screen (switches list/map view) |
| `apps/mobile/src/screens/discover/DiscoverListView.tsx` | List view sub-component |
| `apps/mobile/src/hooks/useCompanies.ts` | TanStack Query hook for company list |

## Screen structure
```
<SafeAreaView>
  <DiscoverHeader />          — fixed, not inside scroll
  <LocationBanner />          — fixed, below header
  <SearchBar />               — fixed, below banner
  <SortChips />               — fixed, below search
  {viewMode === 'list'
    ? <DiscoverListView />
    : <DiscoverMapView />}    — fills remaining space
</SafeAreaView>
```

## Header (UIUX_SPEC §5.1)
- Height: 56px (+ status bar padding)
- Background: white
- Left: "PitchUp" wordmark — `heading-md` (18px/600), `#16A34A` (`primary-600`)
- Right: `tune` icon 24px `#111827` — opens Filters bottom sheet (E03-06)
  - Active filters badge: 8px circle `#16A34A` positioned top-right of icon (shown when any filter active)
- Bottom shadow: `shadow-xs` — always visible (not scroll-dependent on this screen)

## Location banner
- Background: `#FAFAFA` (`neutral-50`), full width
- 12px vertical padding, 16px horizontal padding
- Left: `map-marker` icon 18px `#16A34A`
- Text: "Pitches in " + **{city}** — `body-md` (14px/400), `#374151`, city bold
- Right: "Change" — `label-md` (13px/500), `#16A34A`
- Entire row tappable → opens CitySelector modal (E03-03)
- 1px `#E5E7EB` bottom border

## Search bar
- 8px top + bottom margin, 16px horizontal margin
- Height: 44px, `#F5F5F5` bg, `radius-full`, 16px padding
- Left: `magnify` icon 18px `#9CA3AF`
- `TextInput` — placeholder "Search companies...", `#9CA3AF`
- Debounced 300ms: only triggers API refetch after 300ms idle
- Clear button (X): appears when text present, `#9CA3AF`, 44×44px tap target

## Sort chips
- Horizontal `ScrollView`, `showsHorizontalScrollIndicator={false}`
- 16px left padding, 8px gap between chips, 8px vertical padding
- Chips: `['Nearest', 'Top rated', 'Lowest price', 'Newest']`
- Sort map: `{ Nearest: 'distance', 'Top rated': 'rating', 'Lowest price': 'price', Newest: 'newest' }`
- Default: "Nearest" (if `userCoords` set), else "Top rated"
- Selected chip style: `#DCFCE7` bg, `#15803D` text, 1px `#16A34A` border, `radius-full`, 28px height, 12px horizontal padding
- Unselected: `#F5F5F5` bg, `#374151` text, same size

## Map/List toggle button
- Absolute position: right 16px, vertically centered with sort chips row
- 40×40px, white bg, `radius-md` (12px), `shadow-sm`
- Icon: `map-outline` (list mode → tap to go map) / `format-list-bulleted` (map mode → tap to go list)
- `#111827` icon colour
- Toggle: `setViewMode(mode === 'list' ? 'map' : 'list')`

## `useCompanies` TanStack Query hook
```typescript
export function useCompanies(params: CompanyQueryParams) {
  return useInfiniteQuery({
    queryKey: ['companies', params],
    queryFn: ({ pageParam }) =>
      api.get('/companies', { params: { ...params, cursor: pageParam } })
         .then(r => r.data.data),
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    staleTime: 2 * 60 * 1000,  // 2 min
    enabled: !!params.city,
  })
}
```

## FlatList
- `data`: all pages flattened: `pages.flatMap(p => p.companies)`
- `keyExtractor`: `item.id`
- `contentContainerStyle`: `{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }`
- `renderItem`: `<CompanyCard company={item} onPress={() => navigate('CompanyDetail', { id: item.id })} />`
- `onEndReached`: call `fetchNextPage()` when within 400px of bottom
- `onEndReachedThreshold`: `0.3`
- `refreshControl`: `<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#16A34A" />`
- `ListFooterComponent`: loading spinner when `isFetchingNextPage`
- `ListEmptyComponent`: EmptyState or ErrorState (from E03-05)

## View mode state
Stored in `discoverStore` (Zustand) — persists during session, resets on app restart.

## Acceptance Criteria
- [ ] Header renders with "PitchUp" wordmark and filter icon
- [ ] Filter icon shows `#16A34A` dot badge when any filter is active
- [ ] Location banner shows selected city name (from discoverStore)
- [ ] Search input debounces 300ms before triggering API call
- [ ] Clear button appears when text in search, clears on tap + re-fetches
- [ ] Sort chip selection updates sort param in API call
- [ ] "Nearest" chip only available (and default) when `userCoords` is set; else defaults to "Top rated"
- [ ] Map/list toggle switches between views
- [ ] Pull-to-refresh triggers API refetch
- [ ] Scrolling to bottom loads next page of results
- [ ] `enabled: !!params.city` — no API call when no city selected (CityBlocker shown instead)

## Edge cases
- Rapid sort chip taps: TanStack Query deduplicates — only latest params fetch
- Search cleared while loading: cancel in-flight request (TanStack Query handles via `queryKey` change)
- No internet: error state shown (handled in CompanyCard/FlatList, E03-05)
- City changes mid-session: entire list refetches, pagination resets

## Definition of done
- [ ] Infinite scroll tested (≥ 2 pages of results)
- [ ] Pull-to-refresh confirmed working
- [ ] Search debounce confirmed (network tab shows only 1 request per query after 300ms)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-discover","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E03-05 — Company card + skeleton + empty + error states
# ─────────────────────────────────────────────────────────────────────────────
title="[E03-05] [Mobile] CompanyCard component — all states: loaded, skeleton, empty, error"
read -r -d '' body << 'BODY' || true
## Summary
Build the `CompanyCard` component used in the Discover list and Map preview sheet. Also implement skeleton loader, empty state, and error state shown in place of the list.

## Reference
- UIUX_SPEC §5.1 (Company card, loading, empty, error)

## Files to create
| File | Purpose |
|---|---|
| `apps/mobile/src/components/discover/CompanyCard.tsx` | Main card |
| `apps/mobile/src/components/discover/CompanyCardSkeleton.tsx` | Shimmer placeholder |
| `apps/mobile/src/components/common/SkeletonBox.tsx` | Generic shimmer box (reusable) |
| `apps/mobile/src/components/common/EmptyState.tsx` | Generic empty state (reusable) |
| `apps/mobile/src/components/common/ErrorState.tsx` | Generic error state (reusable) |

## CompanyCard layout (UIUX_SPEC §5.1)

### Container
- Background: white, `shadow-sm`, `radius-md` (12px), 16px padding
- `TouchableOpacity` — `activeOpacity={0.7}`, calls `onPress` (navigate to CompanyDetail)

### Internal row
```
[Logo 56×56]  [flex-1, 12px left margin]
              Row 1: Name + "OPEN" badge
              Row 2: map-marker icon + address
              Row 3: ⭐ rating + count + · + distance
              Row 4: "X pitches" chip + "from XX RON/h"
```

### Logo
- `Image`, 56×56px, `radius-sm` (8px), `#F5F5F5` bg (shows while image loads)
- `resizeMode="cover"`
- Fallback: if `logoUrl` null → grey square with building icon 24px `#9CA3AF` centered

### Row 1
- Company name: `heading-sm` (16px/600), `#111827`, flex-1, `numberOfLines={1}` (truncate)
- "OPEN" badge (if `isOpenNow`): `radius-xs` (4px), `#F0FDF4` bg, `#22C55E` text, `label-sm` (11px/500), 4px vertical 6px horizontal padding, no wrap, align right

### Row 2 (4px top margin)
- `map-marker` icon 14px `#9CA3AF` + address text: `body-sm` (12px/400), `#6B7280`, `numberOfLines={1}`, flex-1

### Row 3 (4px top margin)
- ⭐ star emoji or filled star icon 12px `#FBBF24`
- Rating: `body-sm`, `#374151`, bold, `numberOfLines={1}`
- Review count: `body-sm`, `#9CA3AF` — "(127)"
- "·" separator: `body-sm`, `#9CA3AF`
- Distance: `body-sm`, `#6B7280` — "1.4 km" (hidden if `distanceKm` is null)
- "Not rated yet": shown instead of stars when `reviewCount < 3` (PRD §11.2)

### Row 4 (8px top margin)
- "X pitches" chip:
  - `#F5F5F5` bg, `#374151` text, `label-sm`, `radius-full`, 4px vertical 8px horizontal padding
- "from **XX RON**/h": `body-sm`, `#15803D` (`primary-700`), right-aligned (push with flex-1 on chip)
  - "XX RON" in bold (use `<Text style={{ fontWeight: '700' }}>`)

## CompanyCardSkeleton
Shows while companies loading (4 skeletons rendered).
- Same container shape as CompanyCard (same padding, radius, shadow)
- Logo: 56×56 `SkeletonBox`
- Row 1: `SkeletonBox` height 16, width 60%
- Row 2: `SkeletonBox` height 12, width 80%
- Row 3: `SkeletonBox` height 12, width 50%
- Row 4: `SkeletonBox` height 12, width 40%

### SkeletonBox (reusable)
```typescript
// Shimmer animation using Animated.loop + interpolation
const shimmer = useRef(new Animated.Value(0)).current
useEffect(() => {
  Animated.loop(
    Animated.timing(shimmer, { toValue: 1, duration: 1500, useNativeDriver: true })
  ).start()
}, [])
const translateX = shimmer.interpolate({
  inputRange: [0, 1],
  outputRange: [-width, width],
})
// Renders: <View style={[style, { backgroundColor: '#F5F5F5', overflow: 'hidden' }]}>
//            <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle, { transform: [{ translateX }] }]} />
//          </View>
```

## EmptyState (reusable, UIUX_SPEC §2.7)
Props: `illustration`, `title`, `description`, `ctaLabel?`, `onCta?`
- Centered vertically + horizontally in container
- Illustration: 120×120px SVG (passed as prop)
- Title: `heading-md` (18px/600), `#111827`, 16px top
- Description: `body-md` (14px/400), `#6B7280`, 8px top, max 240px wide, centered
- CTA button: `secondary` variant, `md` size, 20px top (optional)

**Discover-specific empty state:**
- Illustration: magnifying glass with sad face SVG
- Title: "No pitches found in {city}"
- Description: "Try changing your filters or selecting a different city"
- CTA: "Clear filters" → clears all filters in discoverStore

## ErrorState (reusable)
Props: `onRetry`
- Illustration: broken connection SVG
- Title: "Couldn't load pitches"
- Description: "Check your connection and try again"
- CTA: "Retry" → `primary` button → calls `onRetry`

## Acceptance Criteria
- [ ] CompanyCard renders all 4 rows with correct style
- [ ] `isOpenNow: true` shows green "OPEN" badge top-right; `false` hides it
- [ ] `distanceKm: null` hides distance text (no "null km" shown)
- [ ] `reviewCount < 3` shows "Not rated yet" instead of stars
- [ ] `numberOfLines={1}` truncates long company names with ellipsis
- [ ] Logo fallback: shows grey square + building icon when `logoUrl` is null
- [ ] 4 skeleton cards render during loading (shimmer animating)
- [ ] Shimmer animation runs smoothly (60fps, `useNativeDriver: true`)
- [ ] EmptyState rendered when `companies.length === 0` and not loading
- [ ] ErrorState rendered when API call fails
- [ ] "Clear filters" in EmptyState resets all filters and re-fetches

## Definition of done
- [ ] Rendered with mock data matching all spec variants
- [ ] Tested on iPhone SE (small screen) and iPhone Pro Max (large screen)
- [ ] No layout overflow or clipping at any screen size
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-discover","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E03-06 — Filters bottom sheet
# ─────────────────────────────────────────────────────────────────────────────
title="[E03-06] [Mobile] Filters bottom sheet — surface, size, amenities, price range, availability"
read -r -d '' body << 'BODY' || true
## Summary
Build the Filters bottom sheet opened from the header filter icon. Contains all filter controls from PRD §7.2: surface type chips, pitch size chips, amenity multi-select grid, price range slider, and availability toggles. Footer shows live result count.

## Reference
- UIUX_SPEC §5.4
- PRD §7.2 (Filtering section)

## Files to create
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/discover/FiltersSheet.tsx` | Bottom sheet with all filters |
| `apps/mobile/src/components/filters/FilterChip.tsx` | Multi-select chip (reusable) |
| `apps/mobile/src/components/filters/RangeSlider.tsx` | Price range slider |
| `apps/mobile/src/components/filters/FilterSection.tsx` | Section label + content wrapper |

## Presentation
- Opens from bottom, 80% screen height
- Drag handle: 32×4px `#D1D5DB`, `radius-full`, centered, 8px from top
- Top corners: `radius-lg` (16px)
- Backdrop: `rgba(0,0,0,0.4)` — tap to close (without applying changes? No — changes apply immediately as user selects)
- `shadow-xl`

## Header (UIUX_SPEC §5.4)
- Height: 56px
- "Filters" — `heading-md` (18px/600), `#111827`, left, 16px margin
- "Reset all" — `label-md` (13px/500), `#16A34A`, right, 16px margin, 44×44px target
  - On tap: reset all filter state to defaults, re-fetch

## Scrollable content (below header, above footer)

### Section: "Surface type"
- Row of 3 chips: "Natural grass" | "Artificial" | "Futsal"
- Multi-select: each chip independently toggled
- Chip style (UIUX_SPEC §2.7):
  - Unselected: `#F5F5F5` bg, `#374151` text
  - Selected: `#DCFCE7` bg, `#15803D` text, 1px `#16A34A` border
  - Height: 28px, `radius-full`, 6px vertical 10px horizontal padding
  - Font: `label-md` (13px/500)
- Surface-specific colours when selected (UIUX_SPEC §2.7):
  - Natural grass: `#F0FDF4` bg, `#15803D` text
  - Artificial: `#EFF6FF` bg, `#1D4ED8` text
  - Futsal: `#FEF3C7` bg, `#92400E` text

### Section: "Pitch size"
- Row of 3 chips: "5v5" | "7v7" | "11v11"
- Same multi-select chip style (no special colours)

### Section: "Amenities"
- 2-column grid, `gap: 8`
- Each cell: `FilterChip` with icon + label
- Amenity chips with icons (MaterialCommunityIcons):

| Amenity | Icon |
|---|---|
| Showers | `shower` |
| Changing rooms | `locker-room` |
| Parking | `parking` |
| Night lighting | `stadium-outline` |
| Ball rental | `soccer` |
| Refreshments | `food` |
| Lockers | `lock-outline` |
| Referee | `whistle` |
| First aid | `medical-bag` |
| Wi-Fi | `wifi` |
| Wheelchair | `wheelchair-accessibility` |

- Chip layout: icon 16px (left) + label text, height 36px
- Multi-select, same selected style as above

### Section: "Price per hour"
- Label row: "Price per hour" (section header) + current range label: "50 – 200 RON" (right aligned, `label-md`, `#111827`)
- Range slider below:
  - Two handles (min, max)
  - Track between handles: `#16A34A` fill
  - Track outside: `#E5E7EB`
  - Handle: white circle 24px, `shadow-sm`, `#16A34A` border 2px
  - Min: 20 RON, Max: 500 RON, step: 10
  - Below slider: "20 RON" (left) and "500 RON" (right), `label-md`, `#6B7280`
- Use `@react-native-community/slider` or custom twin-slider

### Section: "Availability"
- Two toggle rows:
  1. "Available now" — `Switch` component, right aligned
  2. "Open now" — `Switch`, right aligned
- Each row: 56px height, `body-md` `#111827` label left, `Switch` right
- Switch on-colour: `#16A34A`; off-colour: `#D1D5DB`

### Section spacing
- 24px top padding before each section label
- Section label: `heading-sm` (16px/600), `#111827`, 12px bottom padding
- 1px `#F5F5F5` divider between sections

## Footer (fixed at bottom of sheet)
- Height: 72px (12px padding top + 48px button + 12px padding bottom + safe area)
- Background: white, 1px `#E5E7EB` top border
- "Show X results" — `primary` button, full width, 16px horizontal margin
  - X updates live as filters change (call `GET /companies?...&countOnly=true` with 500ms debounce)
  - Or: optimistic count from current list (simpler for v1.0 — just show "Show results" without exact count)
  - On press: close sheet, apply filters, trigger company list refetch

## Filter state in discoverStore
```typescript
interface FilterState {
  surfaces: SurfaceType[]
  sizes: PitchSize[]
  amenities: AmenityType[]
  priceMin: number | null
  priceMax: number | null
  availableNow: boolean
  openNow: boolean
}
```
Filters persist while the sheet is open. Closing with X or backdrop = apply. "Reset all" = clear all.

## Active filters badge
When any filter deviates from default (empty arrays, no price range, toggles off): show `#16A34A` dot on filter icon in header (logic in DiscoverScreen, passed via store derived state).

## Acceptance Criteria
- [ ] Sheet slides up 80% screen height with drag handle
- [ ] Backdrop tap closes sheet with filters applied
- [ ] Surface type chips: multi-select, correct per-type colours when selected
- [ ] Pitch size chips: multi-select, neutral selected colours
- [ ] Amenity chips: 2-column grid, icon + label, correct icons for each amenity
- [ ] Price range slider: both handles draggable, track fills correctly, label updates live
- [ ] "Available now" and "Open now" toggles work independently
- [ ] "Reset all" clears all selections to defaults
- [ ] Filter changes reflected in API params on close
- [ ] Filter icon in header shows dot when any filter active
- [ ] Scrollable content doesn't clip behind footer
- [ ] Safe area respected at bottom

## Definition of done
- [ ] All filter combinations tested with real API
- [ ] Range slider tested at min/max limits (handles don't cross)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-discover","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E03-07 — Map view
# ─────────────────────────────────────────────────────────────────────────────
title="[E03-07] [Mobile] Map view — react-native-maps with custom pin markers and company preview sheet"
read -r -d '' body << 'BODY' || true
## Summary
Build the map view for Discover: full-screen `react-native-maps` with custom price-pill markers for each company, clustering when zoomed out, company preview bottom sheet on marker tap, and "my location" button.

## Reference
- UIUX_SPEC §5.2

## Libraries
- `react-native-maps` — MapView, Marker, Callout
- `react-native-map-clustering` (wraps MapView) — for marker clustering

## Files to create
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/discover/DiscoverMapView.tsx` | Map view component |
| `apps/mobile/src/components/discover/MapMarker.tsx` | Custom price-pill marker |
| `apps/mobile/src/components/discover/MapCompanySheet.tsx` | Company preview bottom sheet |

## MapView setup (UIUX_SPEC §5.2)
```typescript
<MapView
  style={StyleSheet.absoluteFill}
  provider={PROVIDER_GOOGLE}  // Google Maps on both platforms
  mapType="standard"
  initialRegion={initialRegion}
  showsUserLocation={true}
  showsMyLocationButton={false}  // custom button instead
  onPress={() => setSelectedCompany(null)}  // dismiss sheet on map tap
/>
```

**Initial region:** if `userCoords` set → center on user (zoom ~12km radius). Else → center on city coordinates (hardcoded lat/lng per city in `packages/shared/src/constants/cities.ts`).

## Custom marker (MapMarker, UIUX_SPEC §5.2)

### Unselected state
- White pill (`radius-full`), `shadow-md`
- Padding: 6px 12px
- Text: "from 60 RON" — `label-md` (13px/500), `#111827`

### Selected state (company tapped)
- `#16A34A` (`primary-600`) bg, white text
- Scale: 1.1× (via `Animated.spring`)

### Implementation
```typescript
// Custom marker using Marker + custom view (not Callout)
<Marker
  key={company.id}
  coordinate={{ latitude: company.lat, longitude: company.lng }}
  onPress={() => handleMarkerPress(company)}
  tracksViewChanges={false}  // important: prevents flicker
>
  <MapMarker
    priceFrom={company.priceFrom}
    isSelected={selectedCompany?.id === company.id}
  />
</Marker>
```

**Note:** `tracksViewChanges={false}` is critical for performance — without it, all markers re-render on every frame.

## Clustering
Wrap MapView with `react-native-map-clustering`'s `MapView` (drop-in replacement):
```typescript
import MapView from 'react-native-map-clustering'
```
- Cluster: grey circle, count text, `shadow-sm`
  - Small cluster (2–5): 32px diameter, `#6B7280` bg, white text
  - Medium (6–20): 40px diameter
  - Large (>20): 48px diameter
- Tap cluster: zoom in to show individual markers

## Company preview bottom sheet (UIUX_SPEC §5.2)
Slides up 200px from bottom when marker tapped. Disappears when map tapped or dragged down.

### Layout
- Height: 200px
- Drag handle: 32×4px centered, 8px top
- No shadow on card (shadow on sheet container)
- Company card: same content as CompanyCard from E03-05 but without outer shadow/border
  - Logo + name + address + rating + distance + "from XX RON/h"
- "View company" button: `primary` variant, `md` size (40px), full width, 12px horizontal margin, 12px bottom margin
  - Navigates to CompanyDetail screen

### Animation
- Slide up: `Animated.spring` from `translateY: 200` → `0`, `damping: 20`, `stiffness: 300`
- Slide down (dismiss): `Animated.timing`, 200ms
- Mount/unmount via conditional render + animation in `useEffect`

## "My location" button
- Position: absolute, bottom: `sheetHeight + 56px`, right: 16px (shifts up when sheet visible)
- Size: 40×40px, white bg, `radius-full`, `shadow-md`
- `crosshairs-gps` icon 20px `#16A34A`
- On tap:
  1. If `userCoords` available: animate map to user location (`mapRef.current?.animateToRegion(...)`)
  2. If not: call `requestAndDetect()` from useLocation hook

## Data source
Map view shares same data from `useCompanies` hook — no separate API call. Requires `lat`/`lng` on each company (stored in `Company` model from E01-02). Filter by current `selectedCity` and active filters.

## Acceptance Criteria
- [ ] Map fills full screen (behind tab bar — map should extend below tab bar with bottom content inset)
- [ ] Google Maps tiles load (PROVIDER_GOOGLE configured)
- [ ] Each company shown as a price-pill marker at correct coordinates
- [ ] Tapping marker: marker turns green + scales up, preview sheet slides up
- [ ] Preview sheet: company info + "View company" button
- [ ] "View company" navigates to CompanyDetail
- [ ] Tapping map (not a marker): sheet slides down, marker deselects
- [ ] "My location" button animates map to user position
- [ ] Clusters shown when ≥ 2 markers overlap; tap to zoom in
- [ ] `tracksViewChanges={false}` on all markers (no flicker)
- [ ] Map → list toggle (from E03-04) switches view without remounting map

## Edge cases
- Company with no `lat`/`lng` in DB (data error): exclude from map silently (do not crash)
- 0 companies in city: empty map with city center shown, no markers
- Very fast marker tap spam: debounce sheet animation by 100ms

## Definition of done
- [ ] Tested on iOS (Apple Maps fallback: `PROVIDER_DEFAULT` if Google not configured) and Android
- [ ] Clustering verified with ≥ 10 markers
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-discover","priority: medium","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E03-08 — Web Discover page
# ─────────────────────────────────────────────────────────────────────────────
title="[E03-08] [Web] Player Discover page — company grid, filter sidebar, map toggle"
read -r -d '' body << 'BODY' || true
## Summary
Build the player-facing web Discover page at `/discover`. Responsive layout: filter sidebar (desktop) or filter drawer (mobile web), company card grid, search, sort, and map/list toggle. Web players use the same backend API as mobile.

## Reference
- UIUX_SPEC §5 (mobile spec for content reference — adapt to web layout)
- PRD §5.3 (Web app — Player, same domain, different route prefix)
- PRD §7.1–7.2

## Files to create
| File | Purpose |
|---|---|
| `apps/web/src/app/(player)/discover/page.tsx` | Discover page (Server Component) |
| `apps/web/src/app/(player)/discover/DiscoverClient.tsx` | Client component (search, filters, state) |
| `apps/web/src/components/discover/CompanyCard.tsx` | Web company card |
| `apps/web/src/components/discover/FilterSidebar.tsx` | Left sidebar filters (desktop) |
| `apps/web/src/components/discover/MapView.tsx` | Google Maps JS API map |
| `apps/web/src/app/(player)/layout.tsx` | Player layout (no manager sidebar) |

## Page layout

### Desktop (≥ 1024px)
```
[Topnav — fixed]
[City banner — full width]
┌─────────────────────────────────────────┐
│ FilterSidebar (280px) │ Main content     │
│                       │ Search + Sort    │
│                       │ Map/List toggle  │
│                       │ Company grid     │
│                       │ Pagination       │
└─────────────────────────────────────────┘
```

### Mobile web (< 1024px)
- No sidebar — "Filters" button opens a slide-in drawer or modal
- Companies in single column

## Top navigation bar
- Height: 64px, white bg, `shadow-xs`, sticky top
- Left: "PitchUp" logo/wordmark, `#16A34A`
- Right: "Sign in" link + "Register" `primary` button (if not authenticated)
- If authenticated: avatar + dropdown (Profile, My Bookings, Logout)

## City banner
- Full width below nav
- `#FAFAFA` bg, 16px vertical padding, 1280px max-width centred
- "Showing pitches in **Cluj-Napoca**" — `body-lg`, `#374151`
- "Change" link `#16A34A`
- Clicking "Change" opens city selector modal (same cities as mobile, shadcn/ui `Dialog`)

## FilterSidebar (desktop)
Sticky left column, 280px wide.

**Sections** (same filters as mobile, adapted for web):
- "Surface type" — 3 checkboxes (Tailwind `Checkbox` from shadcn/ui)
- "Pitch size" — 3 checkboxes
- "Amenities" — list of checkboxes with icons
- "Price range" — shadcn/ui `Slider` component (range)
- "Availability" — shadcn/ui `Switch` for "Available now" + "Open now"
- "Sort by" — shadcn/ui `Select` dropdown: Nearest | Top rated | Lowest price | Newest

**Reset button:** "Reset all filters" text link at top of sidebar, `#EF4444`.

## Main content area

### Search bar
- Shadcn/ui `Input` with search icon, full width, 40px height
- Placeholder: "Search companies..."
- Debounced 300ms

### Map/List toggle
- Segmented control (shadcn/ui tabs or custom): "List" | "Map"
- List view: company grid
- Map view: Google Maps

### Company grid (list view)
- CSS Grid: `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3`, `gap-4`
- Each card: white bg, `shadow-sm`, `rounded-xl`, `p-4`
- Card content same as mobile CompanyCard (logo, name, address, rating, distance, pitches count, price)
- Hover: `shadow-md` transition
- Click: navigate to `/discover/[companyId]`

### Loading state
- Skeleton grid (same count as page size, grey shimmer boxes via Tailwind `animate-pulse`)

### Pagination
- "Load more" button at bottom: `secondary` button, centered
- Or: infinite scroll using Intersection Observer

### Map view (Google Maps JS API)
```typescript
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
```
- Same marker style as mobile: price pill per company
- Clicking marker: sidebar-style info card or map callout

## URL-based filter state
Filters synced to URL search params (`useSearchParams`, `useRouter`):
- `?city=Cluj-Napoca&sort=rating&surface=FUTSAL&priceMax=200`
- Allows shareable filtered URLs
- On page load: read params → initialize filter state → fetch

```typescript
// DiscoverClient.tsx
const searchParams = useSearchParams()
const city = searchParams.get('city') ?? 'Cluj-Napoca'
const sort  = searchParams.get('sort') ?? 'rating'
```

## City detection (web)
- Browser Geolocation API: `navigator.geolocation.getCurrentPosition()`
- On grant: Google Geocoding API fetch → nearest known city
- On deny: show city selector dialog
- Persist in `localStorage`

## TanStack Query (web)
```typescript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['companies', { city, sort, ...filters }],
  queryFn: ({ pageParam }) => fetchCompanies({ city, sort, ...filters, cursor: pageParam }),
  getNextPageParam: last => last.nextCursor,
})
```

## Acceptance Criteria
- [ ] Page renders at `/discover`
- [ ] City banner shows selected city, "Change" opens city dialog
- [ ] Filter sidebar visible on ≥ 1024px; drawer on < 1024px
- [ ] Checkbox filters update company grid without page reload
- [ ] Price range slider updates API call with `priceMin`/`priceMax`
- [ ] Sort select changes order of results
- [ ] Search debounces 300ms
- [ ] Map/list toggle switches view
- [ ] Google Maps loads with company markers
- [ ] Filter state reflected in URL params (shareable URL)
- [ ] Company card click navigates to `/discover/[id]`
- [ ] Responsive: single column on mobile web, 3-col grid on large desktop

## Definition of done
- [ ] Tested on Chrome desktop + Chrome mobile view
- [ ] Lighthouse performance score ≥ 80 on desktop
- [ ] Filters + search produce correct API calls (verified in Network tab)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: player-discover","priority: medium","type: frontend-web"]' \
  "$MILESTONE"

echo ""
echo "✓ E03 — Player: Discover: 8 issues created"
BODY
