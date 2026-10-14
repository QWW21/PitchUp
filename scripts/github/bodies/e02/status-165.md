**Web half done in e396f41.** Leaving this open for the mobile screen.

`/reset-password?token=…` now exists. It checks the token's shape before showing the form, so a truncated link goes straight to "Request a new link"; validates the new password with the shared `passwordSchema` and a confirm field; and on an expired, used or unknown token shows the API's message with the same "Request a new link" action.

**Verified in a browser on a production build:** malformed link, weak password, mismatched confirm, successful change, the same link used a second time (rejected), old password rejected at login, new password accepted.

**Still to do (mobile):** a screen that takes the token and calls `authApi.resetPassword()`, plus a decision on how the emailed link reaches the app — a deep link, or pasting the token.

**Related gap, not in this ticket:** a reset revokes mobile refresh tokens, but web sessions are stateless JWT cookies and stay valid until they expire. Recorded in docs/HANDOVER.md.
