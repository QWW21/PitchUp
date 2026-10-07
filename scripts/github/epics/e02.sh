#!/usr/bin/env bash
# e02.sh — create all E02 Auth issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E02 — Auth")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E02 — Auth' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E02 — Auth)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E02-01 — Splash screen + onboarding slides
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-01] [Mobile] Splash screen and 3-slide onboarding flow"
read -r -d '' body << 'BODY' || true
## Summary
Implement the mobile splash screen and 3-slide onboarding carousel shown to first-time users. After onboarding (or skip), navigate to the Login screen.

## Reference
- UIUX_SPEC §4.1 (Splash), §4.2 (Onboarding)
- PRD §5.1 (IA: Auth screens)

## Files to create
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/auth/SplashScreen.tsx` | Animated splash |
| `apps/mobile/src/screens/auth/OnboardingScreen.tsx` | 3-slide carousel |
| `apps/mobile/src/components/onboarding/OnboardingSlide.tsx` | Single slide component |
| `apps/mobile/src/components/onboarding/PageDots.tsx` | Dot indicator |
| `apps/mobile/src/navigation/AuthNavigator.tsx` | Stack: Splash → Onboarding → Login → Register → OTP |

## Splash screen spec (UIUX_SPEC §4.1)
- **Background:** `#16A34A` (`primary-600`), fullscreen
- **Logo:** white SVG, 120×120px, horizontally centered, vertically centered − 40px
- **Wordmark:** "PitchUp" — `display-md` (30px/700), white, 12px below logo
- **Tagline:** "Book your game." — `body-md` (14px/400), `#BBF7D0` (`primary-200`), 8px below wordmark
- **Status bar:** hidden (`StatusBar hidden={true}`)
- **Duration:** 1 500ms → animate out: fade + scale (1.0 → 1.05, 300ms ease-in-out) → navigate to `Onboarding` (first launch) or `Login` (returning user)
- **First launch detection:** `AsyncStorage.getItem('onboarding_seen')` — if `'true'`, skip onboarding

### Animation sequence
```typescript
// Sequence: wait 1200ms → fade out (300ms) → navigate
useEffect(() => {
  const timer = setTimeout(async () => {
    await Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(scale,   { toValue: 1.05, duration: 300, useNativeDriver: true }),
    ]).start()
    const seen = await AsyncStorage.getItem('onboarding_seen')
    navigation.replace(seen === 'true' ? 'Login' : 'Onboarding')
  }, 1200)
  return () => clearTimeout(timer)
}, [])
```

## Onboarding screen spec (UIUX_SPEC §4.2)

### Container
- **Background:** white, fullscreen
- **Layout:** flex column: slide area (flex-1) → dots → buttons

### Skip button
- Position: absolute top-right
- Margin: 16px top (+ safe area), 16px right
- Style: `body-md` (14px/400), `#6B7280` (`neutral-500`)
- Touch target: 44×44px
- Action: navigate to `Login`, set `AsyncStorage 'onboarding_seen' = 'true'`

### Slide data
```typescript
const slides = [
  {
    id: 1,
    illustration: require('@/assets/illustrations/discover.png'),  // 280×200px
    illustrationSize: { width: 280, height: 200 },
    title: 'Discover pitches near you',
    description: 'Browse football pitches in your city, see real-time availability and pricing.',
  },
  {
    id: 2,
    illustration: require('@/assets/illustrations/book.png'),  // 200×280px
    illustrationSize: { width: 200, height: 280 },
    title: 'Book in 60 seconds',
    description: 'Pick your time, add your team, pay securely. Done.',
  },
  {
    id: 3,
    illustration: require('@/assets/illustrations/trust.png'),  // 200×200px
    illustrationSize: { width: 200, height: 200 },
    title: 'Play without worry',
    description: 'Trust score protects both players and venues. No more no-show surprises.',
  },
]
```

### Illustration area
- Top 50% of screen
- `primary-50` (`#F0FDF4`) blob shape behind illustration (absolute positioned, 300×250, `radius-xl`)
- Illustration centered within blob

### Slide title & description
- Title: `heading-xl` (24px/700), `#111827` (`neutral-900`), centered, 32px below illustration
- Description: `body-md` (14px/400), `#6B7280` (`neutral-500`), centered, 12px below title, 32px horizontal padding

### Page dots (PageDots component)
- 3 dots, centered horizontally
- Gap between dots: 6px
- Inactive dot: 8px diameter circle, `#D1D5DB` (`neutral-300`)
- Active dot: animated pill — 20px wide × 8px height, `#16A34A` (`primary-600`), `radius-full`
- Width animation: `Animated.timing` 200ms when active index changes

### Navigation buttons
- Container: 24px horizontal padding, 32px bottom margin + `useSafeAreaInsets().bottom`
- Gap between dots and button: 16px
- Slides 1–2: "Next" — `primary` variant, `lg` size (48px height), full width
- Slide 3: "Get Started" — `cta` variant (`accent-500`), `lg` size, full width
- On last slide Next/Get Started: set `AsyncStorage 'onboarding_seen' = 'true'` → navigate to `Register`

### Swipe gesture
- Horizontal `FlatList` with `pagingEnabled`
- `onMomentumScrollEnd` updates active slide index
- Dots and button update in sync

## Acceptance Criteria
- [ ] Splash appears fullscreen (no status bar), green background, white logo centered
- [ ] After 1.5s (1.2s wait + 0.3s fade), navigates to Onboarding on first launch
- [ ] After 1.5s, navigates directly to Login if `AsyncStorage 'onboarding_seen'` is `'true'`
- [ ] Onboarding shows 3 slides, swipeable left/right
- [ ] Active page dot animates to 20px pill, inactive dots remain 8px circles
- [ ] Skip button (top-right) navigates to Login from any slide
- [ ] "Get Started" on slide 3 navigates to Register
- [ ] `onboarding_seen` written to AsyncStorage when user completes or skips onboarding
- [ ] No crash on iOS or Android
- [ ] Safe area insets applied (content not hidden behind notch/home indicator)

## Edge cases
- Device font size increased (accessibility): test with iOS "Larger Text" setting — text should not overflow slide
- Slow AsyncStorage read: splash should not flash white while reading — keep splash visible until async operation completes
- Dark mode: not supported in v1.0, but do not hard-code colours that invert badly — use design tokens

## Definition of done
- [ ] Works on iOS simulator (iPhone 15) and Android emulator (Pixel 7)
- [ ] Splash → Onboarding → Login flow navigates correctly
- [ ] Skip and Get Started both set AsyncStorage correctly (verify with Flipper/React Native Debugger)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-02 — Player registration Step 1
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-02] [Mobile] Player registration — Step 1 (name, email, phone, date of birth)"
read -r -d '' body << 'BODY' || true
## Summary
Implement Step 1 of the player registration form: full name, email, phone number with country code selector, and date of birth. Validates inline before allowing progression to Step 2.

## Reference
- UIUX_SPEC §4.4 (Register Screen — Step 1)
- PRD §6.1 (Registration — Player)
- `packages/shared/src/schemas/auth.ts` — `RegisterPlayerStep1Schema`

## Files to create / modify
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/auth/RegisterScreen.tsx` | Container — manages step state (1 or 2) |
| `apps/mobile/src/screens/auth/steps/RegisterStep1.tsx` | Step 1 form |
| `apps/mobile/src/components/form/PhoneInput.tsx` | Country code + number input |
| `apps/mobile/src/components/form/DateOfBirthPicker.tsx` | DOB picker (wheel/calendar) |
| `apps/mobile/src/components/ui/ProgressBar.tsx` | Step progress bar (reusable) |

## Screen layout (UIUX_SPEC §4.4)

### Header
- "Create account" — `heading-xl` (24px/700), `#111827`, left aligned, 16px margin
- "Join PitchUp today" — `body-md` (14px/400), `#6B7280`, 4px below header
- 40px from top + safe area

