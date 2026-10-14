Implemented in 7e5e894.

**Built:** `OnboardingScreen.tsx` — 3 slides on a paged `FlatList`, dot indicators, Skip and Next/Get Started, and an AsyncStorage flag (`onboardingSeen`) written on both skip and completion so the flow never repeats. `App.tsx` reads that flag on mount in parallel with `checkSession()` and picks `Onboarding` or `Login` as the initial route. Verified on a Pixel 9 Pro XL emulator: the onboarding screen renders and the dot indicator tracks the active slide.

**Not built — the splash screen.** The ticket specifies a fullscreen green splash with a centred white logo, a 1.2s wait and a 0.3s fade. What exists is a plain `ActivityIndicator` on a white background (`App.tsx:98-103`), shown only for as long as the session check and the AsyncStorage read actually take. It fills the same role — nothing flashes white, and the app does not render until both reads resolve — but it is not the specified screen. Tracked separately.

**Also not verified:** accessibility font scaling, and the iOS half of "no crash on iOS or Android" — iOS has never built. See the handover doc.

The AsyncStorage key is `onboardingSeen`, not `onboarding_seen` as the ticket says.
