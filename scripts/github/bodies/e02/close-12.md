Implemented in 7e5e894 as `RegisterStep1Screen.tsx`.

**Built:** name, email, E.164 phone, and city — with per-field validation and a modal city picker over the 10 seeded Romanian cities. On submit the values are passed to step 2 through route params; nothing is sent to the API until step 2.

**Deviation — the field split does not match the ticket titles.** The ticket puts date of birth in step 1 and city in step 2. The implementation does the opposite: step 1 collects city, step 2 collects date of birth. The full set of fields across the two steps is the same, and the API call at the end is unchanged, so this is a UI ordering difference rather than a functional one. Flagged here because both ticket titles now describe the wrong screen.
