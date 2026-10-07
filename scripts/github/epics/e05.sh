#!/usr/bin/env bash
# e05.sh — create all E05 Player: Booking Flow issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E05 — Player: Booking Flow")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E05 — Player: Booking Flow' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E05 — Player: Booking Flow)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E05-01 — Mobile: Booking Flow navigator + progress bar + discard sheet
# ─────────────────────────────────────────────────────────────────────────────
title="[E05-01] [Mobile] Booking flow navigator — modal stack, progress bar, discard confirmation"
read -r -d '' body << 'BODY' || true
## Summary
Wire the full-screen modal booking flow as a native stack navigator. Progress bar animates between steps. Cancel (X) button triggers a discard confirmation bottom sheet when past step 1. Back button pops to previous step or dismisses on step 1.

## Reference
- UIUX_SPEC §7 (intro, progress bar, step header, discard sheet)
- PRD §8.1 (booking flow)

## Files to create / modify
| File | Action |
|------|--------|
| `apps/mobile/src/navigation/BookingNavigator.tsx` | Create — modal stack with 5 step screens |
| `apps/mobile/src/screens/booking/BookingProgressBar.tsx` | Create — animated progress component |
| `apps/mobile/src/screens/booking/BookingHeader.tsx` | Create — back + step label + cancel |
| `apps/mobile/src/screens/booking/DiscardConfirmSheet.tsx` | Create — bottom sheet with Keep/Discard |
| `apps/mobile/src/navigation/RootNavigator.tsx` | Modify — present BookingNavigator as modal |

## Implementation

```typescript
// BookingNavigator.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';

export type BookingStackParamList = {
  BookingStep1: { pitchId: string; companyId: string; prefillDate?: string };
  BookingStep2: undefined;
  BookingStep3: undefined;
  BookingStep4: undefined;
  BookingStep5: undefined;
};

const Stack = createNativeStackNavigator<BookingStackParamList>();

export function BookingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="BookingStep1" component={Step1DateScreen} />
      <Stack.Screen name="BookingStep2" component={Step2TimeScreen} />
      <Stack.Screen name="BookingStep3" component={Step3TeamsScreen} />
      <Stack.Screen name="BookingStep4" component={Step4SummaryScreen} />
      <Stack.Screen name="BookingStep5" component={Step5ConfirmationScreen} />
    </Stack.Navigator>
  );
}
```

```typescript
// BookingProgressBar.tsx — animated fill
// Step 1 = 20%, 2 = 40%, 3 = 60%, 4 = 80%, 5 = 100%
// Height: 4px | Track: neutral-200 | Fill: primary-600 (#16A34A)
// Animated.timing 300ms ease-in-out on step change

// BookingHeader.tsx
// Back: chevron-left, 44×44px tap target → navigation.goBack() / dismiss on step 1
// Center: "Step X of 5" — label-sm neutral-500
// Right: X icon, 44×44px → step > 1 ? openDiscardSheet() : dismiss()

// DiscardConfirmSheet.tsx
// @gorhom/bottom-sheet, snapPoints: ['35%']
// Title: "Are you sure?" — heading-md
// Body: "Your booking details will be lost" — body-md neutral-500
// "Keep editing" → secondary button → close sheet
// "Discard" → destructive-outline button → reset bookingStore + navigation.dismiss()
```

## Zustand booking store

```typescript
// apps/mobile/src/store/bookingStore.ts
interface BookingState {
  pitchId: string | null;
  companyId: string | null;
  selectedDate: string | null;         // ISO date string "2026-10-14"
  startTime: string | null;            // "14:00"
  endTime: string | null;              // "16:00"
  teamCount: 2 | 3;
  playersPerTeam: Record<string, number>;
  needsShirts: boolean;
  shirtOrders: Array<{ teamKey: string; colour: ShirtColour; quantity: number }>;
  note: string;
  savedCardId: string | null;
  reset: () => void;
  // individual setters…
}
```

## Acceptance criteria
- [ ] Booking navigator presented as full-screen modal from Pitch Detail "Book Now"
- [ ] `prefillDate` param pre-selects date in step 1 when coming from availability grid tap
- [ ] Progress bar height 4px, animates smooth 300ms on each step advance
- [ ] Step 1 shows 20%, step 2 = 40%, 3 = 60%, 4 = 80%, 5 = 100%
- [ ] Back on step 1 dismisses modal without confirmation
- [ ] X on step 1 dismisses modal without confirmation
- [ ] X on step 2+ opens DiscardConfirmSheet
- [ ] "Keep editing" closes sheet, stays on current step
- [ ] "Discard" calls `bookingStore.reset()` and `navigation.dismiss()`
- [ ] bookingStore survives step navigation (Zustand persists in memory for session)
- [ ] No data persisted to disk (no `persist` middleware on bookingStore)

## Edge cases
- Deep-link into booking from notification — navigator must initialise with correct pitchId
- Device back gesture on Android on step 1 → dismiss (not crash)
- Device back gesture on step 2+ → go to previous step (not dismiss)

## Definition of done
- TypeScript strict, no `any`
- Navigator renders all 5 step placeholders without error
- Progress bar Animated value tested manually across all steps
- Discard sheet tested: Keep stays, Discard resets store + dismisses
BODY

create_issue "$title" "$body" '["E05 — Player: Booking Flow","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E05-02 — Mobile: Step 1 — Date picker calendar
# ─────────────────────────────────────────────────────────────────────────────
title="[E05-02] [Mobile] Booking Step 1 — Date picker calendar (44×44 cells, month swipe)"
read -r -d '' body << 'BODY' || true
## Summary
Build Step 1 of the booking flow: a month calendar where users select a date. Day cells are 44×44px. Swipe left/right navigates months. Past and closed days are non-tappable. Fully booked days show snackbar on tap.

