#!/usr/bin/env bash
# e08.sh — create all E08 Player: Profile issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E08 — Player: Profile")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E08 — Player: Profile' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E08 — Player: Profile)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E08-01 — Backend: GET /profile + PUT /profile
# ─────────────────────────────────────────────────────────────────────────────
title="[E08-01] [Backend] GET /profile + PUT /profile — player profile read and update"
read -r -d '' body << 'BODY' || true
## Summary
Implement profile read and update. `GET /profile` returns the current user's full profile. `PUT /profile` validates and updates name, phone, city, avatar URL. Email not updatable here.

## Reference
- PRD §6, §7
- UIUX_SPEC §10.1

## File to create
`apps/web/src/app/api/v1/profile/route.ts`

## GET /profile response
```json
{
  "data": {
    "id": "clxyz...",
    "fullName": "Ion Popescu",
    "email": "ion@example.com",
    "phone": "+40712345678",
    "city": "Cluj-Napoca",
    "avatarUrl": "https://res.cloudinary.com/...",
    "role": "PLAYER",
    "emailVerified": true,
    "phoneVerified": true,
    "trustScore": 87,
    "trustTier": "Good",
    "createdAt": "2026-01-15T10:00:00Z"
  },
  "error": null
}
```
Never return `stripeCustomerId`, `passwordHash`, or `refreshToken`.

## PUT /profile — schema
```typescript
// packages/shared/src/schemas/profile.ts
export const UpdateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  city: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});
```

## Validation
- `city` must be in `CITIES` list from `packages/shared`
- `avatarUrl` must start with `https://res.cloudinary.com/`
- Email and role not updateable via this endpoint

## Acceptance criteria
- [ ] GET requires auth (401 otherwise)
- [ ] GET strips `stripeCustomerId`, `passwordHash`, `refreshToken` from response
- [ ] PUT partial update — all fields optional
- [ ] City validated against CITIES list → 422 if invalid
- [ ] avatarUrl validated as Cloudinary domain → 422 if not
- [ ] Email field not updatable; role field not updatable

## Definition of done
- Integration test: update city to invalid value → 422
- Sensitive fields confirmed absent from GET response
BODY

create_issue "$title" "$body" '["E08 — Player: Profile","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E08-02 — Backend: GET /profile/trust-score
# ─────────────────────────────────────────────────────────────────────────────
title="[E08-02] [Backend] GET /profile/trust-score — score, tier, event history, booking restrictions"
read -r -d '' body << 'BODY' || true
## Summary
Expose trust score detail: current score, tier metadata, booking restrictions, and paginated event history. Used by Trust Score Detail screen. Tier enforcement at booking time (E05-07) depends on `deriveTier()` from `packages/shared`.

## Reference
- PRD §9.1

## File to create
`apps/web/src/app/api/v1/profile/trust-score/route.ts`

## Response
```json
{
  "data": {
    "score": 87,
    "tier": "Good",
    "tierDescription": "No restrictions.",
    "canBook": true,
    "maxConcurrentBookings": null,
    "requiresCreditCard": false,
    "events": [
      { "id": "...", "delta": -5, "reason": "LATE_CANCELLATION", "label": "Late cancellation", "bookingId": "...", "createdAt": "..." },
      { "id": "...", "delta": 2,  "reason": "BOOKING_COMPLETED",  "label": "Booking completed",  "bookingId": "...", "createdAt": "..." }
    ],
    "nextCursor": null,
    "hasMore": false,
    "tiers": [
      { "name": "Excellent", "range": "90–100", "description": "No restrictions. Book up to 4 slots.", "colour": "#16A34A" },
      { "name": "Good",      "range": "70–89",  "description": "No restrictions.",                    "colour": "#22C55E" },
      { "name": "Fair",      "range": "50–69",  "description": "Credit card on file required.",       "colour": "#F59E0B" },
      { "name": "Poor",      "range": "30–49",  "description": "Upfront deposit. Max 1 active booking.", "colour": "#EF4444" },
      { "name": "Suspended", "range": "< 30",   "description": "Booking suspended. Contact support.", "colour": "#7F1D1D" }
    ]
  }
}
```

