**Built in d276ee4 — awaiting mobile testing.** Compiles; the Android APK builds with the Maps key; not run on a device. Leaving open for the mobile tester.

**Built:** `screens/discover/DiscoverMapView.tsx`, `components/discover/MapMarker.tsx` (price pill + cluster bubble), `components/discover/MapCompanySheet.tsx` (200px spring-in preview, drag down to dismiss, "View company"). My-location button moves up with the sheet. Uses the same `useCompanies` data as the list.

**Deviations:**

- **Clustering with `supercluster` directly**, not `react-native-map-clustering`, which wraps MapView and lags behind react-native-maps; the pinned maps version already needs patches on RN 0.76. Cluster sizes 32/40/48px as specified; tap zooms to the expansion level.
- **Selected marker is not spring-animated.** With `tracksViewChanges={false}` (required by the ticket) Android snapshots each marker once, so an animation would never show. Selection re-mounts the marker at 1.1× in green.
- **Provider:** Google on Android, Apple Maps on iOS (the Google iOS SDK is not installed), as the ticket's DoD allows.
- **Maps key:** read at build time from `GOOGLE_MAPS_API_KEY` (environment or `~/.gradle/gradle.properties`); a placeholder is used without one so the SDK does not crash. See README "Maps".

**To test:** pills at the right places, selection, sheet up/down, map tap dismisses, my-location, clusters when zoomed out (≥10 markers in Cluj with the seed), list ↔ map without the map reloading.
