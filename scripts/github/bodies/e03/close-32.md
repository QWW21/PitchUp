Implemented in d276ee4.

**Built:**

- `app/(player)/layout.tsx` — player layout with a top nav: wordmark, Sign in / Register when signed out, avatar menu (Profile, My Bookings, Logout) when signed in.
- `app/(player)/discover/page.tsx` + `DiscoverClient.tsx` — city banner, search (300ms debounce), list/map toggle, result count, skeleton grid, empty and error states, "Load more".
- `components/discover/FilterSidebar.tsx` — sort select, surface, size, amenity checkboxes with Lucide icons, price range, Available now / Open now. Sticky 280px sidebar at ≥1024px, slide-in drawer below with a "Show X results" button.
- `components/discover/CityDialog.tsx` — searchable, diacritic-insensitive city picker with a "Detect my location" row. Not dismissible until a city is chosen.
- `components/discover/MapView.tsx` — Google Maps, a price pill per company, preview card with "View company".
- `lib/discover/url-state.ts` — every filter lives in the URL: `?city=Cluj-Napoca&sort=price&surface=FUTSAL&amenity=showers&priceMax=200&view=map`.

**Verified in a browser** against a seeded database: filters and search update the URL and the grid; one request per search after the debounce; Reset; city dialog search and selection persisted to `localStorage`; first visit with location denied opens the dialog; empty state; drawer and single column at 375px with no horizontal scroll; map loads real Google tiles, pill click selects and opens the preview, map click dismisses. `next build` passes.

**Deviations:**

- **No shadcn/ui.** The app has no shadcn setup; the components match the existing Tailwind ones in `components/ui`. The price slider is two native range inputs, which keeps keyboard and screen-reader support.
- **City detection** snaps the browser position to the nearest supported city instead of calling Google Geocoding. No extra API, works offline, and suburbs resolve to their city.
- **Coordinates are not in the URL**, so a shared link does not carry the sender's location. Amenities use readable keys (`amenity=showers`) in the URL and are expanded to enum values for the API.
- **"Load more" button** rather than infinite scroll (the ticket allows either).
- **`/discover/[companyId]` is a placeholder** until E04.
- **Map pills attach their click listener natively.** Google Maps stops events inside its panes before they reach React's root listener, so `onClick` never fired; found and fixed during testing, filed separately.

**Not done from the definition of done:** Lighthouse was not run (filed as a follow-up). Tested in Chromium desktop and 375px emulation, not on a physical phone.