## Reference
- UIUX_SPEC §7.1
- PRD §8.1

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/booking/Step1DateScreen.tsx` | Create |
| `apps/mobile/src/screens/booking/components/CalendarMonth.tsx` | Create |
| `apps/mobile/src/screens/booking/components/CalendarDayCell.tsx` | Create |
| `apps/mobile/src/hooks/usePitchAvailabilityRange.ts` | Create — batch availability for month view |

## Calendar spec
- Month header: "October 2026" — heading-md neutral-900 centred
- Prev/next arrows: chevron-left / chevron-right, neutral-700, 44×44px tap target
- Day labels: "MON TUE WED THU FRI SAT SUN" — label-sm neutral-400
- Cannot go to months before today's month (prev arrow disabled)
- Cannot navigate more than 60 days ahead (future limit)

## Day cell states
| State | Visual |
|-------|--------|
| Default (available) | neutral-900 text, transparent bg |
| Today | neutral-900 text + primary-600 dot (4px circle) below number |
| Selected | white text, primary-600 (#16A34A) circle bg (40px diameter) |
| Fully booked | neutral-300 text — tappable → snackbar "No available slots on this day" |
| Closed (pitch closed that day) | neutral-300 text, not tappable |
| Past | neutral-300 text, not tappable |

## Implementation

```typescript
// CalendarDayCell.tsx
interface DayCellProps {
  date: Date;
  state: 'available' | 'booked' | 'closed' | 'past' | 'selected' | 'today';
  onPress: (date: Date) => void;
}
// Cell: 44×44px TouchableOpacity
// Selected: absolute circle bg View 40×40px, borderRadius: 20, bg: '#16A34A'
// Today dot: absolute 4×4px View, borderRadius: 2, bg: '#16A34A', bottom: 4

// usePitchAvailabilityRange.ts
// Takes pitchId + month (year, month number)
// Calls GET /api/v1/pitches/:id/availability?date=YYYY-MM-01 for each week?
// Better: single endpoint returns per-day summary for a month range
// For now: call availability for each day in month in parallel via Promise.all
// Returns Map<'YYYY-MM-DD', 'available' | 'booked' | 'closed'>
```

## Month navigation
- Horizontal `PagerView` (react-native-pager-view) OR Animated.Value + PanResponder swipe
- Prefer `PagerView` for native feel
- Pre-render ±1 month for instant swipe

## Footer
- "Next" — primary button, full width, disabled until date selected
- On press: set `bookingStore.selectedDate`, navigate to Step2

## Acceptance criteria
- [ ] Calendar renders correct month grid (Mon–Sun, correct offset for month start)
- [ ] Day cells exactly 44×44px accessible tap targets
- [ ] Today has primary-600 dot below number
- [ ] Selected day has 40px primary-600 circle, white text
- [ ] Past days: not tappable, neutral-300
- [ ] Fully booked day: tappable, shows snackbar "No available slots on this day"
- [ ] Closed day (pitch closed per workingHours): not tappable, neutral-300
- [ ] Swipe left → next month, swipe right → prev month (not before current month)
- [ ] Arrows also navigate months
- [ ] Next button disabled until selection; enabled on selection
- [ ] `prefillDate` from navigator params pre-selects date and enables Next immediately
- [ ] bookingStore.selectedDate set on Next press

## Edge cases
- Month with 28 days (February non-leap) renders correctly
- Month starting on Sunday renders correct first-column offset
- Navigating to next year (December → January)
- Pitch with no working hours for an entire week (all days closed)

## Definition of done
- Renders on iOS and Android without layout overflow
- Swipe gesture does not conflict with vertical scroll (none on this screen)
- All 6 day states visually correct per spec
BODY

create_issue "$title" "$body" '["E05 — Player: Booking Flow","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E05-03 — Mobile: Step 2 — Time slot grid with drag-select and price preview
# ─────────────────────────────────────────────────────────────────────────────
title="[E05-03] [Mobile] Booking Step 2 — Time slot grid (40px/30min, range select, price preview)"
read -r -d '' body << 'BODY' || true
## Summary
Build Step 2: a scrollable time grid for the selected date. 30-min slots are 40px tall. User taps start slot then end slot to create a selection range. Booked cells block the selection. Price preview strip updates live.

## Reference
- UIUX_SPEC §7.2
- PRD §8.1, §14 (availability endpoint)

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/booking/Step2TimeScreen.tsx` | Create |
| `apps/mobile/src/screens/booking/components/SlotGrid.tsx` | Create |
| `apps/mobile/src/screens/booking/components/SlotCell.tsx` | Create |
| `apps/mobile/src/screens/booking/components/PricePreviewStrip.tsx` | Create |
| `apps/mobile/src/screens/booking/components/DurationPill.tsx` | Create |
| `apps/mobile/src/hooks/useSlotAvailability.ts` | Create — fetches & parses availability |

