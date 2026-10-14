Split out of E02-01 (#11), which closed with a stand-in.

What exists is an `ActivityIndicator` on a white background in `App.tsx:98-103`, shown while the session check and the onboarding flag read resolve. It prevents a white flash, which was the functional requirement, but it is not the specified screen.

The original ticket asks for: fullscreen, no status bar, green background, white logo centred, a 1.2s hold and a 0.3s fade before navigating.

Worth deciding whether that is still wanted before building it — a branded splash that holds for a fixed 1.5s is a deliberate delay on every cold start, and the current behaviour is "as fast as the reads allow".
