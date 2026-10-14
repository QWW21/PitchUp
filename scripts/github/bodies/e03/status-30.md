**Built in d276ee4 — awaiting mobile testing.** Compiles and bundles; not run on a device. Leaving open for the mobile tester.

**Built:** `screens/discover/FiltersSheet.tsx`, `components/filters/FilterChip.tsx`, `FilterSection.tsx`, `RangeSlider.tsx`. 80% height sheet, drag handle (drag down to close), Reset all, surface chips with per-surface colours, size chips, two-column amenity grid with icons, price slider 20–500 step 10, two switches, fixed footer respecting the safe area.

**Deviations:**

- **The sheet edits a draft, applied however it closes** (button, backdrop, drag, back). The ticket asks for both "changes apply immediately" and "reflected in API params on close"; applying on close means one refetch instead of one per tap.
- **"Show X results" is a live count**: the draft is sent with `limit=1` after a 500ms pause and the button reads `total`. No `countOnly` parameter was needed.
- **Twin-thumb slider is built on PanResponder**, not a library — the slider packages are single-value or need native code, and the pinned RN 0.76 tree has been fragile about native additions. Thumbs stop one step apart and cannot cross.
- **Amenity icons:** `hanger` for changing rooms and `stadium` for night lighting; `locker-room` and `stadium-outline` do not exist in the installed icon set.

**To test:** every filter against the API, slider at both limits, Reset all, badge on the header icon, nothing hidden behind the footer, bottom safe area.