## Slot grid spec
- Time label column: 48px wide, label-sm neutral-500, every 30 min from open to close
- Slot cells: flex-1, height 40px, 1px neutral-100 divider between cells
- Current time marker: 1px accent-500 (#F97316) dashed line with 6px filled circle on left edge
  - Positioned proportionally by (currentMinute - openMinute) / 30 * 40px
  - Updates every 60s

## Slot cell states
| State | Visual |
|-------|--------|
| Available (unselected) | white bg |
| Booked | neutral-100 bg, neutral-300 text with strikethrough label "Booked" |
| Selected — start | primary-600 bg, white text, top-left + top-right border-radius 8 |
| Selected — end | primary-600 bg, white text, bottom-left + bottom-right border-radius 8 |
| Selected — middle | primary-100 bg, left border 3px primary-600, no radius |
| Past (today only) | neutral-50 bg, not tappable |

## Selection interaction
1. Tap available cell → set as selectionStart (highlighted with start style)
2. Tap cell below selectionStart → set as selectionEnd → range highlights
3. If any booked cell in range: snap selectionEnd to just before that booked cell
4. Tap same cell as selectionStart twice → deselect (clear selection)
5. Tap cell above selectionStart → reset: new selectionStart = tapped cell
6. Min selection: 1 slot (30 min)

## Duration pill
- Before selection: "Select a start and end time" — label-md neutral-700
- After selection: "2h 00min" — label-md neutral-700
- Container: neutral-100 bg, radius-full, 8px horizontal padding, 6px vertical, centred top of grid

## Price preview strip
- Sticky at bottom of grid, above Next button
- White bg, 12px padding
- Text: "2h × 80 RON/h = **160 RON**"
- body-md neutral-700, bold value neutral-900
- Hidden until interval selected
- Uses peak/off-peak rate based on time of day (peak = 16:00–22:00, from pitch data)

## Implementation

```typescript
// useSlotAvailability.ts
// Calls GET /api/v1/pitches/:id/availability?date=YYYY-MM-DD (from E04-03)
// Returns: Array<{ time: string; status: 'available' | 'booked' | 'closed' }>

// SlotGrid.tsx
// ScrollView (vertical)
// ScrollTo current time slot on mount (if today)
// Maps slots to SlotCell — passes state derived from: availability + selectionStart + selectionEnd

// Price calculation
function calculatePrice(
  startTime: string,
  endTime: string,
  offPeakRate: number,
  peakRate: number
): number {
  // Split into 30-min intervals
  // Each interval: check if >= 16:00 && < 22:00 → peakRate, else offPeakRate
  // Sum (rate / 2) for each 30-min block
}
```

## Footer
- "Next" — primary button, disabled until valid interval (≥ 1 slot) selected
- On press: set `bookingStore.startTime`, `bookingStore.endTime`, navigate to Step3

## Acceptance criteria
- [ ] Grid renders from pitch open time to close time on selected date
- [ ] Slot cells exactly 40px height
- [ ] Time labels every 30 min, aligned to cell midpoints
- [ ] Booked slots (from API) not selectable — styled as booked
- [ ] Tap start → highlighted as selection start
- [ ] Tap end below start → range highlights with correct per-cell styles
- [ ] Left border 3px primary-600 continuous from start to end cells (middle cells)
- [ ] Booked cell blocks selection range — snaps end to before booked cell
- [ ] Tap start twice → clears selection
- [ ] Duration pill updates: "1h 00min", "1h 30min", "2h 00min" etc.
- [ ] Price preview shows correct calculation (off-peak vs peak rate)
- [ ] Current time dashed line rendered at correct pixel position
- [ ] List scrolls to current time on mount (if booking for today)
- [ ] Next disabled until valid selection; navigates to Step3 on press

## Edge cases
- All slots booked: show empty state "No slots available for this date" with "← Change date" button
- Pitch closes at midnight — grid ends at 23:30 (last bookable slot)
- User selects across peak/off-peak boundary — price correctly blends rates
- Very long day (08:00–23:00 = 30 slots) — grid scrollable without performance issues

## Definition of done
- Smooth scroll on both iOS/Android (FlatList or optimized ScrollView)
- No layout jank when selection state changes
- Price calculation unit tested in `packages/shared/src/utils/pricing.test.ts`
BODY

create_issue "$title" "$body" '["E05 — Player: Booking Flow","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E05-04 — Mobile: Step 3 — Teams & Shirts
# ─────────────────────────────────────────────────────────────────────────────
title="[E05-04] [Mobile] Booking Step 3 — Teams & shirts (segmented control, steppers, colour swatches)"
read -r -d '' body << 'BODY' || true
## Summary
Build Step 3: team count selection, optional players-per-team steppers, shirt colour picker with quantity steppers, optional note field, and live price summary. Shirt section animates in/out when toggle changes.

## Reference
- UIUX_SPEC §7.3
- PRD §8.1

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/booking/Step3TeamsScreen.tsx` | Create |
| `apps/mobile/src/screens/booking/components/TeamSegmentedControl.tsx` | Create |
| `apps/mobile/src/screens/booking/components/PlayerStepper.tsx` | Create |
| `apps/mobile/src/screens/booking/components/ShirtColourPicker.tsx` | Create |
| `apps/mobile/src/screens/booking/components/BookingPriceSummary.tsx` | Create |

## TeamSegmentedControl spec
- Options: "2 Teams" | "3 Teams"
- Full width, equal segments
- Selected: white bg, shadow-xs, neutral-900 text, radius-sm
- Unselected: transparent, neutral-500 text
- Container: neutral-100 bg, radius-sm, 3px padding

## PlayerStepper spec (per team)
- "−" button | count | "+" button
- Button size: 44×44px tap target
- Count: 40px wide centred, body-lg neutral-900
- Min: 1, Max: 15
- At min: "−" icon neutral-300 (disabled)
- At max: "+" icon neutral-300 (disabled)

## Shirt colour swatches
All 8 colours always rendered (scroll horizontally if needed on small screens):
| Colour | Hex |
|--------|-----|
| RED | #EF4444 |
| BLUE | #3B82F6 |
| GREEN | #22C55E |
| YELLOW | #FBBF24 |
| ORANGE | #F97316 |
| WHITE | #F9FAFB (+ neutral-200 border) |
| BLACK | #111827 |
| PURPLE | #A855F7 |

- Swatch: 36×36px circle
- Selected: 3px neutral-900 ring (ring = border: 3px solid #111827 with 2px transparent gap → use outline technique with wrapping View)
- Tap → select colour for that team

## Shirt availability warning
- After colour selected: check `shirtInventory` for that colour + pitchId
- If `availableQty < requestedQty`: yellow warning `body-sm warning-500`: "Only X available in this colour"
- Fetch via `GET /api/v1/pitches/:id/inventory?colour=RED`

## Note to manager
- Multiline TextInput, min-height 80px, auto-expands
- Max 200 chars
- Character counter bottom-right: "XX / 200" — label-sm neutral-400
- Label: "Note to manager (optional)" — label-md neutral-700

## Shirt section animation
- LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut) before toggling `needsShirts`
- Section appears/disappears smoothly

## BookingPriceSummary
- Row: "Pitch rental" + formatted price (duration × rate)
- Row (if shirts ordered): "Shirt rental" + total shirt cost
- Divider
- Row: "**Total**" + **total** (heading-sm, price font for value)
- Updates reactively from bookingStore

## Acceptance criteria
- [ ] Segmented control switches between 2 and 3 teams
- [ ] 3-team mode adds Team C stepper row
- [ ] Player count defaults to 5 per team, min 1, max 15
- [ ] Buttons at min/max visually disabled and not pressable
- [ ] "I need shirts" toggle: off = section hidden, on = section visible (animated)
- [ ] Each team gets independent colour selector and quantity stepper
- [ ] Colour swatches 36×36px with 3px ring on selected
- [ ] WHITE swatch has neutral-200 border (visible against white bg)
- [ ] Shirt quantity stepper min 1, max = `availableQty` for selected colour
- [ ] Warning shown when inventory insufficient
- [ ] Note field max 200 chars with counter
- [ ] Price summary updates live as shirts/players change
- [ ] "Next" always enabled (step 3 is fully optional)
- [ ] On Next: save all values to bookingStore, navigate to Step4

## Edge cases
- Pitch has no shirt inventory at all → shirt section toggle still shows but warns "Shirt rental not available for this pitch" when toggled on
- User changes colour after selecting quantity → re-check inventory for new colour
- User switches 3-team → 2-team → Team C data cleared from store

## Definition of done
- LayoutAnimation does not cause flicker on Android (test on real device)
- Colour ring visible on all 8 swatches including dark backgrounds
- Price summary math correct: shirts = qty × shirtRate, pitch = duration_hours × rate
BODY

create_issue "$title" "$body" '["E05 — Player: Booking Flow","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E05-05 — Mobile: Step 4 — Summary & Payment
# ─────────────────────────────────────────────────────────────────────────────
title="[E05-05] [Mobile] Booking Step 4 — Summary & payment (Stripe CardField, price breakdown, confirm)"
read -r -d '' body << 'BODY' || true
## Summary
Build Step 4: full booking summary card, price breakdown with platform fee, cancellation policy notice, payment method selection (saved card or add new via Stripe CardField). Confirm & Pay triggers backend booking creation.

## Reference
- UIUX_SPEC §7.4
- PRD §8.1, §10 (payments)

## Files to create / modify
| File | Action |
|------|--------|
| `apps/mobile/src/screens/booking/Step4SummaryScreen.tsx` | Create |
| `apps/mobile/src/screens/booking/components/BookingSummaryCard.tsx` | Create |
| `apps/mobile/src/screens/booking/components/PriceBreakdownCard.tsx` | Create |
| `apps/mobile/src/screens/booking/components/CancellationPolicyCard.tsx` | Create |
| `apps/mobile/src/screens/booking/components/PaymentMethodSelector.tsx` | Create |
| `apps/mobile/src/screens/booking/components/StripeCardSheet.tsx` | Create |

## BookingSummaryCard spec
- neutral-50 bg, radius-md, 16px padding
- Icon rows (each 20px icon + label + value):
  - `calendar` icon — date: "Tuesday, 14 October 2026"
  - `clock-outline` — "14:00 – 16:00 (2h)"
  - `map-marker` — "{Pitch name} · {Company name}"
  - `account-group` — "2 teams · 10 players total"
  - `tshirt-crew` — "Team A: 5 red shirts, Team B: 5 blue shirts" (if ordered; omit row if no shirts)
  - `note-text` — note text truncated to 1 line (if entered; omit row if empty)

## PriceBreakdownCard spec
- white bg, shadow-sm, radius-md, 16px padding
- "Price breakdown" — heading-sm
- Row: "Pitch rental (2h × 80 RON/h)" + "160 RON" — body-md
- Row: "Shirt rental (10 shirts × 5 RON)" + "50 RON" — body-md (omit if no shirts)
- Row: "Platform fee" + "XX RON" — body-md + info `ⓘ` icon → tooltip "Helps keep PitchUp free for players"
- Divider: 1px neutral-200
- Row: "**Total**" + "**210 RON**" — heading-sm, price font for value

Platform fee = 5% of pitch rental subtotal (round up to nearest leu).

## CancellationPolicyCard spec
- info-50 (#EFF6FF) bg, 3px info-500 (#3B82F6) left border, right-corners radius-sm, 12px padding
- info-circle icon + "Free cancellation until {date} at {time}" — body-sm neutral-700
- Second line: policy text from PRD §12:
  - > 24h before: 100% refund
  - 12–24h before: 50% refund
  - < 12h before: no refund
- Show which policy applies based on `startTime - now`

## PaymentMethodSelector spec
- "Payment method" — heading-sm
- Saved card row (from `GET /payments/methods`):
  - Card brand logo (Visa png / Mastercard png, 32px wide) + "···· 4242" + "12/28" — body-md
  - Right: check-circle primary-600 if selected, empty circle if not
  - 44×44px tap target, entire row tappable
- "+ Add new card" row:
  - plus icon primary-600 + "Add new card" label-md primary-600
  - Tap → open StripeCardSheet modal

## StripeCardSheet
- @stripe/stripe-react-native `CardField` component
- Fields: card number, expiry, CVC
- "Save this card" Toggle (on by default)
- "Add card" → primary button
- On success: refetch payment methods, auto-select new card
- On error: show error.message in red below CardField

## Confirm & Pay button
- "Confirm & Pay 210 RON" — cta button (accent-500 #F97316), full width, xl size
- Loading: ActivityIndicator in button, text "Processing..."
- On error: Animated.sequence shake (3× translate ±8px, 50ms each), Toast with error
- Disabled if: no payment method selected

## On press flow
1. Call `POST /api/v1/bookings` with full payload
2. API creates payment intent → returns `clientSecret`
3. Call `stripe.confirmPayment(clientSecret, { paymentMethodId })`
4. On payment success → navigate to Step5
5. On payment failure → show error toast, remain on Step4

## Acceptance criteria
- [ ] Summary card shows all booking details from bookingStore (correct date, time, teams, shirts, note)
- [ ] Price breakdown math correct including platform fee
- [ ] Platform fee info icon opens tooltip
- [ ] Cancellation policy card shows correct policy + free cancellation deadline
- [ ] Saved cards loaded from API and displayed
- [ ] Selecting card sets it as active (check-circle)
- [ ] "Add new card" opens StripeCardSheet
- [ ] New card saved when "Save this card" toggle is on
- [ ] Confirm & Pay disabled with no payment method
- [ ] Loading state shown during API call
- [ ] Shake animation + toast on payment failure
- [ ] Navigates to Step5 on success

## Edge cases
- No saved cards: selector shows only "+ Add new card"
- Payment declined by Stripe: display Stripe error message verbatim
- Network timeout during payment: show "Payment failed — please try again"
- User backgrounds app during payment: handle `stripe.retrievePaymentIntent` on foreground to check status

## Definition of done
- Stripe integration tested with test card 4242 4242 4242 4242
- Declined card 4000 0000 0000 0002 shows error correctly
- Platform fee visible and computed server-side (not client-derived)
BODY

create_issue "$title" "$body" '["E05 — Player: Booking Flow","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E05-06 — Mobile: Step 5 — Booking Confirmation screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E05-06] [Mobile] Booking Step 5 — Confirmation screen (animated checkmark, summary card, actions)"
read -r -d '' body << 'BODY' || true
## Summary
Build the final confirmation screen shown after successful payment. Animated SVG checkmark draws in 600ms then pulses. Summary card shows booking ID and key details. Two action buttons.

## Reference
- UIUX_SPEC §7.5
- PRD §8.1

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/booking/Step5ConfirmationScreen.tsx` | Create |
| `apps/mobile/src/screens/booking/components/AnimatedCheckmark.tsx` | Create |
| `apps/mobile/src/screens/booking/components/ConfirmationSummaryCard.tsx` | Create |

## AnimatedCheckmark spec
- SVG circle: 80×80px, stroke primary-600 (#16A34A), strokeWidth 3
- Checkmark path drawn via `react-native-svg` + `Animated.Value` for `strokeDashoffset`
- Animation sequence:
  1. Circle fade in (200ms)
  2. Checkmark stroke draw (600ms, linear)
  3. Pulse: scale 1.0 → 1.05 → 1.0 (800ms, ease-in-out)
- Start animation on mount

```typescript
// AnimatedCheckmark.tsx
import { Svg, Circle, Path } from 'react-native-svg';
import Animated, { useSharedValue, withTiming, withSequence, withDelay } from 'react-native-reanimated';

// Circle bg: filled primary-600, 80×80
// Checkmark: white stroke, path "M 20,40 L 36,56 L 60,28"
// Use react-native-reanimated v3 animated SVG wrapper
```

## Screen layout
- Background: white
- Top 40% of screen: AnimatedCheckmark centered
- "Booking confirmed!" — heading-xl neutral-900, centred, 24px below checkmark
- "Get ready to play!" — body-md neutral-500, 8px below title

## ConfirmationSummaryCard
- neutral-50 bg, radius-md, 16px horizontal margin
- Booking ID: "#AB12CD" — label-sm neutral-400, monospace font, centred
- Pitch name — heading-sm neutral-900, centred
- Company name — body-md neutral-500, centred
- Date + time — body-md neutral-700, centred
- "Total paid: XX RON" — label-md primary-600, centred

## Actions
- "View my booking" — primary button, full width, 24px horizontal margin
  - → Navigate to BookingDetailScreen (E06)
  - Dismisses booking modal first
- "Back to Discover" — ghost button, full width, 8px below first button
  - → navigation.dismiss() (closes booking modal)
  - Discover tab will be focused (already was, modal sits on top)

## Acceptance criteria
- [ ] Checkmark animation plays on mount (circle → stroke draw → pulse)
- [ ] Animation does not replay if user navigates back (step 5 has no back button)
- [ ] Back button hidden on step 5 (progress 100%)
- [ ] X (cancel) hidden on step 5 (booking complete)
- [ ] Booking ID displayed in monospace
- [ ] All summary data from bookingStore displayed correctly
- [ ] "View my booking" dismisses modal + opens BookingDetailScreen with correct bookingId
- [ ] "Back to Discover" dismisses modal, Discover tab visible
- [ ] bookingStore.reset() called after navigation (cleanup)

## Edge cases
- User hard-presses back (Android) on step 5 → go to Discover (not step 4)
- `react-native-svg` Animated wrapper not available → fallback to Lottie animation file

## Definition of done
- Animation smooth at 60fps on mid-range Android device
- No memory leak from animation (cleanup on unmount)
- MonospaceBookingId font: `fontFamily: 'Courier New'` (available on both platforms without custom font install)
BODY

create_issue "$title" "$body" '["E05 — Player: Booking Flow","type: feature","platform: mobile","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E05-07 — Backend: POST /bookings — conflict check + Stripe payment intent
# ─────────────────────────────────────────────────────────────────────────────
title="[E05-07] [Backend] POST /bookings — conflict check (DB transaction), Stripe PaymentIntent creation"
read -r -d '' body << 'BODY' || true
## Summary
Implement `POST /api/v1/bookings`. Validates payload, checks slot availability inside a Prisma transaction (optimistic locking), creates a Booking row with status PENDING, creates a Stripe PaymentIntent, and returns the client secret for mobile to confirm payment.

## Reference
- PRD §8.1, §10, §14
- Related: E04-03 (availability), E05-05 (payment flow), E05-08 (webhook)

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/bookings/route.ts` | Create |
| `apps/web/src/lib/stripe.ts` | Create — Stripe server client singleton |
| `apps/web/src/lib/booking.ts` | Create — pure business logic helpers |

## Request payload (validated via Zod)
```typescript
// packages/shared/src/schemas/booking.ts
export const CreateBookingSchema = z.object({
  pitchId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),  // "2026-10-14"
  startTime: z.string().regex(/^\d{2}:\d{2}$/),    // "14:00"
  endTime: z.string().regex(/^\d{2}:\d{2}$/),      // "16:00"
  teamCount: z.union([z.literal(2), z.literal(3)]),
  playersPerTeam: z.record(z.string(), z.number().int().min(1).max(15)),
  shirtOrders: z.array(z.object({
    teamKey: z.string(),
    colour: ShirtColourEnum,
    quantity: z.number().int().min(1),
  })).optional().default([]),
  note: z.string().max(200).optional(),
  savedPaymentMethodId: z.string().optional(),
});
```

## Endpoint logic
```typescript
// POST /api/v1/bookings
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  const body = await validateBody(req, CreateBookingSchema);

  // 1. Fetch pitch + company (verify ACTIVE status + company not suspended)
  // 2. Validate date is not in the past
  // 3. Validate time range within pitch working hours
  // 4. DB transaction: SELECT FOR UPDATE on Booking rows overlapping the slot
  //    → if any PENDING or CONFIRMED bookings overlap → return 409 CONFLICT
  // 5. Validate shirt inventory (if shirtOrders non-empty) — inside same transaction
  // 6. Calculate total (pitch rental + shirt rental + platform fee)
  // 7. Create Booking row (status: PENDING)
  // 8. Create Stripe PaymentIntent (amount in bani = RON × 100)
  // 9. Store paymentIntentId on Booking row
  // 10. Return { bookingId, clientSecret, totalAmount }
}
```

## Conflict check SQL (via Prisma)
```typescript
const conflicts = await tx.booking.findMany({
  where: {
    pitchId: body.pitchId,
    date: new Date(body.date),
    status: { in: ['PENDING', 'CONFIRMED'] },
    AND: [
      { startTime: { lt: body.endTime } },
      { endTime: { gt: body.startTime } },
    ],
  },
  select: { id: true },
});
if (conflicts.length > 0) {
  return err('SLOT_CONFLICT', 'Selected time slot is no longer available', 409);
}
```

## Platform fee calculation
```typescript
// packages/shared/src/utils/pricing.ts
export function calcPlatformFee(pitchRental: number): number {
  return Math.ceil(pitchRental * 0.05);
}
```

## Stripe PaymentIntent
```typescript
// lib/stripe.ts
import Stripe from 'stripe';
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// In route:
const paymentIntent = await stripe.paymentIntents.create({
  amount: totalAmount * 100, // bani
  currency: 'ron',
  customer: user.stripeCustomerId ?? undefined,
  payment_method: body.savedPaymentMethodId ?? undefined,
  confirm: false, // mobile confirms
  metadata: { bookingId: booking.id, userId: user.id },
});
```

## Response
```json
{
  "data": {
    "bookingId": "clxyz...",
    "clientSecret": "pi_xxx_secret_yyy",
    "totalAmount": 210
  },
  "error": null
}
```

## Acceptance criteria
- [ ] Requires auth (401 if unauthenticated)
- [ ] Validates all fields with Zod; returns 422 on invalid input
- [ ] Fetches pitch; returns 404 if not found, 403 if INACTIVE or company SUSPENDED
- [ ] Rejects past dates (400)
- [ ] Rejects times outside pitch working hours (400)
- [ ] Conflict check uses DB transaction — concurrent requests cannot double-book
- [ ] Returns 409 with error code `SLOT_CONFLICT` if overlap found
- [ ] Booking created with status PENDING before Stripe call
- [ ] Platform fee = ceil(pitchRental × 0.05)
- [ ] PaymentIntent amount in bani (RON × 100)
- [ ] Returns clientSecret for mobile to confirm
- [ ] bookingId stored in PaymentIntent metadata

## Security
- `STRIPE_SECRET_KEY` server-only env var — never logged, never returned to client
- Rate limit: 10 booking attempts per user per 10 min (prevent abuse)
- User's trust score checked: if < 30 → 403 with `TRUST_SCORE_TOO_LOW`

## Edge cases
- User has no `stripeCustomerId` yet → create Stripe customer on first booking, save to DB
- Shirt inventory insufficient between validation and create → transaction rolls back → 409
- Stripe API down → return 503, do NOT create Booking row (check Stripe call before row creation order)

## Definition of done
- Integration test with real Prisma test DB verifying conflict detection
- Stripe test mode (test key) — no real charges
- No plaintext amounts in logs (log bookingId + currency only)
BODY

create_issue "$title" "$body" '["E05 — Player: Booking Flow","type: feature","platform: backend","priority: critical"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E05-08 — Backend: Stripe webhook handler
# ─────────────────────────────────────────────────────────────────────────────
title="[E05-08] [Backend] POST /payments/webhook — Stripe webhook handler, booking status lifecycle"
read -r -d '' body << 'BODY' || true
## Summary
Implement the Stripe webhook endpoint that handles payment lifecycle events. Confirms bookings on successful payment, cancels on failure/refund, handles Stripe Connect events for manager payouts. All events idempotent.

## Reference
- PRD §10 (payments), §12 (cancellation/refund)
- Related: E05-07 (booking creation), E09 (manager onboarding / Connect)

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/payments/webhook/route.ts` | Create |
| `apps/web/src/lib/webhookHandlers.ts` | Create — handler functions per event type |

