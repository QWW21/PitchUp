Split out of E02-03 (#13), which closed without it.

`RegisterStep2Screen.tsx` has no Terms of Service checkbox, no link to the terms, and the register payload carries no `acceptedTerms` field. Nothing in the app records that a user agreed to anything.

This is a legal requirement rather than a UI nicety, so it should not sit behind feature work.

Needs:

- a checkbox on registration step 2, unchecked by default, blocking submit until ticked
- a link to the terms (the document itself does not exist yet either)
- the acceptance persisted — at minimum a timestamp and the version agreed to, so it is provable later
