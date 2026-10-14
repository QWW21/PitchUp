**Built in d276ee4 — awaiting mobile testing.** Compiles and bundles; not run on a device. Leaving open for the mobile tester.

**Built:**

- `src/screens/discover/DiscoverScreen.tsx` — header with wordmark and `tune` button (green dot when filters are active), location banner, search with clear button (300ms debounce), sort chips, map/list toggle, list and map bodies.
- `src/screens/discover/DiscoverListView.tsx` — FlatList with pull-to-refresh, `onEndReached` paging at 0.3, footer spinner, empty/error states.
- `src/hooks/useCompanies.ts` — `useInfiniteQuery` keyed on the full query string, `staleTime` 2 min, disabled without a city.
- `App.tsx` — `QueryClientProvider`; Discover is the signed-in root route; `CompanyDetail` is a placeholder route until E04.

**Deviations:**

- **"Nearest" is hidden, not just unselected, without coordinates**, and the effective sort falls back to Top rated.
- **The map stays mounted once opened**, hidden behind the list, so toggling back does not reload tiles (E03-07 requirement).
- **The placeholder `HomeScreen` is removed.** The app now has no sign-out button until Profile (E08) — filed as a follow-up. `docs/TESTING_E02_MOBILE.md` now says Discover where it said Home.
- **No tab bar** — PRD §5.1 has one, no epic has built it yet; filed as a follow-up.

**To test:** ≥2 pages of results (seed has 13 in Cluj; use a smaller page size or more data), pull-to-refresh, one request per search after typing stops, sort chip changes the order, city change resets the list.