## Critical: raw body verification
```typescript
// route.ts — must use raw body, not parsed JSON
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotency: check if event.id already processed in DB (optional StripeEvent table)
  await handleStripeEvent(event);
  return NextResponse.json({ received: true });
}
```

## Events to handle

### `payment_intent.succeeded`
```typescript
async function onPaymentSucceeded(pi: Stripe.PaymentIntent) {
  const { bookingId } = pi.metadata;
  await prisma.booking.update({
    where: { id: bookingId, status: 'PENDING' },
    data: {
      status: 'CONFIRMED',
      paidAt: new Date(),
      paymentIntentId: pi.id,
      amountPaid: pi.amount / 100,
    },
  });
  // Send confirmation email (Resend)
  // Send push notification to player (FCM)
  // Send push notification to manager (FCM)
  // Reserve shirt inventory (decrement availableQty)
}
```

### `payment_intent.payment_failed`
```typescript
async function onPaymentFailed(pi: Stripe.PaymentIntent) {
  const { bookingId } = pi.metadata;
  await prisma.booking.update({
    where: { id: bookingId, status: 'PENDING' },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'PAYMENT_FAILED' },
  });
  // No notification to manager — payment never went through
}
```

### `charge.refunded`
```typescript
async function onChargeRefunded(charge: Stripe.Charge) {
  // Find booking by paymentIntentId
  // Update refundAmount on Booking
  // Send refund confirmation email to player
}
```