### Progress bar
- Height: 4px, full width (no horizontal margin)
- Track: `#F5F5F5` (`neutral-100`)
- Fill: `#16A34A` (`primary-600`)
- Step 1 of 2 → fill width: 50%
- Animated: `Animated.timing` when transitioning steps
- Below bar: "Step 1 of 2" — `label-sm` (11px/500), `#6B7280`, right aligned, 8px margin right, 8px below bar

### Form fields (16px gaps between each)
1. **Full name**
   - Label: "Full name" — `label-md` (13px/500), `#374151`, 6px above input
   - Input: height 48px, `#F5F5F5` bg, 1.5px `#E5E7EB` border, `radius-sm` (8px), 12px horizontal padding
   - Placeholder: "Alexandru David" — `#9CA3AF`
   - Validation: min 2 chars, max 100 chars
   - Error: border `#EF4444`, message below in `body-sm` `#EF4444`

2. **Email address**
   - Label: "Email address"
   - `keyboardType="email-address"`, `autoCapitalize="none"`, `autoComplete="email"`
   - Validation: valid email format

3. **Phone number** (PhoneInput component)
   - Left prefix: flag emoji + country code (e.g. 🇷🇴 +40) — tappable, opens country picker modal
   - Default: Romania (+40)
   - Right: number input, `keyboardType="phone-pad"`
   - Full width, same height/style as other inputs
   - Stored as E.164 format: `+40712345678`
   - Validation: regex `/^\+\d{8,15}$/` after combining prefix + number

4. **Date of birth**
   - Label: "Date of birth"
   - Display field (not editable directly): shows "DD/MM/YYYY" placeholder or selected date
   - On tap: opens `DateOfBirthPicker` bottom sheet
   - iOS: `DateTimePickerIOS` with `mode="date"`, `display="spinner"`
   - Android: `DateTimePickerAndroid.open()` with `mode="date"`
   - Max date: today − 16 years
   - Min date: 1900-01-01
   - Validation: age ≥ 16 years at time of submission

### Country picker modal
- Full screen modal (slides up)
- Search bar at top: "Search country..."
- List: country name + flag + dial code
- Pre-selected: Romania
- Tap → closes modal, updates prefix
- Countries: at minimum EU countries + common international

### Continue button
- "Continue" — `primary` variant (`primary-600`), `xl` size (56px), full width
- 24px below last field
- Disabled (30% opacity) until all fields valid
- On press: validate all fields → if valid, navigate to Step 2 passing form data

### Navigation
- Back arrow top-left → navigate back to Login (with confirmation: "Discard registration?")
- "Already have an account? Sign in" — `body-md`, `neutral-500`, "Sign in" `primary-600`, centered, 32px from bottom

## State management
Use local `useState` for form values and errors. Pass step 1 data as prop or via React context to Step 2 (both steps live in RegisterScreen.tsx which holds combined state).

```typescript
interface RegisterFormState {
  // Step 1
  name: string
  email: string
  phone: string
  countryCode: string  // e.g. '+40'
  dateOfBirth: string  // ISO string
  // Step 2
  city: string
  password: string
  confirmPassword: string
  agreedToTerms: boolean
}
```

## Acceptance Criteria
- [ ] All 4 fields render with correct style matching UIUX_SPEC §4.4
- [ ] Continue button disabled until all fields filled + valid
- [ ] Name: error if < 2 chars or > 100 chars
- [ ] Email: error if invalid format
- [ ] Phone: error if not valid E.164 after combining code + number
- [ ] DOB: error if age < 16 years, error if date in future
- [ ] Country picker opens on flag/code tap, closes on country select
- [ ] Keyboard dismissed on Continue tap
- [ ] `KeyboardAvoidingView` prevents keyboard from covering inputs on small screens
- [ ] Progress bar shows 50% fill on Step 1

## Edge cases
- User pastes phone number including country code (e.g. "+40712345678") → parse and split correctly
- Very long name: truncate display, enforce 100 char max via `maxLength` prop
- DOB picker: today's date pre-selected, user must actively choose
- Android date picker: use `DateTimePickerAndroid.open()` (not the inline component)

## Definition of done
- [ ] All validation rules from `RegisterPlayerStep1Schema` (packages/shared) enforced
- [ ] Tested on iOS and Android
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-03 — Player registration Step 2
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-03] [Mobile] Player registration — Step 2 (city, password, Terms of Service)"
read -r -d '' body << 'BODY' || true
## Summary
Implement Step 2 of player registration: city selector, password with strength indicator, confirm password, and ToS checkbox. On submit, call the register API and navigate to OTP screen.

## Reference
- UIUX_SPEC §4.4 (Register Screen — Step 2)
- PRD §6.1
- `packages/shared/src/schemas/auth.ts` — `RegisterPlayerStep2Schema`

## Files to create / modify
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/auth/steps/RegisterStep2.tsx` | Step 2 form |
| `apps/mobile/src/components/form/CitySelector.tsx` | City picker modal |
| `apps/mobile/src/components/form/PasswordStrengthBar.tsx` | 4-segment strength indicator |

## Screen layout (UIUX_SPEC §4.4 Step 2)

### Progress bar
- Same component as Step 1
- Fill: 100% (step 2 of 2)

### Form fields

1. **City selector** (CitySelector component)
   - Label: "City"
   - Display field: shows selected city name or "Select your city" placeholder in `#9CA3AF`
   - Right: `chevron-down` icon 18px `#6B7280`
   - On tap: opens CitySelector bottom sheet
   - Cities from `packages/shared/src/constants/cities.ts`

2. **Password**
   - Label: "Password"
   - `secureTextEntry` — eye icon right side toggles visibility (`eye` / `eye-off`, 20px `#9CA3AF`)
   - Below input: PasswordStrengthBar (appears after first character typed)

3. **Confirm password**
   - Label: "Confirm password"
   - Same style as password input
   - Validation: must match password field exactly

4. **Terms of Service checkbox**
   - Row: checkbox (24×24px) + text
   - Text: `body-md` `#374151` — "I agree to the " + "Terms of Service" (`primary-600`, underlined, opens WebView) + " and " + "Privacy Policy" (`primary-600`, underlined)
   - Checkbox: `#16A34A` when checked, `#E5E7EB` border when unchecked
   - Touch target: full row (44px min height)

### Password strength bar (UIUX_SPEC §4.4)
- 4px height, `radius-full`
- 4 segments with 4px gaps between them
- Each segment: `radius-full`
- Criteria → score:
  - Length ≥ 8: +1
  - Has uppercase: +1
  - Has number: +1
  - Has special character: +1
- Score → segments:
  - 1 segment: `#EF4444` (`error-500`) — "Weak"
  - 2 segments: `#F59E0B` (`warning-500`) — "Fair"
  - 3 segments: `#F97316` (`accent-500`) — "Good"
  - 4 segments: `#16A34A` (`primary-600`) — "Strong"
- Label: strength word shown right-aligned, `label-sm`, matching segment colour
- Animate segment fills: `Animated.timing` 200ms on change

### City selector bottom sheet
- Slides up 80% screen height
- Header: "Select your city" `heading-md` + X close button
- Search: always visible at top, placeholder "Search cities..."
- List: `FlatList`, each row: city name (`body-lg` `#111827`) + county (`body-sm` `#6B7280`)
- Selected: right `check` icon 20px `#16A34A`
- Tap → close sheet, fill display field

### Create account button
- "Create account" — `primary` variant, `xl` size, full width
- Disabled until: city selected, password ≥ 8 chars, passwords match, ToS checked
- On press → loading state → call `POST /api/v1/auth/register`
- On success → navigate to `PhoneOTP` screen with `{ phoneNumber, userId }`
- On error → toast with error message (duplicate email/phone → specific message)

### API call
```typescript
const response = await api.post('/auth/register', {
  name, email, phone, dateOfBirth, city, password
})
// On 201: { data: { userId, message: 'OTP sent' } }
// On 409: { error: { code: 'CONFLICT', message: 'Email already registered' } }
```

