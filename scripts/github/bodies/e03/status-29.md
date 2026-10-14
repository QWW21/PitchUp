**Built in d276ee4 — awaiting mobile testing.** Compiles and bundles; not run on a device. Leaving open for the mobile tester.

**Built:** `components/discover/CompanyCard.tsx`, `CompanyCardSkeleton.tsx`, `components/common/SkeletonBox.tsx` (shimmer on the native driver), `EmptyState.tsx`, `ErrorState.tsx`. Shadow tokens from UIUX_SPEC §2.5 added to `theme/tokens.ts`.

**Deviations:**

- **Icons instead of SVG illustrations** in the empty and error states (`magnify-close`, `wifi-off` at 64px): `react-native-svg` is not installed and UIUX_SPEC §2.6 sizes empty-state illustrations at 64px anyway.
- **Icons:** `react-native-vector-icons` (MaterialCommunityIcons) is now a dependency, as UIUX_SPEC §2.6 specifies; the font is wired into Android (`fonts.gradle`) and iOS (`UIAppFonts`).
- **"Clear filters" also clears the search**, since an empty result is as often caused by the search text.

**To test:** OPEN badge, "Not rated yet" below three reviews (Zorilor Sports has two), no distance without location, long names truncate, logo fallback (all seeded venues have no logo), skeletons while loading, error state with the server stopped, small and large screens.