## Tier derivation (packages/shared)
```typescript
export function deriveTier(score: number): TrustTier {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Suspended';
}

export const TIER_CONFIG: Record<TrustTier, { canBook: boolean; maxConcurrent: number | null; requiresCard: boolean }> = {
  Excellent: { canBook: true,  maxConcurrent: 4,    requiresCard: false },
  Good:      { canBook: true,  maxConcurrent: null, requiresCard: false },
  Fair:      { canBook: true,  maxConcurrent: null, requiresCard: true  },
  Poor:      { canBook: true,  maxConcurrent: 1,    requiresCard: true  },
  Suspended: { canBook: false, maxConcurrent: 0,    requiresCard: false },
};
```

## Acceptance criteria
- [ ] Requires auth
- [ ] `tier` derived from live `user.trustScore`
- [ ] Events cursor-paginated, newest first
- [ ] `tiers` static config always present in response
- [ ] Score exactly 30 → "Poor" (not Suspended); score 29 → "Suspended"
- [ ] `delta` negative values returned as negative integers

## Definition of done
- `deriveTier` unit tested at all 5 boundary values
- `TIER_CONFIG` exported from `packages/shared` (used by E05-07 booking guard)
BODY

create_issue "$title" "$body" '["E08 — Player: Profile","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E08-03 — Backend: change-password + account deletion
# ─────────────────────────────────────────────────────────────────────────────
title="[E08-03] [Backend] POST /profile/change-password + DELETE /profile — account management"
read -r -d '' body << 'BODY' || true
## Summary
Change password (requires current password, revokes all refresh tokens) and soft-delete account (password confirmation, cancels bookings, anonymises reviews).

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/profile/change-password/route.ts` | Create |
| `apps/web/src/app/api/v1/profile/route.ts` | Modify — add DELETE handler |

## POST /profile/change-password
```typescript
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

// 1. requireAuth
// 2. bcrypt.compare(currentPassword, user.passwordHash) → 401 if wrong
// 3. bcrypt.hash(newPassword, 12)
// 4. Prisma transaction: update passwordHash + deleteMany refreshTokens
// Rate limit: 5 attempts / 15 min / userId
```

## DELETE /profile (soft delete)
```typescript
const DeleteAccountSchema = z.object({
  password: z.string().min(1),
  reason: z.string().max(300).optional(),
});

// 1. requireAuth + verify password
// 2. user.deletedAt = now; user.email = `deleted_${id}@pitchup.deleted`; clear name/phone
// 3. Delete avatar from Cloudinary (call deleteImage from E01-10)
// 4. Revoke all refresh tokens
// 5. Cancel all PENDING/CONFIRMED bookings — full refund for each (override normal policy)
// 6. Anonymise reviews: review.userId = null (review rows preserved for pitch integrity)
// 7. Return 200
```

## Security
- `bcrypt.compare` — timing-safe (no early return on mismatch)
- Social-login users with no `passwordHash`: both endpoints return 400 `PASSWORD_NOT_SET`
- Change-password: rate limited 5 / 15 min to prevent brute force on locked sessions

## Acceptance criteria
- [ ] Change-password: 401 if current password wrong
- [ ] Change-password: new hash stored, all refresh tokens revoked
- [ ] Change-password: rate limited
- [ ] Delete: password verified before any mutation
- [ ] Delete: email obfuscated, personal data cleared
- [ ] Delete: all upcoming bookings cancelled with full refund
- [ ] Delete: reviews anonymised (userId → null) but not deleted
- [ ] Delete: deleted user cannot log in after (deletedAt check in login middleware)

## Definition of done
- Login attempt after deletion returns 401 (not 404 — don't reveal account existence)
- Old refresh tokens rejected after password change (middleware checks token version or expiry)
BODY

create_issue "$title" "$body" '["E08 — Player: Profile","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E08-04 — Mobile: Profile screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E08-04] [Mobile] Profile screen — user card, trust score ring, menu sections, logout"
read -r -d '' body << 'BODY' || true
## Summary
Main Profile screen (bottom tab 4). Avatar + user info card, trust score summary card with animated circular ring, menu sections for account/legal/support/danger zone.

## Reference
- UIUX_SPEC §10.1

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/profile/ProfileScreen.tsx` | Create |
| `apps/mobile/src/screens/profile/components/UserCard.tsx` | Create |
| `apps/mobile/src/screens/profile/components/TrustScoreCard.tsx` | Create |
| `apps/mobile/src/screens/profile/components/TrustScoreRing.tsx` | Create — SVG ring |
| `apps/mobile/src/screens/profile/components/ProfileMenuItem.tsx` | Create |