## Acceptance Criteria
- [ ] Progress bar shows 100% fill
- [ ] City selector opens bottom sheet with searchable city list
- [ ] Selecting city closes sheet and shows city name in field
- [ ] Password strength bar appears after first character, updates live
- [ ] 4-segment strength bar correct: 1 = Weak/red, 2 = Fair/amber, 3 = Good/orange, 4 = Strong/green
- [ ] Passwords-do-not-match error shown inline below confirm field
- [ ] ToS links open a WebView (placeholder URL acceptable for now)
- [ ] Create account button disabled until all valid
- [ ] On 201: navigate to OTP screen with phone number
- [ ] On 409 (duplicate email): inline error under email field "Email already registered"
- [ ] Loading spinner in button during API call, inputs disabled

## Edge cases
- Network timeout: show "Connection error. Check your internet." toast
- Password with only numbers (no uppercase, no special): scores 2/4 ("Fair") — correct
- City search with diacritics: "Cluj" should match "Cluj-Napoca" — use `normalize('NFD')` for comparison

## Definition of done
- [ ] Full registration flow (Step 1 → Step 2 → OTP) works end-to-end with real API
- [ ] Password strength bar tested with: "password" (2/4), "Password1" (3/4), "Password1!" (4/4)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-04 — Phone OTP verification screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-04] [Mobile] Phone OTP verification screen"
read -r -d '' body << 'BODY' || true
## Summary
Implement the 6-digit OTP verification screen shown after registration. Handles digit input, auto-advance, SMS autofill, resend with countdown, and error states.

## Reference
- UIUX_SPEC §4.5
- PRD §6.1 (step 3: Verify phone)

## Files to create
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/auth/PhoneOTPScreen.tsx` | OTP screen |
| `apps/mobile/src/components/form/OTPInput.tsx` | 6-box OTP input component |

## Screen layout (UIUX_SPEC §4.5)

### Header
- "Verify your number" — `heading-xl`, `#111827`, left, 16px margin
- "We sent a 6-digit code to **+40 7XX XXX XXX**" — `body-md`, `#6B7280`, 4px below
  - Phone number: `font-weight: 700`, `#111827`
  - Phone number masked: show country code + first 3 + XXX + last 3
- 40px top + safe area

### OTP input boxes (OTPInput component)
- 6 individual `TextInput` boxes in a row
- Each box: 48px wide × 56px tall
- Border: 1.5px `#E5E7EB` (`neutral-200`), `radius-sm` (8px)
- Gap between boxes: 8px
- Active box (focused): `#16A34A` border, `shadow-xs`
- Filled box: `#111827` text, `heading-md` (18px/600) font
- Empty box: no text

### OTP input behaviour
- `keyboardType="number-pad"`, `maxLength={1}` per box
- Auto-advance: after digit entered in box N, focus shifts to box N+1
- Backspace on empty box: focus shifts to box N-1
- Auto-paste: detect `onChangeText` length > 1 (SMS autofill provides all 6 digits at once) → split and fill all boxes
  - iOS: `textContentType="oneTimeCode"` on all inputs
  - Android: `autoComplete="sms-otp"` on first input
- All 6 filled → auto-submit (call verify API immediately, no need to tap Verify button)

### Error state
- All 6 boxes: border `#EF4444` (`error-500`), subtle red background `#FEF2F2`
- Error message below boxes: "Incorrect code. X attempts remaining." — `body-sm`, `#EF4444`
- Clear all boxes, refocus box 1

### Verify button
- "Verify" — `primary` variant, `xl` size, full width
- Enabled only when all 6 boxes filled
- On press → call verify API
- Loading: spinner in button
- On success → navigate to `Login` (or directly to app if session established)

### Resend code
- 24px below Verify button
- "Resend code" — `label-md`
- **Disabled state** (countdown timer): "Resend in 0:45" — `#9CA3AF` (`neutral-400`)
- **Enabled state**: `#16A34A` (`primary-600`), tappable
- Countdown starts at 60 seconds, uses `setInterval`
- On tap (enabled): call resend API → reset countdown to 60s → toast "Code resent"
- Rate limited: 3 resends max per session (show "Maximum resends reached" after 3rd)

### Change number link
- Below resend: "Wrong number? Change" — `body-sm`, "Change" in `#16A34A`
- Navigates back to Register Step 1 (stack pop)

## API calls
```typescript
// Verify OTP
POST /api/v1/auth/verify-phone-otp
Body: { userId: string, otp: string }
Response 200: { data: { verified: true } }
Response 400: { error: { code: 'INVALID_OTP', message: 'Incorrect code', details: { attemptsRemaining: 2 } } }
Response 410: { error: { code: 'OTP_EXPIRED', message: 'Code expired. Request a new one.' } }

// Resend OTP
POST /api/v1/auth/send-phone-otp
Body: { userId: string }
Response 200: { data: { message: 'OTP sent' } }
Response 429: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } }
```

## Acceptance Criteria
- [ ] 6 boxes render with correct dimensions (48×56px) and 8px gaps
- [ ] Typing in box auto-advances focus to next box
- [ ] Backspace on empty box moves focus to previous box
- [ ] SMS autofill fills all 6 boxes at once (iOS `textContentType="oneTimeCode"`)
- [ ] All 6 filled → auto-submits without tapping Verify button
- [ ] Wrong code → all boxes turn red, error message shows attempt count
- [ ] Expired code → error "Code expired. Request a new one."
- [ ] Resend countdown starts at 60s, counts down to 0, then enables resend
- [ ] After 3 resends: "Maximum resends reached" — button permanently disabled
- [ ] Verify button disabled when < 6 digits filled

## Edge cases
- User switches apps mid-flow: OTP boxes retain their values (no state reset on app background)
- OTP expires while user is typing: show expiry error on next submit, not proactively
- User presses back: warn "Verification not complete. Your account may not be activated."

## Definition of done
- [ ] End-to-end test: register → receive SMS → enter OTP → verified
- [ ] Autofill tested on iOS device (not just simulator)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-05 — Login screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-05] [Mobile] Login screen — email/password + social login buttons"
read -r -d '' body << 'BODY' || true
## Summary
Implement the mobile login screen with email/password form, show/hide password toggle, forgot password link, Google and Apple sign-in buttons, and navigation to Register.

## Reference
- UIUX_SPEC §4.3
- PRD §6.3

## Files to create / modify
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/auth/LoginScreen.tsx` | Login screen |
| `apps/mobile/src/hooks/useAuth.ts` | Auth state hook (login, logout, session) |
| `apps/mobile/src/store/authStore.ts` | Zustand auth store |

## Screen layout (UIUX_SPEC §4.3)

### Header
- 40px from top + safe area, 16px left margin
- "Welcome back" — `heading-xl` (24px/700), `#111827`
- "Sign in to continue" — `body-md` (14px/400), `#6B7280`, 4px below

### Form (32px below header)
1. **Email input**
   - Label: "Email address" — `label-md`, `#374151`, 6px above
   - `keyboardType="email-address"`, `autoCapitalize="none"`, `autoComplete="email"`

2. **Password input** (16px gap below email)
   - Label: "Password" — `label-md`, `#374151`
   - `secureTextEntry` toggle via eye icon
   - Eye icon: right side of input, 20px, `#9CA3AF` when hidden, `#374151` when shown
   - Touch target for eye: 44×44px (inset to right of input)

3. **Forgot password** (8px below password)
   - Right-aligned
   - "Forgot password?" — `label-md` (13px/500), `#16A34A` (`primary-600`)
   - Navigates to `ForgotPassword` screen

### Sign in button (24px below form)
- "Sign in" — `primary` variant, `xl` size (56px), full width
- Loading state: spinner, "Signing in..."
- On success → navigate based on `user.role`:
  - `PLAYER` or `MANAGER` → main tab navigator

