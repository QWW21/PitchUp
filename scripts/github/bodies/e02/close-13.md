Implemented in 7e5e894 as `RegisterStep2Screen.tsx`.

**Built:** three inputs — a birth-date entry validated by `isAtLeast16()`, a credential entry with the policy enforced client-side, and a confirmation of it. Submits via `authApi.register()` and navigates to the verification screen on success.

**Not built — Terms of Service acceptance.** The ticket names it in the title and there is no ToS checkbox, link, or `acceptedTerms` field anywhere in the screen or in the register payload. This is the one real gap in this ticket and it is a legal requirement, not a nice-to-have. Tracked separately.

**Deviation:** the city selector lives in step 1, not here — see E02-02.
