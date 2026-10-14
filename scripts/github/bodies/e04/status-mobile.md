**Built in e867add — awaiting mobile testing.** Typecheck, lint and the Metro bundle pass; nothing has been run on a device. Leaving open for the mobile tester. The screens use `GET /companies/:id`, `GET /pitches/:id`, `/availability` and `/reviews`, which are verified (`scripts/verify-e04.ts`).

What is in place, across E04-04 … E04-07:

- **Company Detail** (`screens/discover/CompanyDetailScreen.tsx`): collapsing header (transparent → white, title fades in 50–100px, back/share with discs), hero image (the first pitch's cover — companies have no cover image), logo/name/verified, address → maps, phone → dialer, rating, hours accordion with today bold, sticky Pitches | Reviews tabs, pitch cards, skeleton and error states.
- **Pitch Detail** (`screens/discover/PitchDetailScreen.tsx`): paging gallery with counter, fullscreen lightbox, name/surface/size, company link, description clamped at 4 lines with Show more only when it overflows, all 14 amenities, pricing card, 7-day availability with pulsing loading dots, two-review preview with "See all" (opens Company Detail on Reviews, filtered to the pitch), Book Now footer.
- **Reviews**: breakdown with animated bars, review cards (initials / anonymous "?" / manager reply / photo strip), infinite scroll within 300px of the end.
- **Book Now / availability day** → `BookingFlow` route (placeholder until E05) with the pitch and date.

**Deviations:**

- Lightbox pinch-zoom (1×–4×) is **iOS only**; Android zoom and double-tap need react-native-gesture-handler and reanimated, not installed.
- Tabs switch **on tap**, not swipe (no pager library).
- No "Sign in to book" state: the app's screens are all behind sign-in.
- Icons `locker-room` and `stadium-outline` do not exist in the installed set; `hanger` and `stadium` are used.
- Deep links (`/discover/:companyId`) are not configured.
- `useCompany`, `usePitch`, `useReviews` and the 7-day query live together in `hooks/useVenue.ts`.

**Related backend fix in the same commit:** the app's Bearer token was ignored by `requireAuth`, so `/me` always failed and `checkSession` signed the user out on every launch. Fixed and verified with a real token; `/me` now also returns `trustScore` for the "Account restricted" state.