### Social login divider (20px below sign in)
- Row: `#D1D5DB` line (flex-1) + "or" text (`body-sm` `#9CA3AF`, 16px horizontal padding) + `#D1D5DB` line (flex-1)

### Social buttons (16px below divider, 12px gap between)
- "Continue with Google" — `secondary` variant (white bg, `primary-600` border 1.5px), `lg` size (48px), full width
  - Google logo (SVG, 20px) left of text, 12px gap to text
- "Continue with Apple" — same style
  - Apple logo (SF Symbol / SVG, 20px black), full width
  - Only show on iOS (check `Platform.OS === 'ios'`)

### Footer
- "Don't have an account? **Sign up**" — `body-md`, `#6B7280`, "Sign up" `#16A34A`
- Centered, 32px from bottom + safe area

## Auth state (Zustand store)

```typescript
// store/authStore.ts
interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  loginWithApple: () => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<void>
}
```

Token storage: `react-native-keychain` (`SecureStorage`) — NOT AsyncStorage (not encrypted).

## API call
```typescript
// POST /api/v1/auth/mobile/login
Body: { email, password }
Response 200: { data: { accessToken, refreshToken, user: { id, name, email, role } } }
Response 401: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }
Response 403: { error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email first' } }
Response 403: { error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended' } }
```

## Error handling
- `INVALID_CREDENTIALS`: generic toast "Invalid email or password" (never say which is wrong — security)
- `EMAIL_NOT_VERIFIED`: toast + "Resend verification email" action button in toast
- `ACCOUNT_SUSPENDED`: alert with "Contact support" button
- Network error: toast "Connection error. Check your internet."

## Acceptance Criteria
- [ ] Screen matches UIUX_SPEC §4.3 layout and typography exactly
- [ ] Show/hide password toggles `secureTextEntry` correctly
- [ ] Successful login navigates to correct screen based on role
- [ ] Tokens stored in `react-native-keychain` (not AsyncStorage)
- [ ] Apple Sign In button hidden on Android
- [ ] `INVALID_CREDENTIALS` shows generic error (not "user not found" vs "wrong password")
- [ ] `EMAIL_NOT_VERIFIED` shows specific message with resend option
- [ ] Keyboard avoided (inputs scroll above keyboard)
- [ ] Loading state: button spinner, form inputs disabled during login request

## Definition of done
- [ ] Login works with real API on local and staging
- [ ] Tokens verified in keychain (use Flipper Keychain plugin or debug screen)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: high","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-06 — Forgot password flow (mobile)
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-06] [Mobile] Forgot password and reset password flow"
read -r -d '' body << 'BODY' || true
## Summary
Implement forgot password screen (email input → sends reset link) and reset password screen (accessed via deep link from email). Both mobile and web use the same reset token flow.

## Reference
- UIUX_SPEC §4.6
- PRD §6.3

## Files to create
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/auth/ForgotPasswordScreen.tsx` | Email input + success state |
| `apps/mobile/src/screens/auth/ResetPasswordScreen.tsx` | New password form (deep link) |

## Forgot password screen (UIUX_SPEC §4.6)

### State 1 — Input
- Header: "Forgot password?" — `heading-xl`, left, 16px margin
- Subtitle: "Enter your email and we'll send you a reset link." — `body-md`, `#6B7280`
- Email input (same style as login)
- "Send reset link" — `primary` button, `xl`, full width, 24px below input
- On success (200) → transition to State 2

### State 2 — Success (replaces form, no navigation)
- Animated transition: form fades out (200ms), success state fades in (200ms)
- Envelope illustration (SVG): 120×120px, centered
- "Check your email" — `heading-xl`, centered, 16px below illustration
- "We sent a reset link to **{email}**. It expires in 1 hour." — `body-md`, `#6B7280`, centered, email bold
- "Resend email" — `ghost` button (if user didn't receive): re-calls API, disabled 60s after each send
- "Back to sign in" — `primary` button, full width, 24px below

### API
```typescript
POST /api/v1/auth/forgot-password
Body: { email: string }
Response 200: { data: { message: 'Reset email sent' } }
// Always 200 — never reveal if email exists or not (security)
```

## Reset password screen
Accessed via deep link: `pitchup://reset-password?token=xxx`

Deep link setup: register `pitchup://` scheme in:
- iOS: `Info.plist` URL schemes
- Android: `AndroidManifest.xml` intent filter

### Screen layout
- Header: "Set new password" — `heading-xl`
- Subtitle: "Choose a strong password for your account."
- New password input (with strength bar — same as register)
- Confirm password input
- "Reset password" — `primary` button, full width
- On success: toast "Password updated" → navigate to `Login`

### API
```typescript
POST /api/v1/auth/reset-password
Body: { token: string, password: string }
Response 200: { data: { message: 'Password reset successful' } }
Response 400: { error: { code: 'INVALID_TOKEN', message: 'Reset link is invalid or expired' } }
```

### Error handling
- `INVALID_TOKEN`: "This reset link has expired. Request a new one." + "Forgot password" button
- Deep link with no/malformed token: same error screen

## Acceptance Criteria
- [ ] Sending forgot password always returns success UI (even for non-existent email — no info leakage)
- [ ] Resend disabled 60s after each send, re-enables automatically
- [ ] Deep link `pitchup://reset-password?token=xxx` opens ResetPasswordScreen with token
- [ ] Expired token shows clear error with link back to Forgot Password
- [ ] Password strength bar shown on new password field
- [ ] Passwords-match validation on confirm field
- [ ] Success toast + navigation to Login on reset completion

## Definition of done
- [ ] Forgot password flow tested end-to-end (email received, link opens app)
- [ ] Deep link tested on both iOS and Android
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: medium","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-07 — Social login (Google + Apple)
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-07] [Mobile] Social login — Google Sign-In and Apple Sign-In"
read -r -d '' body << 'BODY' || true
## Summary
Implement Google Sign-In (iOS + Android) and Apple Sign-In (iOS only, required by App Store). On first social login, collect missing required fields (phone number, city) before completing registration.

## Reference
- PRD §6.1 (Social login section)
- PRD §6.4 (Account roles)

## Libraries
- Google: `@react-native-google-signin/google-signin`
- Apple: `@invertase/react-native-apple-authentication` (iOS only)

## Files to create / modify
| File | Purpose |
|---|---|
| `apps/mobile/src/screens/auth/SocialCompleteProfileScreen.tsx` | Collect phone + city after first social login |
| `apps/mobile/src/store/authStore.ts` | Add `loginWithGoogle`, `loginWithApple` actions |

## Google Sign-In flow
```typescript
// 1. Configure (call once at app startup, e.g. App.tsx)
GoogleSignin.configure({
  webClientId: process.env.GOOGLE_WEB_CLIENT_ID,  // from Google Cloud Console
})

// 2. Login action
async function loginWithGoogle() {
  await GoogleSignin.hasPlayServices()
  const { idToken } = await GoogleSignin.signIn()
  // 3. Exchange ID token with our backend
  const response = await api.post('/auth/social/google', { idToken })
  // 4. Store tokens, update auth state
}
```

## Apple Sign-In flow (iOS only)
```typescript
async function loginWithApple() {
  const credential = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  })
  const { identityToken, fullName, email } = credential
  const response = await api.post('/auth/social/apple', {
    identityToken,
    fullName: `${fullName?.givenName} ${fullName?.familyName}`,
    email,  // only provided on first sign-in — store it
  })
}
```

## Backend social login endpoints (consumed by this ticket, implemented in E02-08)
```
POST /api/v1/auth/social/google  → { accessToken, refreshToken, user, isNewUser }
POST /api/v1/auth/social/apple   → { accessToken, refreshToken, user, isNewUser }
```