### `account.updated` (Stripe Connect)
```typescript
async function onConnectAccountUpdated(account: Stripe.Account) {
  // Find Company by stripeAccountId
  // Update payoutsEnabled, chargesEnabled flags in DB
}
```

## Idempotency
- Store processed `event.id` in a `StripeWebhookEvent` table (id, processedAt)
- On duplicate: return 200 immediately without re-processing
- Alternatively use `on conflict do nothing` upsert

## Acceptance criteria
- [ ] Endpoint rejects requests without valid Stripe signature (400)
- [ ] Raw body used for signature verification (not parsed JSON)
- [ ] `payment_intent.succeeded` → booking status CONFIRMED, paidAt set
- [ ] `payment_intent.payment_failed` → booking status CANCELLED
- [ ] `charge.refunded` → refundAmount stored on booking
- [ ] `account.updated` → company Stripe flags synced
- [ ] All handlers idempotent (safe to receive same event twice)
- [ ] Webhook endpoint is NOT behind `requireAuth()` middleware (public, verified by signature)
- [ ] Errors in handlers don't crash endpoint — catch + log, return 200 to Stripe

## Security
- `STRIPE_WEBHOOK_SECRET` server-only env var
- Endpoint excluded from CSRF middleware
- Never log raw Stripe event payload (may contain card data)
- Response always 200 to Stripe (even on handler error) — prevents Stripe retries flooding