## UserCard spec
- Avatar: 80×80px, radius-full
  - avatarUrl present: `<Image source={{ uri }}>`
  - null: initials view (neutral-200 bg, primary-600 text, heading-lg, first letters of first+last name)
- Name: heading-lg neutral-900
- Email: body-md neutral-500
- Phone: body-md neutral-500
- "Edit profile" — secondary small, 8px below name
- City chip: map-marker 14px + city name, neutral-100 bg, radius-full, 6px 12px padding

## TrustScoreRing (60px, for summary card)
```typescript
// react-native-svg Circle with stroke-dashoffset animation
// r=27 → circumference = 2π × 27 ≈ 169.6
// Fill % = score / 100
// strokeDasharray: circumference
// strokeDashoffset: circumference × (1 - score/100)
// Animate: Animated.timing 600ms ease-out on mount
// Track colour: neutral-200 | Fill colour: TIER_COLOURS[tier]
const TIER_COLOURS = {
  Excellent: '#16A34A', Good: '#22C55E',
  Fair: '#F59E0B', Poor: '#EF4444', Suspended: '#7F1D1D',
};
```

## TrustScoreCard spec
- white bg, shadow-sm, radius-md, 16px padding, row layout
- Left: TrustScoreRing (60px) + score (heading-sm inside ring) + tier name below ring
- Right (12px gap):
  - "Your Trust Score" — heading-sm neutral-900
  - Tier description — body-sm neutral-700
  - "View history →" — label-md primary-600 → TrustScoreDetailScreen

## Menu sections
"Account": Edit profile | Change password | Payment methods | My reviews
"Legal": Terms of Service | Privacy Policy (both open URL via Linking)
"Support": Help & FAQ | Contact support (mailto:)
"Danger zone": Log out (error-500, no chevron, Alert confirm) | Delete account

## Logout flow
```typescript
// 1. POST /api/v1/auth/logout (revoke server refresh token)
// 2. Keychain.resetInternetCredentials(KEYCHAIN_SERVICE)
// 3. useAuthStore.getState().reset()
// 4. queryClient.clear()
// 5. navigation.reset({ index: 0, routes: [{ name: 'Auth' }] })
```

## Acceptance criteria
- [ ] Initials shown when no avatar
- [ ] TrustScoreRing animates on mount, correct colour per tier
- [ ] "View history →" navigates to TrustScoreDetailScreen
- [ ] All menu items navigate correctly
- [ ] Legal items open URL (not in-app screen)
- [ ] Logout: tokens cleared from keychain, navigation reset to Auth stack
- [ ] Profile refetched on tab focus (`useQueryClient().invalidateQueries` in useFocusEffect)

## Definition of done
- Logout verified: re-opening app shows Auth stack (no cached session)
- Ring animation 60fps on mid-range Android (real device test)
BODY

create_issue "$title" "$body" '["E08 — Player: Profile","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E08-05 — Mobile: Trust Score Detail screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E08-05] [Mobile] Trust Score Detail screen — 120px ring, event history, tier table, tips"
read -r -d '' body << 'BODY' || true
## Summary
Full-screen Trust Score Detail: 120px animated ring, paginated event history with delta badges, tier table with current tier highlighted, improvement tips card.