## First social login → profile completion
If `isNewUser === true`:
1. Navigate to `SocialCompleteProfileScreen`
2. Collect: phone number (with country code) + city
3. Optional: profile photo (skip link available)
4. On submit → `PATCH /api/v1/users/me` with phone + city
5. Trigger phone OTP verification (same OTP screen as E02-04)

Screen layout:
- Header: "Almost done!" — `heading-xl`
- Subtitle: "We just need a couple more details." — `body-md`, `#6B7280`
- Profile photo upload (optional): circle avatar 80px, "+" tap → camera/gallery picker
- Phone number input (PhoneInput component from E02-02)
- City selector (CitySelector from E02-03)
- "Continue" — `primary` button, full width
- "Skip photo" link (if photo not added): `ghost` style

## Acceptance Criteria
- [ ] Google Sign-In button triggers native Google picker
- [ ] Apple Sign-In button only visible on iOS
- [ ] First social login → `SocialCompleteProfileScreen` shown with phone + city fields
- [ ] Returning social login → goes directly to app (no profile completion screen)
- [ ] Google ID token exchanged with backend, returns `accessToken` + `refreshToken`
- [ ] Apple identity token exchanged with backend similarly
- [ ] Tokens stored in `react-native-keychain`
- [ ] Apple name/email stored on first login (Apple only provides once)

## Edge cases
- User cancels Google picker: no error shown, return to login screen silently
- Apple: `fullName` and `email` are `null` on subsequent logins — backend must store on first login
- Google Play Services not available (old Android): show "Google Sign-In not available on this device"
- Social user tries to set a password later: not supported in v1.0 (social users cannot set passwords)

## Definition of done
- [ ] Google Sign-In tested on Android emulator + iOS simulator
- [ ] Apple Sign-In tested on iOS device (not available in simulator)
- [ ] First-time and returning flows both work
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: medium","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-08 — Auth API endpoints (backend)
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-08] [Backend] Auth API — register, login, logout, email verify, refresh"
read -r -d '' body << 'BODY' || true
## Summary
Implement all authentication API routes: player registration, login, logout, token refresh, email verification trigger, and social login token exchange. These are the endpoints consumed by mobile and web clients.

## Reference
- PRD §6.1, §6.3, §6.6, §14 (API Surface)
- `packages/shared/src/schemas/auth.ts` — all request schemas
- E01-08 — API base layer (response shape, middleware, rate limiting)

## Routes to implement

### `POST /api/v1/auth/register`
Register a new player account.
```
Body: RegisterPlayerSchema (name, email, phone, password, dateOfBirth, city)
Response 201: { data: { userId, message: 'Verification email sent' } }
Response 400: VALIDATION_ERROR
Response 409: CONFLICT — email or phone already registered
```

**Implementation steps:**
1. Validate body with `RegisterPlayerSchema` from shared
2. Check `prisma.user.findUnique` by email — if exists → 409
3. Check `prisma.user.findUnique` by phone — if exists → 409 with "Phone already registered"
4. Hash password: `bcrypt.hash(password, 12)`
5. Create user: `prisma.user.create` with `role: 'PLAYER'`, `trustScore: 100`, `emailVerified: false`, `phoneVerified: false`
6. Send email verification (call email service from E02-09)
7. Send phone OTP (call OTP service from E02-10)
8. Return 201

**Rate limit:** 3 registration attempts per IP per hour

---

### `POST /api/v1/auth/mobile/login`
Custom mobile login returning JWT (not NextAuth session).
```
Body: { email: string, password: string }
Response 200: { data: { accessToken, refreshToken, user: { id, name, email, role } } }
Response 401: INVALID_CREDENTIALS
Response 403: EMAIL_NOT_VERIFIED | ACCOUNT_SUSPENDED
```

**Implementation:**
1. Find user by email
2. If not found: `bcrypt.compare` against dummy hash (prevent timing attacks), then return 401
3. `bcrypt.compare(password, user.passwordHash)` — if false → 401
4. If `!user.emailVerified` → 403 `EMAIL_NOT_VERIFIED`
5. If user soft-deleted or suspended (future): 403 `ACCOUNT_SUSPENDED`
6. Generate tokens:
   - `accessToken`: JWT signed with `NEXTAUTH_SECRET`, payload `{ sub: userId, role }`, expiry `15m`
   - `refreshToken`: random 64-char hex, hashed and stored in DB (`RefreshToken` model), expiry `7d`
7. Return 200 with tokens + user

**Rate limit:** 5 attempts per IP per 15 minutes (from E01-08 rate limiter)

---

### `POST /api/v1/auth/mobile/refresh`
Exchange refresh token for new access token.
```
Body: { refreshToken: string }
Response 200: { data: { accessToken } }
Response 401: INVALID_TOKEN | TOKEN_EXPIRED
```

**Implementation:**
1. Hash incoming `refreshToken`
2. Find in DB by hash, check not expired, check not revoked
3. Generate new `accessToken` (15m expiry)
4. Rotate refresh token (delete old, create new — optional for v1.0, recommended)

---

### `POST /api/v1/auth/logout`
Revoke refresh token.
```
Auth: Bearer token
Body: { refreshToken: string }
Response 200: { data: { message: 'Logged out' } }
```

Mark refresh token as revoked in DB.

---

### `POST /api/v1/auth/verify-email`
Verify email with 6-digit code.
```
Body: { userId: string, code: string }
Response 200: { data: { verified: true } }
Response 400: INVALID_CODE | CODE_EXPIRED
```

---

### `POST /api/v1/auth/social/google`
Exchange Google ID token for app tokens.
```
Body: { idToken: string }
```
1. Verify `idToken` with Google: `https://oauth2.googleapis.com/tokeninfo?id_token=xxx`
2. Extract `email`, `name`, `sub` (Google user ID)
3. Find or create user: `prisma.user.upsert` by email, set `googleId = sub`, `emailVerified: true`
4. If new user: `isNewUser = true` in response
5. Generate and return app tokens

### `POST /api/v1/auth/social/apple`
Similar to Google but verify Apple identity token using Apple's public keys (JWKS).

## New Prisma models needed (add to E01-02 or here)

### `EmailVerificationCode`
```
id, userId, code (6-digit string), expiresAt, usedAt
```

### `RefreshToken`
```
id, userId, tokenHash, expiresAt, revokedAt, createdAt
```

## Acceptance Criteria
- [ ] `POST /auth/register` with valid data creates user, returns 201
- [ ] `POST /auth/register` with duplicate email returns 409 with "Email already registered"
- [ ] `POST /auth/register` with age < 16 returns 400 with field error on `dateOfBirth`
- [ ] `POST /auth/mobile/login` returns `accessToken` (JWT, 15min expiry) + `refreshToken`
- [ ] Wrong password and non-existent email both return the same 401 error (no info leakage)
- [ ] Unverified email returns 403 `EMAIL_NOT_VERIFIED`
- [ ] `POST /auth/mobile/refresh` returns new `accessToken` given valid `refreshToken`
- [ ] Expired `refreshToken` returns 401 `TOKEN_EXPIRED`
- [ ] `POST /auth/logout` marks refresh token as revoked (subsequent refresh fails)
- [ ] Login rate limited: 6th attempt within 15min returns 429
- [ ] Google social login: new user gets `isNewUser: true` in response
- [ ] All passwords hashed with bcrypt cost 12 (verify: `bcrypt.getRounds(hash) === 12`)

## Definition of done
- [ ] All routes tested with `curl` or Postman
- [ ] Unit tests for password hashing and JWT generation
- [ ] Rate limiting confirmed (tested manually)
- [ ] No plaintext passwords or tokens in logs
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: critical","type: backend"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-09 — Email verification via Resend
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-09] [Backend] Email verification — Resend integration and verification code flow"
read -r -d '' body << 'BODY' || true
## Summary
Implement email verification using Resend. Sends a 6-digit code after registration. Code expires in 15 minutes. Includes branded HTML email template.

## Reference
- PRD §6.1 (step 2: Verify email)
- PRD §10 (email channel)

