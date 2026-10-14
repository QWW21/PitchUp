E03 replaced the placeholder `HomeScreen` with Discover as the signed-in root. That screen held the app's only "Sign out" button, so there is currently no way to sign out on mobile short of clearing app data. Session expiry still works (`authEvents.emitUnauthorized()` → Login).

The real home for it is Profile → Settings → Logout (PRD §5.1, E08). If E08 is far off, a temporary entry point would help testing; otherwise this closes with E08.

`authStore.logout()` already does the work (revokes the refresh token server-side, clears the Keychain, flips navigation to the auth stack); only a button is missing.