## Edge cases
- Booking already CONFIRMED when `payment_intent.succeeded` fires again → no-op (idempotency)
- Booking row missing for bookingId in metadata → log error, return 200 (orphaned PI)
- Shirt inventory decrement fails → do not block booking confirmation, alert via Sentry

## Local testing
```bash
# Stripe CLI webhook forwarding
stripe listen --forward-to localhost:3000/api/v1/payments/webhook
stripe trigger payment_intent.succeeded
```

## Definition of done
- Tested with `stripe trigger` for all 4 event types
- Idempotency verified: triggering same event twice = no duplicate DB writes
- Raw body verification working (Next.js `req.text()` not `req.json()`)
BODY

create_issue "$title" "$body" '["E05 — Player: Booking Flow","type: feature","platform: backend","priority: critical"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E05-09 — Backend: Stripe payment infrastructure (SDK, saved cards, methods API)
# ─────────────────────────────────────────────────────────────────────────────
title="[E05-09] [Backend] Stripe payment infrastructure — saved cards, GET /payments/methods, setup intent"
read -r -d '' body << 'BODY' || true
## Summary
Wire Stripe payment method management: list saved cards, add new card via SetupIntent, delete card. Used by Step 4 payment selector. Stripe customer created lazily on first booking.

## Reference
- PRD §10
- Related: E05-05 (Step4 UI), E05-07 (booking POST)

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/payments/methods/route.ts` | Create — GET list, DELETE |
| `apps/web/src/app/api/v1/payments/setup-intent/route.ts` | Create — POST create SetupIntent |
| `apps/web/src/lib/stripeCustomer.ts` | Create — lazy customer create/get |

## GET /payments/methods
```typescript
// requireAuth
// Get user.stripeCustomerId; if null → return []
// stripe.paymentMethods.list({ customer, type: 'card' })
// Return:
[{
  "id": "pm_xxx",
  "brand": "visa",      // "visa" | "mastercard" | "amex"
  "last4": "4242",
  "expMonth": 12,
  "expYear": 2028,
  "isDefault": true
}]
```

## POST /payments/setup-intent
```typescript
// requireAuth
// Ensure stripeCustomerId exists (create if not)
// stripe.setupIntents.create({ customer, usage: 'off_session' })
// Return: { clientSecret: 'seti_xxx_secret_yyy' }
// Mobile uses this to collect card without charging
```

## DELETE /payments/methods/:id
```typescript
// requireAuth
// Verify PM belongs to this user's stripe customer (list PMs, check id exists)
// stripe.paymentMethods.detach(pmId)
// Return 204
```

## Lazy Stripe customer creation
```typescript
// lib/stripeCustomer.ts
export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.fullName ?? undefined,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
```

## Mobile usage (SetupIntent flow)
```typescript
// Mobile: call POST /payments/setup-intent → get clientSecret
// Then: stripe.confirmSetupIntent(clientSecret, { paymentMethodType: 'Card' })
// Stripe SDK handles card collection via presentPaymentSheet
// After confirmation: GET /payments/methods to refresh list
```

## Acceptance criteria
- [ ] GET /payments/methods returns empty array if no customer or no saved cards
- [ ] GET lists all saved cards for authenticated user only
- [ ] POST /setup-intent creates customer if none exists, saves stripeCustomerId to DB
- [ ] POST /setup-intent returns valid clientSecret for mobile card collection
- [ ] DELETE detaches card from Stripe; returns 404 if PM not found on this customer
- [ ] DELETE cannot detach other users' cards (authorization check)
- [ ] Stripe customer created with correct email + name

## Security
- stripeCustomerId stored in User model — never returned in API responses except methods endpoint
- PM id verified against user's customer before detach (prevent IDOR)
- All endpoints require auth

## Acceptance criteria (continued)
- [ ] `stripeCustomerId` field added to Prisma User model (migration)
- [ ] `isDefault` flag: first card saved = default; can be updated later

## Definition of done
- Tested with Stripe test cards
- IDOR test: user A cannot delete user B's payment method
- Customer creation idempotent: calling getOrCreateStripeCustomer twice = 1 Stripe customer
BODY

create_issue "$title" "$body" '["E05 — Player: Booking Flow","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E05-10 — Web: Booking flow pages
# ─────────────────────────────────────────────────────────────────────────────
title="[E05-10] [Web] Booking flow pages — multi-step form, Stripe Elements, confirmation page"
read -r -d '' body << 'BODY' || true
## Summary
Build the web booking flow as a multi-page form under `/book/[pitchId]`. 5 steps matching mobile. Uses Next.js App Router pages with URL-based step state. Stripe Elements for card input. Fully accessible keyboard navigation.

## Reference
- UIUX_SPEC §7 (all steps — adapt for desktop layout)
- PRD §8.1

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/book/[pitchId]/layout.tsx` | Create — sticky progress bar + step nav |
| `apps/web/src/app/book/[pitchId]/date/page.tsx` | Create — Step 1: date picker |
| `apps/web/src/app/book/[pitchId]/time/page.tsx` | Create — Step 2: time slot grid |
| `apps/web/src/app/book/[pitchId]/teams/page.tsx` | Create — Step 3: teams & shirts |
| `apps/web/src/app/book/[pitchId]/summary/page.tsx` | Create — Step 4: summary + payment |
| `apps/web/src/app/book/[pitchId]/confirmation/page.tsx` | Create — Step 5: confirmation |
| `apps/web/src/components/booking/WebCalendar.tsx` | Create — month calendar (web) |
| `apps/web/src/components/booking/WebSlotGrid.tsx` | Create — time slot grid (web) |
| `apps/web/src/lib/bookingSessionStorage.ts` | Create — sessionStorage state between steps |