## Reference
- UIUX_SPEC §10.2
- PRD §9.1

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/profile/TrustScoreDetailScreen.tsx` | Create |
| `apps/mobile/src/screens/profile/components/TrustEventRow.tsx` | Create |
| `apps/mobile/src/screens/profile/components/TierTable.tsx` | Create |

## Large ring (120px, r=54)
- Same SVG approach as TrustScoreRing but 120px diameter
- Score: display-md inside ring, tier colour
- Tier label: heading-sm below ring, tier colour
- Animate: 800ms ease-out on mount

## TrustEventRow spec
- Positive delta: success-50 bg, success-600 text "+2" — 48×28px radius-full badge
- Negative delta: error-50 bg, error-600 text "−20" — same size
- Middle: reason label (body-md neutral-900) + formatted date (body-sm neutral-400)
- Right: chevron-right if bookingId present → navigate to Booking Detail

## Reason labels
```typescript
const REASON_LABELS = {
  BOOKING_COMPLETED: 'Booking completed',
  REVIEW_LEFT: 'Review submitted',
  LATE_CANCELLATION: 'Late cancellation',
  VERY_LATE_CANCELLATION: 'Very late cancellation',
  NO_SHOW: 'No-show recorded',
  DISPUTE_WON: 'Dispute resolved in your favour',
  MONTHLY_RECOVERY: 'Monthly recovery (+1)',
};
```

## TierTable
- 5 rows, one per tier
- Current tier: neutral-50 bg + 3px left border in tier colour
- Columns: tier name (label-md) | range (body-sm neutral-500) | description (body-sm neutral-700)

## Tips card
- neutral-50 bg, radius-md, 16px padding
- "How to improve your score" — heading-sm
- Bullet rows (check-circle primary-600 + text body-md neutral-700):
  - "Show up to all your bookings"
  - "Cancel at least 24h in advance"
  - "Leave a review after playing"
  - "Keep your score above 70 for full access"

## Infinite scroll
- useInfiniteQuery on `GET /profile/trust-score?cursor=...`
- FlatList: ListHeaderComponent = ring + tier table + tips; items = event rows

## Acceptance criteria
- [ ] Ring animates 800ms on mount
- [ ] Ring correct colour per tier
- [ ] Delta badges correct colour and sign
- [ ] Event rows with bookingId are tappable → Booking Detail
- [ ] Events without bookingId (MONTHLY_RECOVERY): no chevron, not tappable
- [ ] Tier table highlights current tier row
- [ ] Infinite scroll loads more events
- [ ] Empty events list: "No score events yet" between tier table and tips

## Definition of done
- Ring Animated value cleaned up on unmount (no memory leak)
- Section header separators by month ("October 2026") via `stickyHeaderIndices` or manual rendering
BODY

create_issue "$title" "$body" '["E08 — Player: Profile","type: feature","platform: mobile","priority: medium"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E08-06 — Mobile: Edit Profile + Change Password + Delete Account screens
# ─────────────────────────────────────────────────────────────────────────────
title="[E08-06] [Mobile] Edit Profile, Change Password, Delete Account screens"
read -r -d '' body << 'BODY' || true
## Summary
Three account management screens accessible from the Profile menu.

## Reference
- UIUX_SPEC §10.1
- PRD §6

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/profile/EditProfileScreen.tsx` | Create |
| `apps/mobile/src/screens/profile/ChangePasswordScreen.tsx` | Create |
| `apps/mobile/src/screens/profile/DeleteAccountScreen.tsx` | Create |

## EditProfileScreen
- Avatar: 80px tap → react-native-image-picker → Cloudinary signed upload → preview
- Full name TextInput (min 2 chars)
- Phone TextInput (keyboardType="phone-pad", E.164 validation)
- City: TouchableOpacity → CitySelector bottom sheet (reuse E03-03)
- Email: static display text + "Email cannot be changed" body-sm neutral-400
- "Save changes" — primary, disabled if no changes from initial values
- On success: toast + navigate back, cache invalidated

## ChangePasswordScreen
- "Current password" TextInput + show/hide eye toggle
- "New password" TextInput + PasswordStrengthBar (4-segment, reuse E02-03)
- "Confirm new password" + inline error if mismatch
- On success: toast "Password updated. You'll be logged out." → full logout flow
- Server `WRONG_PASSWORD`: inline error below current password field (not toast)

## DeleteAccountScreen
- Warning card: error-50 bg, error-500 left border 3px, radius-sm right corners
  - "This action is permanent and cannot be undone"
  - Bullets: All data deleted | Bookings cancelled (refunds apply) | Reviews anonymised | Cannot recover
- Password TextInput (secureTextEntry)
- Optional reason TextInput (max 300 chars)
- "Permanently delete my account" — destructive, full width
  - On tap: Alert.alert "Are you absolutely sure?" → OK → API call
  - Loading: spinner in button
- "Never mind" — ghost, full width, navigate back
- On success: clear keychain + authStore + navigate to Auth stack

