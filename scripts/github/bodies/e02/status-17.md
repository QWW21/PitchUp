**Status: blocked, staying open.**

7e5e894 added `SocialLoginScreen.tsx`, but it is a placeholder: a "coming soon" panel with a back link. It is wired into the navigator and the Login screen's "Continue with Google" button routes to it, so the navigation path exists and nothing dead-ends.

None of the actual work is done. Still outstanding:

- `@react-native-google-signin/google-signin` is not installed.
- No native configuration — `GoogleService-Info.plist`, `google-services.json`, OAuth client IDs.
- No Apple Sign-In button, so nothing is hidden behind `Platform.OS` on Android (noted on E02-05, which closed without it).
- No backend token-exchange endpoint for either provider.
- No `SocialCompleteProfileScreen` for the first-login phone + city step.

The blocker is credentials, not code. This is the only E02 ticket not implemented.