## URL structure
```
/book/[pitchId]/date        ← step 1
/book/[pitchId]/time        ← step 2
/book/[pitchId]/teams       ← step 3
/book/[pitchId]/summary     ← step 4
/book/[pitchId]/confirmation ← step 5
```

## Layout spec
- Max-width container: 640px centred on desktop (full width on mobile)
- Progress bar: 4px, primary-600 fill, full width (same spec as mobile)
- Step indicator: "Step X of 5" — label-sm neutral-500, centred
- Cancel link: "✕ Cancel" top right → confirm dialog → back to pitch detail

## Step state persistence
- Use `sessionStorage` keyed by pitchId (not URL params — avoid sensitive data in URL)
- Cleared on step 5 confirmation or explicit cancel

```typescript
// bookingSessionStorage.ts
const KEY = (pitchId: string) => `booking_${pitchId}`;
export const getBookingDraft = (pitchId: string): Partial<BookingDraft> =>
  JSON.parse(sessionStorage.getItem(KEY(pitchId)) ?? '{}');
export const setBookingDraft = (pitchId: string, draft: Partial<BookingDraft>) =>
  sessionStorage.setItem(KEY(pitchId), JSON.stringify(draft));
export const clearBookingDraft = (pitchId: string) =>
  sessionStorage.removeItem(KEY(pitchId));
```