## Acceptance criteria
- [ ] Edit: avatar tap → upload → preview before save
- [ ] Edit: city picker reuses E03-03 CitySelector
- [ ] Edit: "Save" disabled until at least one field changed
- [ ] Change password: strength bar visible during new password entry
- [ ] Change password: confirm mismatch shows inline error
- [ ] Change password: success triggers full logout
- [ ] Delete: double confirmation (button → Alert)
- [ ] Delete: on success, auth stack is root of navigation (cannot go back)

## Definition of done
- Avatar upload tested on real device (Cloudinary visible in network inspector)
- Wrong password: inline error shown, button re-enabled
- Account deleted: app re-opened shows Auth stack (no cached state)
BODY

create_issue "$title" "$body" '["E08 — Player: Profile","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E08-07 — Mobile: Payment Methods screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E08-07] [Mobile] Payment Methods screen — saved cards list, add card (Stripe), swipe-to-remove"
read -r -d '' body << 'BODY' || true
## Summary
Payment Methods screen under Profile. Lists saved Stripe cards with brand logos, add card via SetupIntent, remove via swipe-to-delete. Uses E05-09 backend endpoints.

## Reference
- UIUX_SPEC §10.3
- PRD §10

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/profile/PaymentMethodsScreen.tsx` | Create |
| `apps/mobile/src/hooks/usePaymentMethods.ts` | Create |

## Card list spec
- FlatList of card rows (56px height, 16px horizontal padding)
- Row: card brand image (Visa.png / Mastercard.png, 40×26px) + "···· {last4}" (body-md) + expiry (body-sm neutral-500)
- Default badge: "Default" — primary-100 bg, primary-700 text, label-sm, radius-full
- Swipe left → red "Remove" action (react-native-gesture-handler Swipeable, 80px wide)

## Add card
- Last row: plus icon primary-600 + "Add new card" label-md primary-600
- Tap → POST /payments/setup-intent → get clientSecret → `stripe.presentPaymentSheet` or `stripe.initPaymentSheet` + `presentPaymentSheet`
- On success: invalidate ['paymentMethods'] query → new card appears

## Remove card
```typescript
// Swipe left "Remove" → Alert.alert "Remove this card?" → DELETE /payments/methods/:id
// Optimistic: remove from list immediately, restore on error
```

## Empty state
- credit-card-off icon (48px neutral-300) + "No saved cards" + "Add a card to book faster" body-md neutral-500

## Acceptance criteria
- [ ] Correct brand logos for visa / mastercard
- [ ] Swipe-to-delete triggers Alert confirm before API call
- [ ] Card removed from list on success (optimistic update)
- [ ] New card added via Stripe sheet → appears in list
- [ ] Empty state shown when no cards
- [ ] Card also appears in Step 4 payment selector (E05-05) after adding

## Definition of done
- Brand logo assets in `apps/mobile/src/assets/cards/visa.png` + `mastercard.png`
- IDOR verified: DELETE only removes cards belonging to current user
BODY

create_issue "$title" "$body" '["E08 — Player: Profile","type: feature","platform: mobile","priority: medium"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E08-08 — Web: Player profile pages
# ─────────────────────────────────────────────────────────────────────────────
title="[E08-08] [Web] Player profile pages — settings, change password, trust score, payment methods, delete"
read -r -d '' body << 'BODY' || true
## Summary
Web `/profile` section with sidebar navigation. Subpages: account settings, change password, trust score, payment methods, delete account. All server-rendered with client islands for forms.

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/profile/layout.tsx` | Create — sidebar nav |
| `apps/web/src/app/profile/page.tsx` | Create — overview |
| `apps/web/src/app/profile/settings/page.tsx` | Create — edit form |
| `apps/web/src/app/profile/change-password/page.tsx` | Create |
| `apps/web/src/app/profile/trust-score/page.tsx` | Create |
| `apps/web/src/app/profile/payment-methods/page.tsx` | Create |
| `apps/web/src/app/profile/delete-account/page.tsx` | Create |
| `apps/web/src/components/profile/WebTrustScoreRing.tsx` | Create — CSS SVG ring |

## Layout
- Left sidebar (200px): links to all sub-pages, active item primary-600 bg
- Main area: white, max 640px wide

## `/profile/settings`
- Avatar file input → Cloudinary upload → PUT /profile
- react-hook-form + Zod client validation
- City: `<select>` from CITIES constant