## Files to create
| File | Purpose |
|---|---|
| `apps/web/src/lib/email.ts` | Resend client + `sendEmail()` helper |
| `apps/web/src/lib/emails/verification.ts` | Email template: verification code |
| `apps/web/src/lib/emails/passwordReset.ts` | Email template: password reset (used by E02-11) |
| `apps/web/src/lib/emails/bookingConfirmation.ts` | Email template: booking confirmed (used by E05) |

## Resend setup
```typescript
// lib/email.ts
import { Resend } from 'resend'
import { env } from '@/lib/env'

const resend = new Resend(env.RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const { error } = await resend.emails.send({
    from:    'PitchUp <noreply@pitchup.ro>',
    to,
    subject,
    html,
  })
  if (error) {
    console.error('[Email] Send failed:', error)
    throw new Error(`Email send failed: ${error.message}`)
  }
}
```

## Verification code generation
```typescript
// In auth service / register handler
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()  // 6 digits
}

// Store in DB
await prisma.emailVerificationCode.create({
  data: {
    userId,
    code: otp,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),  // 15 minutes
  },
})
```

## Email template — verification code
HTML email (inline styles, no external CSS — email clients strip `<style>` tags).

Required elements:
- PitchUp logo/wordmark at top
- Green header: "Verify your email address"
- Body: "Enter this code in the app to verify your email:"
- Code displayed prominently: large monospace font, letter-spacing, `primary-600` colour
- Expiry note: "This code expires in 15 minutes."
- Footer: "If you didn't create a PitchUp account, ignore this email."

```html
<!-- Core structure (simplified) -->
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
  <div style="background: #16A34A; padding: 24px; text-align: center;">
    <h1 style="color: white; font-size: 24px; margin: 0;">PitchUp</h1>
  </div>
  <div style="padding: 32px 24px;">
    <h2>Verify your email address</h2>
    <p>Enter this code in the app:</p>
    <div style="font-family: monospace; font-size: 40px; letter-spacing: 8px;
                color: #16A34A; text-align: center; padding: 16px 0;">
      {{CODE}}
    </div>
    <p style="color: #6B7280; font-size: 14px;">Expires in 15 minutes.</p>
  </div>
</div>
```

## Resend endpoint — `POST /api/v1/auth/resend-email-verification`
```
Auth: none required (user may not be authenticated yet)
Body: { userId: string }
Response 200: { data: { message: 'Code resent' } }
Response 429: RATE_LIMITED — max 3 resends per user per hour
```

Rate limiting: store `lastResendAt` on `EmailVerificationCode` record. Block if last resend < 60 seconds ago.

## Acceptance Criteria
- [ ] Verification email sent immediately after registration
- [ ] Email arrives with 6-digit code displayed prominently
- [ ] Code expires after 15 minutes (verified: submit after 15 min → 400 `CODE_EXPIRED`)
- [ ] `POST /auth/verify-email` with correct code marks `user.emailVerified = true`
- [ ] Resend rate limited: 3rd resend within 1 hour → 429
- [ ] HTML email renders correctly in Gmail and Apple Mail (test with Resend's preview or send to real address)
- [ ] "from" address shows "PitchUp" display name

## Edge cases
- Resend fails (Resend API down): log error, return 500, do not create user account without ability to verify
- User requests verification code again with expired previous code: create new code, invalidate old
- Used code: mark `usedAt` timestamp, reject any re-use of same code

## Definition of done
- [ ] Email received and code verified end-to-end
- [ ] Resend API key confirmed working (not the test key)
- [ ] No code stored in plaintext in logs (log only `userId`, not the code itself)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: high","type: backend"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-10 — Phone OTP via Twilio
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-10] [Backend] Phone OTP — Twilio SMS integration for verification and login"
read -r -d '' body << 'BODY' || true
## Summary
Implement phone OTP via Twilio Verify or standard SMS. Sends a 6-digit code to player's phone during registration and anytime `send-phone-otp` is called. 10-minute expiry, 3 attempts max before code invalidated.

## Reference
- PRD §6.1 (step 3: Verify phone), §10 (SMS channel: OTP)

## Files to create
| File | Purpose |
|---|---|
| `apps/web/src/lib/sms.ts` | Twilio client + `sendSMS()` helper |
| `apps/web/src/lib/otp.ts` | OTP generation, storage, verification logic |

## Twilio setup — two options

### Option A: Twilio Verify (recommended)
Twilio manages OTP generation, delivery, and verification. Simpler.
```typescript
// lib/sms.ts
import twilio from 'twilio'
import { env } from '@/lib/env'

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)

export async function sendPhoneOTP(phoneNumber: string): Promise<void> {
  await client.verify.v2
    .services(env.TWILIO_VERIFY_SERVICE_SID)
    .verifications.create({ to: phoneNumber, channel: 'sms' })
}

export async function verifyPhoneOTP(phoneNumber: string, code: string): Promise<boolean> {
  const result = await client.verify.v2
    .services(env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({ to: phoneNumber, code })
  return result.status === 'approved'
}
```

### Option B: Custom OTP with Twilio SMS
If Twilio Verify is not available, generate OTP in-app and send via standard Twilio SMS:
```typescript
await client.messages.create({
  body:  `Your PitchUp verification code is: ${otp}. Valid for 10 minutes.`,
  from:  env.TWILIO_PHONE_NUMBER,
  to:    phoneNumber,
})
```
Store OTP in `PhoneVerificationCode` model (similar to `EmailVerificationCode`).

**Decision:** Use Option A (Twilio Verify) if Verify Service SID is available. Fall back to Option B. Document choice in `.env.example`.

## Endpoints

### `POST /api/v1/auth/send-phone-otp`
```
Body: { userId: string }
Response 200: { data: { message: 'OTP sent' } }
Response 429: RATE_LIMITED — max 3 sends per phone per hour
Response 400: VALIDATION_ERROR — invalid phone format
```

### `POST /api/v1/auth/verify-phone-otp`
```
Body: { userId: string, otp: string }
Response 200: { data: { verified: true } }
Response 400: INVALID_OTP — wrong code, attemptsRemaining in details
Response 410: OTP_EXPIRED — code expired
Response 429: TOO_MANY_ATTEMPTS — 3 wrong attempts, code invalidated
```

**Attempt tracking (Option B only):**
```typescript
// PhoneVerificationCode model fields
attemptsUsed  Int @default(0)
maxAttempts   Int @default(3)
```
After 3 wrong attempts: mark code as `invalidated`, return 429. User must request new OTP.

## SMS message format
```
Your PitchUp code is: 847291
Valid for 10 minutes. Don't share this code.
```
Keep under 160 characters to avoid multi-part SMS charges.

## Acceptance Criteria
- [ ] SMS received on real phone within 30 seconds of registration
- [ ] `verify-phone-otp` with correct code marks `user.phoneVerified = true`
- [ ] Wrong code: response includes `attemptsRemaining` (e.g. `{ attemptsRemaining: 2 }`)
- [ ] After 3 wrong attempts: code invalidated, 429 returned
- [ ] Expired code (> 10 min): 410 `OTP_EXPIRED`
- [ ] Rate limited: 4th OTP request within 1 hour → 429
- [ ] Phone number validated as E.164 before sending

## Edge cases
- International numbers: always store and send as E.164 (`+40712345678`)
- Twilio error (number blocked, invalid): catch and return 500 with "SMS delivery failed" — do not expose Twilio error details
- Test numbers: configure Twilio test credentials for CI (no real SMS sent)

## Definition of done
- [ ] OTP received on real Romanian number
- [ ] Verification works end-to-end with mobile screen from E02-04
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: high","type: backend"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-11 — Forgot / reset password (backend)
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-11] [Backend] Forgot password and reset password — token-based email flow"
read -r -d '' body << 'BODY' || true
## Summary
Backend implementation of forgot password (generates reset token, sends email) and reset password (validates token, updates hash). Token expires in 1 hour, single-use.