## WebCalendar (Step 1)
- React component (no RN-specific deps)
- Same day states as mobile: available, today, selected, booked, closed, past
- Keyboard navigation: arrow keys move day, Enter selects
- ARIA: `role="grid"`, each cell `role="gridcell"`, `aria-selected`, `aria-disabled`
- Month navigation: prev/next buttons with `aria-label="Previous month"` / `"Next month"`

## WebSlotGrid (Step 2)
- CSS grid layout: time labels column + slot cells column
- Slot cells: height 40px per 30 min (same as mobile)
- Selection: click start, click end (no drag needed on web — use click range)
- Keyboard: Tab to navigate, Space to select start/end
- Booked slots: `cursor: not-allowed`, `aria-disabled="true"`

## Step 4 — Web Stripe Elements
```tsx
// Use @stripe/react-stripe-js Elements provider
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// CardElement styled to match design system:
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#111827',     // neutral-900
      '::placeholder': { color: '#9CA3AF' },  // neutral-400
    },
    invalid: { color: '#EF4444' },  // error-500
  },
};
```

## Confirmation page (Step 5)
- Server component — `generateMetadata` with booking ID
- CSS keyframe animation for checkmark (no react-native-svg)
- Print-friendly: `@media print` styles for booking receipt
- Share button: Web Share API `navigator.share({ title, text, url })`

## Route guards
- Each step page: if no draft data for previous step → redirect to step 1
- Auth guard: `getServerSession()` → if not authenticated → redirect to `/auth/login?next=/book/${pitchId}/date`

## Acceptance criteria
- [ ] All 5 step pages render without error
- [ ] Progress bar updates on each step
- [ ] Session storage persists data between steps and page refreshes
- [ ] Cleared on confirmation or cancel
- [ ] Calendar keyboard-navigable (arrow keys + Enter)
- [ ] Slot grid keyboard-navigable
- [ ] Stripe CardElement accepts test cards
- [ ] Confirmation page shows correct booking details
- [ ] Print styles produce clean receipt layout
- [ ] Redirect to login if unauthenticated; return to booking after login
- [ ] Cancel dialog shown when clicking X (not instant redirect)

## Edge cases
- User opens booking in two tabs: second tab's sessionStorage may conflict → use pitchId+timestamp key or warn on stale draft
- User refreshes on step 4 during payment: check PaymentIntent status on load, skip to step 5 if already succeeded
- sessionStorage unavailable (private mode on some browsers): fallback to in-memory state with warning

## Definition of done
- Lighthouse accessibility score ≥ 90 on booking pages
- Works on Firefox, Chrome, Safari (test Stripe Elements compatibility)
- No console errors on happy path end-to-end
BODY

create_issue "$title" "$body" '["E05 — Player: Booking Flow","type: feature","platform: web","priority: high"]' "$MILESTONE"

echo "✓ E05 — 10 issues created"