## `/profile/trust-score`
- `WebTrustScoreRing` — inline SVG with CSS `@keyframes` for stroke-dashoffset animation
- Event history: server renders first page + IntersectionObserver infinite scroll
- Tier table: `<table>`, current tier row `background: neutral-50`

## `/profile/payment-methods`
- Card list with brand images
- "Remove" link → fetch DELETE /payments/methods/:id → router.refresh()
- "Add new card" → Stripe `<PaymentElement>` in Radix Dialog

## `/profile/delete-account`
- Warning section (error-50 bg, error-500 border)
- Password input + reason textarea
- "Delete account" → confirm `window.confirm()` → DELETE /profile → signOut() → redirect `/`

## Auth guard (all subpages)
- `getServerSession()` in layout → redirect `/auth/login?next=/profile` if no session

## Acceptance criteria
- [ ] All 6 subpages accessible from sidebar
- [ ] Settings form saves and reflects without page reload (router.refresh())
- [ ] Trust score ring animates on page load (CSS keyframe)
- [ ] Trust event history infinite scroll working
- [ ] Payment methods add/remove working
- [ ] Delete account: signs out + redirects to home
- [ ] All pages redirect to login if unauthenticated

## Definition of done
- Forms keyboard-navigable (tab order correct)
- Lighthouse a11y ≥ 90 on profile pages
BODY

create_issue "$title" "$body" '["E08 — Player: Profile","type: feature","platform: web","priority: medium"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E08-09 — Mobile: notifications screen (tab 3)
# ─────────────────────────────────────────────────────────────────────────────
title="[E08-09] [Mobile] Notifications screen — grouped list, unread badge, swipe-to-delete"
read -r -d '' body << 'BODY' || true
## Summary
Notifications screen (bottom tab 3). Grouped by date (Today / Yesterday / Earlier). Each row has an icon, title, body, timestamp. Tap marks read + navigates. Swipe-left to delete. "Mark all read" button. Badge on tab.

## Reference
- UIUX_SPEC §9.1
- PRD §10

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/notifications/NotificationsScreen.tsx` | Create |
| `apps/mobile/src/screens/notifications/components/NotificationRow.tsx` | Create |
| `apps/mobile/src/hooks/useNotifications.ts` | Create |

## NotificationRow spec
- Height: auto (min 64px), 16px horizontal padding, 12px vertical
- Left: icon in 40×40px circle:
  - BOOKING_CONFIRMED: check-circle, success-50 bg, success-500 icon
  - NO_SHOW: alert-circle, error-50 bg, error-500 icon
  - REMINDER: clock-outline, info-50 bg, info-500 icon
  - PENALTY: currency-usd, error-50 bg, error-500 icon
  - REVIEW: star, warning-50 bg, warning-500 icon
  - DISPUTE: shield, info-50 bg, info-500 icon
- Right of icon (12px gap):
  - Title: label-md neutral-900 (bold if unread)
  - Body: body-sm neutral-500, max 2 lines
  - Time: body-sm neutral-400, right-aligned or below body
- Unread: 8px primary-600 dot on far left (outside row padding) + primary-50 bg

## Grouping
- Section headers: "Today" | "Yesterday" | "Earlier this week" | "Older"
  - label-sm neutral-400 uppercase, 8px vertical padding

## Interactions
- Tap: PATCH /notifications/:id/read → mark as read → navigate to related screen
- Swipe left: red "Delete" action → DELETE /notifications/:id → remove from list
- Header right: "Mark all read" — label-md primary-600 → PATCH /notifications/read-all

## Navigation targets by type
| Type | Navigate to |
|------|-------------|
| BOOKING_CONFIRMED | BookingDetailScreen |
| NO_SHOW | BookingDetailScreen |
| REMINDER | BookingDetailScreen |
| REVIEW_REPLY | AllReviewsScreen (pitch) |
| DISPUTE | BookingDetailScreen |

## Tab badge
- Unread count shown as badge on Notifications tab icon
- Refreshed on app foreground and on tab focus

## Empty state
- Bell illustration (48px neutral-300) + "All caught up!" heading-sm + "No notifications yet" body-md neutral-500

## Backend endpoints needed (small — create inline)
```typescript
// PATCH /api/v1/notifications/:id/read — mark single read
// PATCH /api/v1/notifications/read-all — mark all read for user
// DELETE /api/v1/notifications/:id — soft delete (set deletedAt)
// GET /api/v1/notifications — list undeleted, newest first
```

## Acceptance criteria
- [ ] Correct icon per notification type
- [ ] Unread rows highlighted (primary-50 bg + dot)
- [ ] Tap marks as read + navigates to correct screen
- [ ] Swipe-delete removes notification
- [ ] "Mark all read" clears all unread badges
- [ ] Tab badge shows unread count
- [ ] Grouped by date sections

## Definition of done
- Unread count badge synced with FCM (E13) — badge resets when screen opened
- Swipe gesture does not conflict with horizontal scroll in other screens
BODY

create_issue "$title" "$body" '["E08 — Player: Profile","type: feature","platform: mobile","priority: medium"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E08-10 — Mobile: FCM push notification registration + deep-link handling
# ─────────────────────────────────────────────────────────────────────────────
title="[E08-10] [Mobile] FCM push registration + deep-link handler — foreground + background + quit state"
read -r -d '' body << 'BODY' || true
## Summary
Register device for Firebase Cloud Messaging push notifications after login. Handle notification tap in foreground, background, and quit states. Deep-link into correct screen based on notification type.

## Reference
- PRD §10
- Related: E13 (backend FCM send)

## Files to create / modify
| File | Action |
|------|--------|
| `apps/mobile/src/lib/fcm.ts` | Create — token registration + permission request |
| `apps/mobile/src/lib/notificationHandler.ts` | Create — routing logic |
| `apps/mobile/src/App.tsx` | Modify — wire FCM on app start |

## FCM setup
```typescript
// lib/fcm.ts
import messaging from '@react-native-firebase/messaging';

