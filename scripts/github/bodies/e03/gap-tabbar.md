PRD §5.1 puts the signed-in mobile app in a four-tab bar: Discover, My Bookings, Notifications, Profile. No ticket in E01–E03 builds it, and E03 needed somewhere to live, so Discover is currently a plain stack screen and the root of the signed-in app (`AppStackParamList` in `App.tsx`).

Needed before E06 (My Bookings) at the latest:

- `@react-navigation/bottom-tabs` (compatible with `@react-navigation/native` 7 and the pinned `react-native-screens` 4.16.0 — check the version constraints in docs/HANDOVER.md first).
- Tabs per PRD §5.1, icons from MaterialCommunityIcons (24px per UIUX_SPEC §2.6).
- Discover moves into its tab; `CompanyDetail` and later detail screens stay on a stack above the tabs.
- The E03-07 map was asked to extend behind the tab bar with a bottom content inset; revisit `DiscoverMapView` when the bar exists.