## Reference
- PRD §6.3 (Forgot password)

## Files to create / modify
| File | Purpose |
|---|---|
| `apps/web/src/app/api/v1/auth/forgot-password/route.ts` | POST handler |
| `apps/web/src/app/api/v1/auth/reset-password/route.ts` | POST handler |
| Add `PasswordResetToken` model to Prisma schema | Reset token storage |

## Prisma model — `PasswordResetToken`
```prisma
model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique  // SHA-256 hash of raw token
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## `POST /api/v1/auth/forgot-password`

**Always returns 200** — never reveal if email exists.

```typescript
// 1. Find user by email
const user = await prisma.user.findUnique({ where: { email } })
// 2. If user exists: generate token
if (user) {
  const rawToken = crypto.randomBytes(32).toString('hex')  // 64-char hex
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  await prisma.passwordResetToken.create({
    data: {
      userId:    user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),  // 1 hour
    },
  })
  // 3. Send email with reset link
  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`
  await sendEmail({ to: user.email, subject: 'Reset your PitchUp password', html: passwordResetEmail(resetUrl) })
}
// 4. Always return 200 (no info leakage)
return ok({ message: 'If this email is registered, a reset link has been sent.' })
```

**Rate limit:** 3 forgot-password requests per email per hour.

## `POST /api/v1/auth/reset-password`
```typescript
// Body: { token: string, password: string }
// 1. Hash the incoming token
const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
// 2. Find in DB
const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
if (!resetToken) return err('INVALID_TOKEN', 'Reset link is invalid', 400)
if (resetToken.expiresAt < new Date()) return err('TOKEN_EXPIRED', 'Reset link has expired', 400)
if (resetToken.usedAt) return err('INVALID_TOKEN', 'Reset link has already been used', 400)
// 3. Validate new password
// (use RegisterPlayerSchema.shape.password)
// 4. Hash and update
const passwordHash = await bcrypt.hash(password, 12)
await prisma.$transaction([
  prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
  prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  // Optionally revoke all refresh tokens for this user
  prisma.refreshToken.deleteMany({ where: { userId: resetToken.userId } }),
])
return ok({ message: 'Password reset successful' })
```

## Mobile deep link URL scheme
Reset link format: `pitchup://reset-password?token=xxx` (for mobile) OR `https://pitchup.ro/reset-password?token=xxx` (for web, redirects to app via Universal Links / App Links).

For v1.0: use web URL. Mobile intercepts via Universal Links. Fallback: web page with "Open in app" button.

## Email template — password reset
Required elements (same HTML inline style approach as verification email):
- "Reset your password" heading
- "Click the button below to reset your password. This link expires in 1 hour."
- "Reset Password" button (link to `resetUrl`) — `primary-600` background, white text
- "If you didn't request this, ignore this email."
- "This link expires in 1 hour."

## Acceptance Criteria
- [ ] `POST /forgot-password` always returns 200 regardless of whether email exists
- [ ] Password reset email received with working link
- [ ] Link contains raw token (not hash) — hash stored in DB
- [ ] Expired token (>1h) returns 400 `TOKEN_EXPIRED`
- [ ] Already-used token returns 400 `INVALID_TOKEN`
- [ ] Valid token + valid password → password updated, all refresh tokens revoked
- [ ] New password must meet strength requirements (validated with shared schema)
- [ ] `crypto.randomBytes(32)` used for token generation (not `Math.random()`)

## Definition of done
- [ ] End-to-end: request reset → receive email → click link → new password set → login with new password
- [ ] Old password no longer works after reset
- [ ] Old refresh tokens revoked (login with old refresh token fails after reset)
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: high","type: backend"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-12 — Mobile JWT infrastructure (Axios instance + interceptors)
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-12] [Mobile] API client — Axios instance with JWT auth interceptors and token refresh"
read -r -d '' body << 'BODY' || true
## Summary
Create the mobile API client (Axios instance) with authentication interceptors: attaches `Authorization: Bearer` header to every request and automatically refreshes the access token when it expires (401 → refresh → retry original request).

## Context
Every mobile API call needs the access token. Token refresh must be transparent to the caller — no manual handling of 401 in every screen.

## Files to create
| File | Purpose |
|---|---|
| `apps/mobile/src/lib/apiClient.ts` | Axios instance with interceptors |
| `apps/mobile/src/lib/tokenStorage.ts` | `react-native-keychain` wrapper |

## Token storage
```typescript
// lib/tokenStorage.ts
import * as Keychain from 'react-native-keychain'

const ACCESS_TOKEN_KEY  = 'pitchup_access_token'
const REFRESH_TOKEN_KEY = 'pitchup_refresh_token'

export const tokenStorage = {
  async setTokens(access: string, refresh: string) {
    await Keychain.setGenericPassword(ACCESS_TOKEN_KEY, access,  { service: ACCESS_TOKEN_KEY })
    await Keychain.setGenericPassword(REFRESH_TOKEN_KEY, refresh, { service: REFRESH_TOKEN_KEY })
  },
  async getAccessToken(): Promise<string | null> {
    const result = await Keychain.getGenericPassword({ service: ACCESS_TOKEN_KEY })
    return result ? result.password : null
  },
  async getRefreshToken(): Promise<string | null> {
    const result = await Keychain.getGenericPassword({ service: REFRESH_TOKEN_KEY })
    return result ? result.password : null
  },
  async clearTokens() {
    await Keychain.resetGenericPassword({ service: ACCESS_TOKEN_KEY })
    await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_KEY })
  },
}
```

## API client with interceptors
```typescript
// lib/apiClient.ts
import axios from 'axios'
import { tokenStorage } from './tokenStorage'

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1'

export const api = axios.create({ baseURL: BASE_URL, timeout: 10000 })

// Request interceptor: attach access token
api.interceptors.request.use(async config => {
  const token = await tokenStorage.getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor: handle 401, attempt token refresh
let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }
      originalRequest._retry = true
      isRefreshing = true
      try {
        const refreshToken = await tokenStorage.getRefreshToken()
        const { data } = await axios.post(`${BASE_URL}/auth/mobile/refresh`, { refreshToken })
        const newAccessToken = data.data.accessToken
        await tokenStorage.setTokens(newAccessToken, refreshToken!)
        failedQueue.forEach(p => p.resolve(newAccessToken))
        failedQueue = []
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } catch {
        failedQueue.forEach(p => p.reject(error))
        failedQueue = []
        await tokenStorage.clearTokens()
        // Navigate to Login — emit event that AuthNavigator listens to
        authEvents.emit('unauthorized')
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)
```

## Auth event bus
Simple EventEmitter for signalling unauthorized state to the Navigator:
```typescript
// lib/authEvents.ts
import { EventEmitter } from 'eventemitter3'
export const authEvents = new EventEmitter<{ unauthorized: [] }>()
```
Root Navigator listens: `authEvents.on('unauthorized', () => navigation.reset({ routes: [{ name: 'Login' }] }))`

## TanStack Query integration
Configure `QueryClient` with the `api` instance. All queries/mutations use the interceptor-equipped client — no manual token handling in screens.

## Acceptance Criteria
- [ ] Every API request includes `Authorization: Bearer <token>` header
- [ ] 401 response triggers automatic token refresh (without user seeing an error)
- [ ] After successful refresh, original failed request is retried
- [ ] Multiple concurrent 401s all wait for one refresh, then retry in order (queue works)
- [ ] If refresh fails (expired refresh token): tokens cleared, user navigated to Login
- [ ] Tokens stored in Keychain (not AsyncStorage) — verified with Flipper
- [ ] `api` instance used for all requests (no raw `fetch` or other `axios` instances)

