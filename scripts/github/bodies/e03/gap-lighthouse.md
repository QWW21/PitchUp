E03-08's definition of done asks for a Lighthouse performance score of at least 80 on desktop for `/discover`. It was not measured.

What is known: the production build reports 178 kB first-load JS for `/discover` (103 kB shared). The page is a server shell with a client component that fetches after hydration, and the Google Maps script only loads when the map view is opened.

To do: run Lighthouse (desktop) against `pnpm build && pnpm start` with a seeded database, record the score here, and fix whatever keeps it under 80. Likely candidates if it is low: the client-side first fetch (could be prefetched on the server from the URL params) and layout shift from the skeleton grid.
