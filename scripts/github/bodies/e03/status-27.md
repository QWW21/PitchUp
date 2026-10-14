**Built in d276ee4 — awaiting mobile testing.** Compiles and bundles; not run on a device. Leaving open for the mobile tester.

**Built:** `src/screens/discover/CitySelector.tsx` — full-screen `Modal` (slide), 56px header with close, search field, "Detect my location" row with inline spinner and deny/error messages, ROMANIA section header, city + county rows with a check on the selected one, empty-search message. Selecting a city writes the store and AsyncStorage and closes.

Search strips diacritics with the shared `foldForSearch()`, so "timis" matches Timișoara and the web dialog behaves identically.

**To test:** open from the banner and from CityBlocker; close leaves the city unchanged; "timis" → Timișoara; selected row shows the check; pick a city → banner updates; relaunch → same city; detect row with permission denied shows the message.