export async function requestNotificationPermission(): Promise<boolean> {
  const authStatus = await messaging().requestPermission();
  return authStatus === messaging.AuthorizationStatus.AUTHORIZED
      || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
}

export async function getFCMToken(): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;
  return messaging().getToken();
}

export async function registerDeviceToken(userId: string): Promise<void> {
  const token = await getFCMToken();
  if (!token) return;
  await apiClient.post('/notifications/device-token', { token, platform: Platform.OS });
}
```

## Backend endpoint (inline — small)
```typescript
// POST /api/v1/notifications/device-token
// Body: { token: string, platform: 'ios' | 'android' }
// Store in DeviceToken table: { userId, token, platform, updatedAt }
// Upsert on conflict (same token) → update userId + updatedAt
```

## Notification handler routing
```typescript
// lib/notificationHandler.ts
export function handleNotificationNavigation(
  notification: FirebaseMessagingTypes.RemoteMessage,
  navigationRef: React.RefObject<NavigationContainerRef>
) {
  const { type, bookingId, pitchId } = notification.data ?? {};
  switch (type) {
    case 'BOOKING_CONFIRMED':
    case 'NO_SHOW':
    case 'REMINDER':
      navigationRef.current?.navigate('BookingDetail', { id: bookingId });
      break;
    case 'REVIEW_REPLY':
      navigationRef.current?.navigate('AllReviews', { pitchId });
      break;
    // Add more as E13 defines them
  }
}
```

## App states
- **Foreground**: `messaging().onMessage` → show in-app banner (react-native-toast or custom)
- **Background tap**: `messaging().onNotificationOpenedApp` → handleNotificationNavigation
- **Quit state tap**: `messaging().getInitialNotification` → handleNotificationNavigation after mount

## Token refresh
```typescript
// messaging().onTokenRefresh → re-register with backend
```

## iOS-specific
- Add `NSUserNotificationUsageDescription` in Info.plist
- Enable Push Notifications capability in Xcode
- Use APNs key in Firebase console

## Acceptance criteria
- [ ] Permission prompt shown after first login (not on every launch)
- [ ] FCM token registered on backend after permission granted
- [ ] Foreground notification shows in-app banner
- [ ] Background tap navigates to correct screen
- [ ] Quit-state tap navigates to correct screen after app loads
- [ ] Token refresh re-registers silently
- [ ] Permission denied: graceful — no error, notifications just don't arrive

## Definition of done
- Tested on real iOS and Android devices (simulators don't support push)
- Token stored in DB verified via admin query
BODY

create_issue "$title" "$body" '["E08 — Player: Profile","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

echo "✓ E08 — 10 issues created"
