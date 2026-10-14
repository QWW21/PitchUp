**Built in d276ee4 — awaiting mobile testing.** Typecheck, lint, the Metro bundle and the Android debug APK all pass; nothing has been exercised on a device. Leaving this open for the mobile tester to verify against the acceptance criteria and close.

**Built:**

- `src/hooks/useLocation.ts` — `requestAndDetect()` returns `detected | denied | blocked | error`. Android asks for FINE and COARSE together and accepts either; "don't ask again" comes back as `blocked`. iOS uses `Geolocation.requestAuthorization`, so "restricted" is treated as denied. `getCurrentPosition` uses `timeout: 10000`, `maximumAge: 300000`, low accuracy. Nothing throws out of it.
- `src/stores/discoverStore.ts` (the ticket says `src/store/`; the existing folder is `src/stores/`) — `selectedCity` persisted under AsyncStorage `selected_city`, `userCoords`, plus the sort, search, view mode and filters state used by E03-04/06.
- `src/screens/discover/CityBlocker.tsx` — overlay on the Discover screen, with "Allow location in Settings" (`Linking.openSettings()`) when the permission is blocked.
- `AndroidManifest.xml` permissions; `Info.plist` usage string (it was empty).

**Deviations:**

- **No Google reverse geocoding.** The fix snaps to the nearest city in `CITIES` within 40 km (`nearestCity()` in `packages/shared/src/geo.ts`). The result has to be one of those cities anyway; this needs no key or network, and Florești resolves to Cluj-Napoca. Cities gained `lat`/`lng`.
- **`@react-native-community/geolocation`**, which was already installed, instead of `react-native-geolocation-service`.

**To test:** first launch → permission prompt; grant with the emulator at Cluj (`adb emu geo fix 23.59 46.77`) → banner shows Cluj-Napoca; deny → CityBlocker; "don't ask again" → Settings button; kill and relaunch → city kept; a position far from any city → CityBlocker.