## Definition of done
- [ ] Auth interceptor tested: expire access token manually → request retried automatically
- [ ] Refresh failure → redirect to Login confirmed
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: critical","type: frontend-mobile"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-13 — Web login page (manager portal)
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-13] [Web] Manager login page — split layout with brand panel"
read -r -d '' body << 'BODY' || true
## Summary
Build the web manager login page at `/login`. Split-screen layout: left form panel, right brand panel. Uses NextAuth `signIn()` with Credentials provider. On success, redirects to `/dashboard`.

## Reference
- UIUX_SPEC §12.1

## Files to create
| File | Purpose |
|---|---|
| `apps/web/src/app/(auth)/login/page.tsx` | Login page (Server Component wrapper) |
| `apps/web/src/app/(auth)/login/LoginForm.tsx` | Client component with form logic |
| `apps/web/src/app/(auth)/layout.tsx` | Auth layout (no sidebar) |

## Layout (UIUX_SPEC §12.1)

### Overall
- Full viewport height (`min-h-screen`)
- Two columns: `lg:grid lg:grid-cols-2`
- On mobile (< lg): only form panel visible (brand panel hidden)

### Left — Form panel
- Background: white
- Content: vertically centered, max-width 400px, horizontally centered within panel
- Horizontal padding: 48px

**Content (top to bottom):**
1. PitchUp logo + wordmark (SVG, 32px height), `primary-600` colour — top, left aligned within 400px
2. "Manager portal" chip — `#DCFCE7` (`primary-100`) bg, `#15803D` (`primary-700`) text, `label-md`, `radius-full`, 8px vertical 12px horizontal padding — 24px below logo
3. "Sign in to your account" — `display-md` (30px/700), `#111827`, 8px below chip
4. Email input (label: "Email") — 32px below heading
5. Password input (label: "Password") — 16px gap, with show/hide eye icon
6. "Forgot password?" — right-aligned, `#16A34A`, `label-md`, 8px below password
7. "Sign in" — `primary` button (`#16A34A` bg), full width (400px), `lg` size (48px), 24px below forgot password
8. "Don't have an account? **Register your company →**" — `body-md`, `#6B7280`, "Register..." in `#16A34A`, centered, 24px below button

### Right — Brand panel
- Background: `#16A34A` (`primary-600`)
- Content: centered vertically and horizontally, 48px padding
- PitchUp logo: white SVG, 64px height, centered
- Heading: "Everything you need to manage your pitches." — `display-lg` (36px/700), white, centered, 32px below logo, max-width 480px
- 3 feature bullets (32px below heading), each row: white `check-circle` icon 20px + text in `body-lg` white, 16px gap between rows:
  - "Real-time booking management"
  - "Automated payments and payouts"
  - "Analytics to grow your business"

## Form behaviour

```typescript
// LoginForm.tsx (Client Component)
'use client'
import { signIn } from 'next-auth/react'

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault()
  setLoading(true)
  const result = await signIn('credentials', {
    email,
    password,
    redirect: false,
  })
  if (result?.error === 'CredentialsSignin') {
    setError('Invalid email or password')
  } else if (result?.error === 'EMAIL_NOT_VERIFIED') {
    setError('Please verify your email before signing in.')
  } else if (result?.ok) {
    router.push('/dashboard')
  }
  setLoading(false)
}
```

## Error handling
- Display error inline below password field: `error-50` bg, `error-500` text, `radius-sm`, 8px padding, `alert-circle` icon
- Never clear password field on error (allow retry without re-typing password)

## Redirect logic
If user is already authenticated when visiting `/login`: redirect to `/dashboard` (handled in Next.js middleware from E01-09).

## Acceptance Criteria
- [ ] Page renders split layout on desktop (≥1024px)
- [ ] On mobile: only form panel visible, brand panel hidden
- [ ] Successful login redirects to `/dashboard`
- [ ] Wrong credentials: inline error below form (not browser alert)
- [ ] Unverified email: specific error message shown
- [ ] "Register your company" link goes to `/register`
- [ ] Already-authenticated users redirected away from `/login`
- [ ] No hydration errors (SSR/CSR consistent)
- [ ] Tab order: email → password → sign in button (logical keyboard nav)

## Definition of done
- [ ] Tested on Chrome, Safari, Firefox
- [ ] Tested responsive: mobile (375px), tablet (768px), desktop (1280px)
- [ ] Login flow works with NextAuth session cookie
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: high","type: frontend-web"]' \
  "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E02-14 — Web manager registration (account step)
# ─────────────────────────────────────────────────────────────────────────────
title="[E02-14] [Web] Manager account registration page — account creation step"
read -r -d '' body << 'BODY' || true
## Summary
Build the manager account creation page at `/register`. Collects name, email, phone, password. On success creates a MANAGER role account and redirects to the company setup wizard (E09). This is Step 1 of the multi-step company onboarding — only the account is created here.

## Reference
- PRD §6.2 (Registration — Manager)
- UIUX_SPEC §12.2 (first step of Company Registration Wizard)

## Files to create
| File | Purpose |
|---|---|
| `apps/web/src/app/(auth)/register/page.tsx` | Register page wrapper |
| `apps/web/src/app/(auth)/register/RegisterForm.tsx` | Client component |

## Layout
- Single column, max 640px, horizontally centered on page
- White background, 48px vertical padding
- No sidebar (uses auth layout from E02-13)

### Page header
- PitchUp logo + wordmark top, centered, 40px bottom margin
- 4-step progress indicator (connected dots):
  - Step 1: "Account" (active, `primary-600`)
  - Step 2: "Company info" (inactive, `neutral-300`)
  - Step 3: "Payments" (inactive)
  - Step 4: "Review" (inactive)
- Step label below dots: "Step 1 of 4"

### Form heading
- "Create your manager account" — `display-md` (30px/700), `#111827`, centered
- "Already have an account? Sign in" — `body-md`, `#6B7280`, "Sign in" `#16A34A`, centered, 8px below

### Form fields (same input style as web design system)
1. **Full name** — single input, label "Full name"
2. **Email address** — `type="email"`, `autocomplete="email"`
3. **Phone number** — `type="tel"`, with country code selector (HTML select or custom dropdown)
   - Default: +40 Romania
4. **Password** — with strength indicator below (4 segments, same logic as mobile)
5. **Confirm password**

16px gap between fields. No DOB for manager (PRD §6.2 does not require it).

### Submit button
- "Create account & continue →" — `primary` button (`primary-600`), full width, `lg` size
- 24px below last field

## API call
```typescript
// Server Action or fetch to:
POST /api/v1/auth/register/manager
Body: { name, email, phone, password }
// Creates user with role: MANAGER
Response 201: { data: { userId } }
// On 201: set session → redirect to /onboarding/company-info (E09)
```

Note: Manager registration uses a separate endpoint from player registration — manager does not provide `dateOfBirth` or `city` at this stage.

## Password strength bar (web)
Same logic as mobile but implemented with Tailwind CSS:
- 4 `div` segments, each `h-1 rounded-full`
- Colour classes: `bg-red-500`, `bg-amber-500`, `bg-orange-500`, `bg-green-600`
- Animate via transition on width class change

## Acceptance Criteria
- [ ] 4-step progress indicator visible, Step 1 highlighted
- [ ] All fields render with correct web input style
- [ ] Password strength bar updates live as user types
- [ ] Passwords-don't-match error shown below confirm field
- [ ] Submit disabled until all fields valid
- [ ] Successful submit creates MANAGER user + redirects to `/onboarding/company-info`
- [ ] Duplicate email → inline error "Email already registered. Sign in instead."
- [ ] Phone with country code stored as E.164

## Definition of done
- [ ] Tested on Chrome + Safari
- [ ] Account created in DB with `role: MANAGER`
- [ ] Redirect to E09 onboarding flow works
- [ ] PR merged to `main`
BODY

create_issue "$title" "$body" \
  '["epic: auth","priority: high","type: frontend-web"]' \
  "$MILESTONE"

echo ""
echo "✓ E02 — Auth: 14 issues created"
BODY
