Found while building `/reset-password` (#165).

`resetPassword()` revokes every mobile refresh token, so a phone signed in by someone else is logged out when the owner resets the password. Web sessions are not: NextAuth uses the JWT strategy, the session is a signed cookie with no server-side record, and it stays valid until it expires. Someone who had the old password and signed in on the web keeps access after the reset.

**Suggested fix:** add `passwordChangedAt` (or an integer `tokenVersion`) to `User`; stamp it in `resetPassword()` and any future change-password path; put it in the JWT at sign-in; and in the `jwt` callback reject a token issued before it. One indexed read per session check.

Priority is a judgement call: it matters for account takeover recovery, which is exactly when someone resets a password.
