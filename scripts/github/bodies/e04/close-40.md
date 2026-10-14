Implemented in e867add.

- `/discover/[companyId]` — server-rendered from the same service as the API: hero (logo, verified badge, address → Google Maps, phone, website, rating), working hours with today's status and the week, description; Pitches | Reviews tabs kept in the URL (`?tab=reviews&pitch=…`), pitch grid, rating breakdown with paged reviews and a per-pitch filter.
- `/discover/[companyId]/[pitchId]` — gallery (main image, thumbnails, arrows, "3 / 8") with a fullscreen lightbox (←/→/Esc), header, collapsible description (clamped only when it overflows), all 14 amenities, pricing with peak windows and shirt rental, two-review preview with "See all"; Book Now panel with a 7-day availability strip, sticky beside the gallery on desktop and full width below it on small screens.
- Book Now → `/booking/new?pitchId=…` (placeholder until E05); signed out → "Sign in to book" → `/login?callbackUrl=…`; inactive pitch → "Not available"; Suspended trust tier → "Account restricted".
- Per-page `<title>`, description and Open Graph image; pending/unknown → 404 page; a pitch under the wrong company redirects to its real URL.

**Verified in a browser** on a production build at 1280px and 375px (no horizontal scroll): SSR content and metadata, hours accordion, reviews tab and paging (10 → 14), "See all reviews" landing filtered, gallery/thumbnails/lightbox/keys, 7-day dots matching seeded data (full day, maintenance closure), closed-day message, Book Now signed in and signed out through login back to the booking page, restricted and inactive states, 404s.

**Deviations:** no shadcn/ui (plain Tailwind, as in E03); gallery and lightbox built in place rather than with a library; `callbackUrl` instead of `redirect`.

**Not done:** Lighthouse SEO ≥ 90 was not measured (see the Lighthouse follow-up, #170).
