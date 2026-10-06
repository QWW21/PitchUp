# UI/UX Specification — PitchUp

> **Version:** 1.0  
> **Last updated:** 2026-10-06  
> **Status:** Draft  
> Companion to: `PRD.md`

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Design System](#2-design-system)
3. [Mobile — Global Layout Rules](#3-mobile--global-layout-rules)
4. [Mobile — Auth Screens](#4-mobile--auth-screens)
5. [Mobile — Discover](#5-mobile--discover)
6. [Mobile — Company & Pitch Detail](#6-mobile--company--pitch-detail)
7. [Mobile — Booking Flow](#7-mobile--booking-flow)
8. [Mobile — My Bookings](#8-mobile--my-bookings)
9. [Mobile — Notifications](#9-mobile--notifications)
10. [Mobile — Profile](#10-mobile--profile)
11. [Web — Global Layout Rules](#11-web--global-layout-rules)
12. [Web — Auth](#12-web--auth)
13. [Web — Manager Dashboard](#13-web--manager-dashboard)
14. [Web — Pitch Management](#14-web--pitch-management)
15. [Web — Booking Management](#15-web--booking-management)
16. [Web — Analytics](#16-web--analytics)
17. [Web — Reviews](#17-web--reviews)
18. [Web — Settings](#18-web--settings)
19. [Accessibility](#19-accessibility)
20. [Animation & Motion](#20-animation--motion)

---

## 1. Design Philosophy

**Three words:** Clear. Energetic. Trustworthy.

- **Clear:** Players need to book in under 60 seconds. No cognitive load. One action per screen.
- **Energetic:** Sports context. Bold typography, strong green accent, purposeful motion.
- **Trustworthy:** Ratings, verified badges, transparent pricing, clear cancellation policies always visible.

**Inspiration references:**
- Discovery flow: Airbnb (cards, maps, filters)
- Booking simplicity: Uber (minimal steps, progress clarity)
- Manager dashboard: Linear (clean tables, keyboard-friendly)

**Brand tagline:** "Book your game."

---

## 2. Design System

### 2.1 Color Tokens

#### Primary palette

| Token | Hex | Usage |
|---|---|---|
| `primary-50` | `#F0FDF4` | Subtle backgrounds, hover states |
| `primary-100` | `#DCFCE7` | Selected chip background |
| `primary-200` | `#BBF7D0` | Progress bar fill light |
| `primary-500` | `#22C55E` | Icons on white, secondary actions |
| `primary-600` | `#16A34A` | **Main brand green** — buttons, links, active states |
| `primary-700` | `#15803D` | Button hover/pressed |
| `primary-900` | `#14532D` | Dark text on light green backgrounds |

#### Accent (CTA / energy)

| Token | Hex | Usage |
|---|---|---|
| `accent-400` | `#FB923C` | Highlights, sale badges, "Book Now" alternate |
| `accent-500` | `#F97316` | **Main accent orange** — primary CTA button |
| `accent-600` | `#EA580C` | CTA button pressed |

> **Button rule:** "Book Now" and primary booking CTAs use `accent-500`. All other primary actions (Save, Confirm, Submit) use `primary-600`.

#### Neutrals

| Token | Hex | Usage |
|---|---|---|
| `neutral-0` | `#FFFFFF` | Card backgrounds, modal surfaces |
| `neutral-50` | `#FAFAFA` | App/page background |
| `neutral-100` | `#F5F5F5` | Input backgrounds, skeleton loaders |
| `neutral-200` | `#E5E7EB` | Dividers, borders |
| `neutral-300` | `#D1D5DB` | Disabled borders |
| `neutral-400` | `#9CA3AF` | Placeholder text, disabled icons |
| `neutral-500` | `#6B7280` | Secondary text, captions |
| `neutral-700` | `#374151` | Body text secondary |
| `neutral-900` | `#111827` | **Primary text** — headings, labels |

#### Semantic

| Token | Hex | Usage |
|---|---|---|
| `error-50` | `#FEF2F2` | Error background |
| `error-500` | `#EF4444` | Error text, destructive actions |
| `error-600` | `#DC2626` | Error button |
| `warning-50` | `#FFFBEB` | Warning background |
| `warning-500` | `#F59E0B` | Warning text, trust score "Fair" |
| `success-50` | `#F0FDF4` | Success background |
| `success-500` | `#22C55E` | Success text (same as primary-500) |
| `info-50` | `#EFF6FF` | Info background |
| `info-500` | `#3B82F6` | Info text, booked slot colour |

#### Booking slot colours (time picker)

| State | Background | Border | Text |
|---|---|---|---|
| Available | `#FFFFFF` | `#E5E7EB` | `#111827` |
| Selected (yours) | `#DCFCE7` | `#16A34A` | `#15803D` |
| Booked by other | `#FEE2E2` | `#FECACA` | `#9CA3AF` |
| Outside hours | `#F5F5F5` | none | `#D1D5DB` |
| Current time indicator | — | `#F97316` left border | — |

---

### 2.2 Typography

#### Font families

| Context | Font | Fallback |
|---|---|---|
| Web headings | `Inter` (Variable) | `system-ui, sans-serif` |
| Web body | `Inter` (Variable) | `system-ui, sans-serif` |
| Mobile iOS | `SF Pro Display / Text` | System default |
| Mobile Android | `Roboto` | System default |
| Monospace (prices, IDs) | `JetBrains Mono` | `monospace` |

Load Inter via `next/font/google` on web. Mobile uses system font via `fontFamily: undefined`.

#### Type scale

| Name | Size | Line height | Weight | Usage |
|---|---|---|---|---|
| `display-xl` | 48px | 56px | 800 | Hero text (onboarding) |
| `display-lg` | 36px | 44px | 700 | Page titles (web) |
| `display-md` | 30px | 38px | 700 | Section headers |
| `heading-xl` | 24px | 32px | 700 | Screen titles (mobile) |
| `heading-lg` | 20px | 28px | 600 | Card titles, modal headers |
| `heading-md` | 18px | 26px | 600 | Section labels |
| `heading-sm` | 16px | 24px | 600 | Subsection labels |
| `body-lg` | 16px | 24px | 400 | Primary body text |
| `body-md` | 14px | 20px | 400 | Secondary body, descriptions |
| `body-sm` | 12px | 18px | 400 | Captions, meta info |
| `label-lg` | 14px | 20px | 500 | Button labels, form labels |
| `label-md` | 13px | 18px | 500 | Tab labels, chip text |
| `label-sm` | 11px | 16px | 500 | Badge text, status labels |
| `price` | 20px | 28px | 700 | Prices (use monospace font) |
| `price-lg` | 28px | 36px | 700 | Total price in summary |

---

### 2.3 Spacing Scale

Base unit: **4px**

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Micro gaps (icon to text) |
| `space-2` | 8px | Tight spacing (within components) |
| `space-3` | 12px | Small component padding |
| `space-4` | 16px | Standard padding, gap between elements |
| `space-5` | 20px | Section gaps (mobile) |
| `space-6` | 24px | Card padding, modal padding |
| `space-8` | 32px | Section separation |
| `space-10` | 40px | Large section gaps |
| `space-12` | 48px | Page-level padding |
| `space-16` | 64px | Hero section padding |

**Horizontal page margin:**
- Mobile: 16px (`space-4`)
- Web content max-width: 1280px, centered, 24px padding each side

---

### 2.4 Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-xs` | 4px | Small badges, tags |
| `radius-sm` | 8px | Inputs, small buttons |
| `radius-md` | 12px | Cards, chips |
| `radius-lg` | 16px | Bottom sheets (top corners), modals |
| `radius-xl` | 24px | Large cards, onboarding slides |
| `radius-full` | 9999px | Pill buttons, avatar circles, toggle |

---

### 2.5 Shadows

| Token | Value | Usage |
|---|---|---|
| `shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift (inputs on focus) |
| `shadow-sm` | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` | Cards |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)` | Elevated cards, dropdowns |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)` | Modals, bottom sheets |
| `shadow-xl` | `0 20px 25px rgba(0,0,0,0.15), 0 10px 10px rgba(0,0,0,0.04)` | Full-screen modals |

---

### 2.6 Iconography

- **Web:** [Lucide React](https://lucide.dev) — stroke icons, 20px default, 24px for navigation
- **Mobile:** [react-native-vector-icons](https://github.com/oblador/react-native-vector-icons) using `MaterialCommunityIcons` set
- Stroke width: 1.5px (thin, modern feel)
- Always pair icon with label (never icon-only without tooltip/label for key actions)

**Icon size guide:**
| Context | Size |
|---|---|
| Inline with body text | 16px |
| Button icon | 18px |
| Navigation tab icon | 24px |
| Empty state illustration | 64px |
| Feature icon (large) | 32px |

---

### 2.7 Component Library

#### Button

**Variants:**

| Variant | Background | Text | Border | Usage |
|---|---|---|---|---|
| `primary` | `primary-600` | white | none | Main actions (Save, Confirm) |
| `cta` | `accent-500` | white | none | Book Now, Pay |
| `secondary` | white | `primary-600` | `primary-600` 1.5px | Secondary actions |
| `ghost` | transparent | `neutral-700` | none | Tertiary actions |
| `destructive` | `error-500` | white | none | Delete, Cancel |
| `destructive-outline` | white | `error-500` | `error-500` 1.5px | Cancel with warning |

**Sizes:**

| Size | Height | Padding H | Font |
|---|---|---|---|
| `sm` | 32px | 12px | `label-md` |
| `md` | 40px | 16px | `label-lg` |
| `lg` | 48px | 20px | `label-lg` |
| `xl` | 56px | 24px | 16px/600 |

**States:** default → hover (darken 8%) → pressed (darken 15%) → loading (spinner replaces label, width locked) → disabled (30% opacity, no pointer).

**Border radius:** `radius-md` (12px) for lg/xl, `radius-sm` (8px) for md/sm.

**Full-width buttons** on mobile (100% width, `radius-md`).

---

#### Input / Text Field

- Height: 48px (mobile), 40px (web)
- Background: `neutral-100`
- Border: 1.5px `neutral-200`
- Border radius: `radius-sm` (8px)
- Padding: 12px horizontal
- Label: `label-md`, `neutral-700`, 6px above input
- Placeholder: `neutral-400`
- Focus border: `primary-600`, `shadow-xs`
- Error border: `error-500`
- Error message: `body-sm`, `error-500`, 4px below input
- Helper text: `body-sm`, `neutral-500`, 4px below input
- Disabled: `neutral-100` bg, `neutral-300` border, `neutral-400` text

---

#### Card

- Background: white
- Border: 1px `neutral-200` (optional, use shadow instead on mobile)
- Border radius: `radius-md` (12px)
- Shadow: `shadow-sm`
- Padding: 16px

**Company card (list item):**
- Height: auto (min 96px)
- Logo: 56×56px, `radius-sm`, left aligned
- Content: right of logo, 12px gap
- Distance/badge: top right corner

**Pitch card:**
- Thumbnail: 80×80px, `radius-sm`
- Right side: name, surface chip, price

---

#### Chip / Tag

- Height: 28px
- Padding: 6px 10px
- Border radius: `radius-full`
- Font: `label-md`
- Variants:
  - Default: `neutral-100` bg, `neutral-700` text
  - Selected: `primary-100` bg, `primary-700` text, `primary-600` border 1px
  - Surface type: custom colour per type (see below)
  - Status badges: semantic colours

**Surface type chips:**
| Surface | Background | Text |
|---|---|---|
| Natural grass | `#F0FDF4` | `#15803D` |
| Artificial | `#EFF6FF` | `#1D4ED8` |
| Futsal | `#FEF3C7` | `#92400E` |

---

#### Avatar

- Shape: circle (`radius-full`)
- Sizes: 24px, 32px, 40px, 56px, 80px
- Fallback: initials on `primary-100` background, `primary-700` text
- Border: 2px white (when on coloured background)

---

#### Rating Stars

- Filled star: `#FBBF24` (amber-400)
- Empty star: `neutral-200`
- Half star: gradient split
- Size: 14px inline, 20px in review form
- Always show numeric value beside stars: "4.3" in `body-sm` `neutral-700`

---

#### Bottom Sheet (mobile)

- Slides up from bottom
- Handle bar: 32×4px, `neutral-300`, `radius-full`, centered, 8px from top
- Top corners: `radius-lg` (16px)
- Background: white
- Shadow: `shadow-xl`
- Backdrop: `rgba(0,0,0,0.4)` — tap to dismiss
- Drag to dismiss: enabled (velocity threshold: 500px/s or 40% screen height dragged)

---

#### Toast / Snackbar (mobile)

- Position: 16px from bottom of screen, 16px horizontal margin
- Min height: 48px
- Border radius: `radius-md`
- Padding: 12px 16px
- Duration: 3s auto-dismiss (error: 5s)
- Variants: success (green left border), error (red), info (blue), warning (yellow)
- Max 1 toast visible at a time (queue)

---

#### Empty State

- Centered vertically + horizontally in container
- Illustration: 120×120px SVG (custom per context)
- Title: `heading-md`, `neutral-900`, 16px below illustration
- Description: `body-md`, `neutral-500`, 8px below title, max 240px wide, centered
- CTA button (if applicable): 20px below description

---

#### Skeleton Loader

- Same shape as the content it replaces
- Background: `neutral-100`
- Shimmer animation: left-to-right gradient sweep, 1.5s loop
- Show after 200ms delay (avoid flash for fast loads)

---

### 2.8 Trust Score Visual

| Tier | Colour | Label |
|---|---|---|
| Excellent (90–100) | `primary-600` green | "Excellent" |
| Good (70–89) | `#22C55E` light green | "Good" |
| Fair (50–69) | `warning-500` amber | "Fair" |
| Poor (30–49) | `accent-500` orange | "Poor" |
| Suspended (<30) | `error-500` red | "Suspended" |

Displayed as: circular progress ring (100 = full circle) + numeric score inside + tier label below.

---

## 3. Mobile — Global Layout Rules

### 3.1 Safe Areas

- Use `SafeAreaView` for all screens
- Bottom tab bar sits above home indicator (iOS) / navigation bar (Android)
- Content never overlaps with status bar

### 3.2 Tab Bar

- Height: 56px + safe area bottom
- Background: white
- Top border: 1px `neutral-200`
- 4 tabs: Discover, My Bookings, Notifications, Profile
- Active icon + label: `primary-600`
- Inactive icon + label: `neutral-400`
- Label font: `label-sm` (11px/500)
- Icon size: 24px
- Notification badge: 18px circle, `error-500` bg, white text `label-sm`, positioned top-right of icon

**Tabs:**
| # | Label | Icon (`MaterialCommunityIcons`) |
|---|---|---|
| 1 | Discover | `magnify` / `magnify` (active: filled) |
| 2 | Bookings | `calendar-check-outline` / `calendar-check` |
| 3 | Notifications | `bell-outline` / `bell` |
| 4 | Profile | `account-circle-outline` / `account-circle` |

### 3.3 Navigation Header

- Height: 56px
- Background: white
- Bottom border: 1px `neutral-200` (only on scroll — hidden when at top)
- Title: `heading-sm` (16px/600), `neutral-900`, centered
- Back button: `chevron-left` 24px icon, `neutral-900`, left, 16px from edge, 44×44px tap target
- Right action: text button or icon, `primary-600`, right, 16px from edge

### 3.4 Scroll Behaviour

- Default: `ScrollView` with `bounces` on iOS
- List screens: `FlatList` with `keyboardShouldPersistTaps="handled"`
- Pull to refresh: enabled on all list screens, spinner in `primary-600`

### 3.5 Keyboard

- `KeyboardAvoidingView` wraps all forms
- `behavior="padding"` on iOS, `behavior="height"` on Android

---

## 4. Mobile — Auth Screens

### 4.1 Splash Screen

- Background: `primary-600` (solid green)
- Center: PitchUp logo (white) — 120×120px
- Below logo: wordmark "PitchUp" in `display-md`, white, 12px gap
- Tagline: "Book your game." in `body-md`, `primary-200`, 8px below wordmark
- No status bar visible (fullscreen)
- Duration: 1.5s → animate out (fade + slight scale up) → Onboarding or Login

---

### 4.2 Onboarding (3 slides)

**Container:**
- Full screen
- Background: white
- Bottom: page dots + "Next" / "Get Started" button + "Skip" text link

**Skip button:**
- Top right, 16px margin
- `body-md`, `neutral-500`
- 44×44px tap target

**Page dots:**
- 3 dots, 8px each, 6px gap
- Active: `primary-600` (20px wide pill)
- Inactive: `neutral-300`

**Navigation buttons:**
- "Next": `primary` button, `lg` size, full width, 24px horizontal margin
- "Get Started" (slide 3): `cta` button, `lg` size, full width
- 16px gap between dots and button
- 32px bottom margin (+ safe area)

**Slide 1 — Discover pitches near you**
- Illustration: top-down football pitch aerial view, players as coloured dots — 280×200px, top 40% of screen
- Background accent: `primary-50` blob shape behind illustration
- Title: `heading-xl` (24px/700), `neutral-900`, centered, 32px below illustration
- Description: `body-md`, `neutral-500`, centered, 12px below title, 32px horizontal padding

**Slide 2 — Book in 60 seconds**
- Illustration: phone with booking confirmation checkmark — 200×280px
- Same layout as slide 1

**Slide 3 — Play without worry**
- Illustration: shield icon with football — 200×200px
- Subtitle mentions trust score + no-show protection

---

### 4.3 Login Screen

**Header:**
- "Welcome back" — `heading-xl`, `neutral-900`
- "Sign in to continue" — `body-md`, `neutral-500`, 4px below
- 40px from top (+ safe area)
- Left aligned with 16px margin

**Form:**
- 32px below header
- Email input (label: "Email address")
- 16px gap
- Password input (label: "Password", with show/hide toggle — eye icon `neutral-400`)
- 8px gap
- "Forgot password?" — right aligned, `label-md`, `primary-600`

**Actions:**
- 24px below form
- "Sign in" — `primary` button, `xl` size, full width
- 20px gap
- Divider: "— or —" with `neutral-300` lines, `body-sm` `neutral-400` text
- 16px gap
- "Continue with Google" — `secondary` button, Google logo 20px left of text, full width
- 12px gap
- "Continue with Apple" — same style, Apple logo

**Footer:**
- "Don't have an account? **Sign up**"
- `body-md`, `neutral-500`, "Sign up" in `primary-600`
- Centered, 32px from bottom

---

### 4.4 Register Screen

**Header:** "Create account" / "Join PitchUp today"

**Progress indicator:**
- Linear bar at top: thin 4px height, `neutral-200` track, `primary-600` fill
- Step label: "Step 1 of 2" — `label-sm`, `neutral-500`, right aligned, 8px below bar

**Step 1 — Personal info:**
- Full name input
- Email input
- Phone number input (with country code selector prefix — flag + +40 etc.)
- Date of birth input (date picker — tapping opens wheel/calendar picker)
- 16px gap between each input
- "Continue" → `primary` button, full width

**Step 2 — Account security:**
- City selector (tapping opens searchable city list modal)
- Password input (with strength indicator bar below — 4 segments: Weak/Fair/Good/Strong)
- Confirm password input
- Checkbox: "I agree to the Terms of Service and Privacy Policy" (links open webview)
- "Create account" → `primary` button, full width

**Password strength bar:**
- Height: 4px, `radius-full`
- 4 segments with 4px gaps
- Weak: 1 segment `error-500`
- Fair: 2 segments `warning-500`
- Good: 3 segments `accent-500`
- Strong: 4 segments `primary-600`

---

### 4.5 OTP Verification

**Context:** After register, verify phone number.

**Header:**
- "Verify your number"
- "We sent a 6-digit code to **+40 7XX XXX XXX**"
- `body-md`, `neutral-500`, phone number bold

**OTP Input:**
- 6 individual boxes (each 48×56px)
- 8px gaps between boxes
- Border: 1.5px `neutral-200`, `radius-sm`
- Active box: `primary-600` border, `shadow-xs`
- Filled box: `neutral-900` text, `heading-md` font
- Auto-advance on each digit typed
- Auto-paste support (SMS OTP autofill on both platforms)

**Actions:**
- "Verify" → `primary` button, full width — enabled only when all 6 filled
- 24px gap
- "Resend code" text button — disabled with countdown: "Resend in 0:45"
  - Countdown: `label-md`, `neutral-400`
  - When enabled: `label-md`, `primary-600`

**Error state:**
- All boxes get `error-500` border
- Error message below: "Incorrect code. X attempts remaining."

---

### 4.6 Forgot Password

- Single email input
- "Send reset link" → `primary` button
- After submit: success state replaces form — envelope illustration + "Check your email" message

---

## 5. Mobile — Discover

### 5.1 Discover Screen (List View)

**Header bar (fixed, not inside tab bar):**
- Height: 56px + status bar
- Background: white
- Left: "PitchUp" wordmark or logo — `heading-md`, `primary-600`
- Right: Filter icon button (`tune` icon, 24px, `neutral-900`) with badge if filters active (small `primary-600` dot)

**Location banner:**
- Below header, `neutral-50` background, 12px vertical padding, 16px horizontal
- Left: `map-marker` icon 18px `primary-600`
- Text: "Pitches in **Cluj-Napoca**" — `body-md`, `neutral-700`, city name bold
- Right: "Change" — `label-md`, `primary-600`
- Tap whole banner → city selector modal

**Search bar:**
- Below location banner
- Height: 44px
- Background: `neutral-100`
- Border radius: `radius-full`
- 16px horizontal padding
- Left: `magnify` icon 18px `neutral-400`
- Placeholder: "Search companies..."
- 8px top/bottom margin, 16px horizontal margin

**Sort bar:**
- Horizontal scroll row, no scroll indicator
- 16px left padding, 8px gap between chips
- Chips: "Nearest", "Top rated", "Lowest price", "Newest"
- Default "Nearest" selected (if location granted)
- Selected chip: `primary-100` bg, `primary-700` text, `primary-600` border 1px

**Map/List toggle:**
- Top right corner, 40×40px, `radius-md`, white, `shadow-sm`
- Icon: `map-outline` for list view, `format-list-bulleted` for map view
- Position: absolute, 16px from right, vertically centred with sort bar

**Company list:**
- `FlatList`, 16px horizontal padding, 12px gap between cards
- 8px top padding after sort bar

**Company card:**
- White background, `shadow-sm`, `radius-md` (12px), 16px padding
- **Row layout:**
  - Logo: 56×56px, `radius-sm`, `neutral-100` bg (loading skeleton)
  - Right side: flex-1, 12px left gap
    - Row 1: Company name (`heading-sm`, `neutral-900`) + "Open now" badge (right)
    - Row 2: `map-marker` icon 14px + address text (`body-sm`, `neutral-500`)
    - Row 3: ⭐ rating (`body-sm`, `neutral-700`, bold) + review count (`body-sm`, `neutral-400`) + "·" separator + distance (`body-sm`, `neutral-500`)
    - Row 4: "X pitches" chip + "from XX RON/h" (`body-sm`, `primary-700`, right aligned)

**"Open now" badge:**
- `radius-xs` (4px), `success-50` bg, `success-500` text, `label-sm`
- "OPEN" label

**Loading state:**
- 4 skeleton cards (same height as real cards), shimmer animation

**Empty state (no results):**
- 64px illustration (magnifying glass / sad ball)
- "No pitches found in {City}"
- "Try changing your filters or selecting a different city"
- "Clear filters" `secondary` button

**Error state:**
- Generic error illustration
- "Couldn't load pitches"
- "Check your connection and try again"
- "Retry" `primary` button

---

### 5.2 Discover Screen (Map View)

**Full screen map:**
- `react-native-maps`, `MapView` fills screen
- `MapType.STANDARD`
- Initial region: user location or city centre
- Map controls (zoom, compass): default native

**Company pin markers:**
- Custom callout: white pill, `shadow-md`, `radius-full`
- Shows: "from XX RON" in `label-md`, `neutral-900`
- Active/selected pin: `primary-600` background, white text, slightly larger (1.1x scale)
- Cluster: grey circle with count when zoomed out

**Bottom sheet (company preview):**
- Slides up 200px from bottom when pin tapped
- Drag handle at top
- Single company card (same as list card but without shadow, no border)
- "View company" → `primary` button, full width, inside sheet
- Dismiss: tap map or drag down

**My location button:**
- Bottom right, 56px above sheet, 16px from right
- 40×40px, white, `radius-full`, `shadow-md`
- `crosshairs-gps` icon, `primary-600`

---

### 5.3 City Selector Modal

**Presentation:** Full screen modal (slides up)

**Header:**
- "Select city" — `heading-lg`
- Close (X) button top right

**Search input:**
- At top of list, always visible
- Placeholder: "Search cities..."

**City list:**
- `FlatList` with section headers by country (initially only Romania)
- Each row: city name (`body-lg`, `neutral-900`) + region/county (`body-sm`, `neutral-500`)
- Selected city: right `check` icon `primary-600`
- Tap → close modal, update location banner

**"Use my location" row (first item):**
- `crosshairs-gps` icon `primary-600` + "Detect my location" text
- Requests location permission → geocodes → selects nearest city

---

### 5.4 Filters Bottom Sheet

**Trigger:** Filter icon in header

**Presentation:** Bottom sheet, ~80% screen height, draggable

**Header:**
- "Filters" — `heading-md`, left
- "Reset all" — `label-md`, `primary-600`, right

**Content (scrollable):**

Section: "Surface type"
- 3 chips in a row: Natural grass | Artificial | Futsal
- Multi-select

Section: "Pitch size"
- 3 chips: 5v5 | 7v7 | 11v11
- Multi-select

Section: "Amenities"
- Grid (2 columns) of amenity chips with icons
- Multi-select

Section: "Price per hour"
- Range slider: min/max handles, `primary-600` track fill
- Min/max labels below: "XX RON" — `label-md`, `neutral-700`

Section: "Availability"
- Toggle row: "Available now" — `Switch`, `primary-600`
- Toggle row: "Open now" — `Switch`, `primary-600`

**Footer (fixed at bottom of sheet):**
- "Show X results" — `primary` button, full width (count updates live as filters change)

---

## 6. Mobile — Company & Pitch Detail

### 6.1 Company Detail Screen

**Header:**
- Transparent over hero image, becomes white on scroll (with shadow)
- Back button: white circle bg (`rgba(255,255,255,0.9)`) when over image
- Share icon: right side, same treatment
- Title in header: appears on scroll past hero

**Hero section:**
- Company logo: 80×80px, `radius-md`, white bg, `shadow-sm` — centered horizontally, 16px overlap below top section / or left aligned
- Company name: `heading-xl`, `neutral-900`
- Address: `map-marker` icon + text, `body-md`, `neutral-500`, tappable (opens maps)
- Phone: `phone` icon + number, `body-md`, `primary-600`, tappable
- Rating row: stars + "4.3 (127 reviews)" + verified badge (if applicable)
- Working hours today: `clock` icon + "Open · Closes at 23:00" in `body-md`
  - Tappable → expands accordion showing all 7 days' hours

**Tabs (sticky below hero):**
- "Pitches" | "Reviews"
- Active tab: `primary-600` bottom border 2px, `neutral-900` text
- Inactive: `neutral-400` text

**Pitches tab content:**

Pitch card (list):
- Thumbnail: 80×80px left, `radius-sm`
- Name: `heading-sm`, `neutral-900`
- Surface chip + size label
- Price: "from **XX RON**/h" — `body-sm`, price part `primary-700` bold
- Star rating + review count
- Arrow right `chevron-right` icon

**Reviews tab content:**

Rating breakdown header:
- Large rating number: "4.3" in `display-md`, `neutral-900`
- "out of 5" in `body-md`, `neutral-500`
- Stars row (large, 24px)
- "127 reviews" in `body-sm`, `neutral-500`
- Bar chart: 5 rows (5★ to 1★), each row: star label + bar (`radius-full`, `primary-600` fill) + count label

Review cards:
- Avatar (32px) + name (`label-md`, `neutral-900`) + date (`body-sm`, `neutral-400`) — top row
- Stars (14px) — below avatar row
- Review text: `body-md`, `neutral-700`
- Photos (if any): horizontal scroll, 80×80px `radius-sm`
- Manager reply (if any): indented left 12px, `neutral-50` bg, `radius-sm`, 8px padding
  - "Response from manager" label: `label-sm`, `neutral-500`
  - Reply text: `body-md`, `neutral-700`

---

### 6.2 Pitch Detail Screen

**Photo gallery (full width, 240px height):**
- Horizontal `FlatList` / `ScrollView` (paging)
- Each photo fills container (cover fit)
- Photo counter: "3 / 8" — white text, `body-sm`, `rgba(0,0,0,0.6)` pill background, bottom right
- Tap → fullscreen lightbox

**Fullscreen lightbox:**
- Black background
- Pinch to zoom
- Swipe left/right
- Close button: X top right, white
- Counter: "3 / 8" top centre, white

**Pitch header (below gallery):**
- Pitch name: `heading-xl`, `neutral-900`, 16px top
- Surface chip + size label: row, 8px gap
- Rating + review count
- Company name: `body-md`, `neutral-500`, with `chevron-right` → tappable → back to company

**Description section:**
- Section label: "About this pitch" — `heading-sm`
- Text: `body-md`, `neutral-700`
- If > 4 lines: truncated with "Show more" — `label-md`, `primary-600`

**Amenities section:**
- "Amenities" — `heading-sm`
- 2-column grid of amenity rows
- Each row: icon (20px, `primary-600` if available, `neutral-300` if not) + label (`body-md`)
- Unavailable: label `neutral-400`, strikethrough

**Pricing section:**
- "Pricing" — `heading-sm`
- Card with `neutral-50` bg, `radius-md`, 12px padding
- Two rows: Off-peak | Peak
- Each row: Time range (`body-sm`, `neutral-500`) + price (`price`, `neutral-900`, right aligned)
- Divider between rows
- Footer note: "Min. 1h · Billed per 30 min" — `body-sm`, `neutral-400`
- Shirt rental row (if available): `tshirt-crew` icon + "Shirt rental: XX RON/shirt"

**Availability preview section:**
- "Availability" — `heading-sm`
- 7-column grid (today + 6 days)
- Each column:
  - Day label: "Mon" `label-sm` `neutral-500`, "Today" `label-sm` `primary-600`
  - Date: `body-sm` `neutral-700`
  - Dot indicator: `primary-600` (available), `error-500` (full), `neutral-300` (closed)
- Tap any day → jumps into booking flow step 1 with that date pre-selected

**Reviews preview:**
- "Reviews" — `heading-sm`
- Rating summary (stars + number)
- 2 most recent review cards (compact version)
- "See all X reviews" → navigates to company detail, Reviews tab

**Book Now sticky footer:**
- Fixed at bottom, above tab bar
- Background: white, top border 1px `neutral-200`
- Padding: 12px 16px + safe area bottom
- Left: price "from **XX RON**/h" — `price`, `neutral-900`
- Right: "Book Now" — `cta` button (`accent-500`), `lg` size, width: 140px
- If pitch inactive/unavailable: button disabled, greyed, "Not available" label

---

## 7. Mobile — Booking Flow

Full-screen modal stack (push navigation, not tab). Progress bar at top.

**Progress bar:**
- 4px height, full width
- Track: `neutral-200`
- Fill: `primary-600`
- Step 1 = 20%, Step 2 = 40%, Step 3 = 60%, Step 4 = 80%, Step 5 = 100%
- Animated (smooth fill transition, 300ms ease)

**Each step header:**
- Back button (`chevron-left`) top left — goes to previous step or dismisses modal on step 1
- Step label: "Step X of 4" — `label-sm`, `neutral-500`, centered
- Cancel (X) button top right — confirms discard if > step 1

**Discard confirmation bottom sheet:**
- "Are you sure?" title
- "Your booking details will be lost"
- "Keep editing" — `secondary` button
- "Discard" — `destructive-outline` button

---

### 7.1 Step 1 — Select Date

**Content:**
- Header: "Pick a date" — `heading-xl`
- Subtext: "{Pitch name} · {Company name}" — `body-md`, `neutral-500`

**Calendar:**
- Month header: "October 2026" — `heading-md`, `neutral-900`, centred
- Prev/next month arrows: `chevron-left` / `chevron-right`, `neutral-700`, 44×44px tap target
- Day labels row: "MON TUE WED THU FRI SAT SUN" — `label-sm`, `neutral-400`
- Day cells: 44×44px, centred text `body-md`
  - Today: `primary-600` dot below number
  - Available: `neutral-900` text
  - Selected: `primary-600` circle bg, white text
  - Fully booked: `neutral-300` text (still tappable but shows snackbar "fully booked")
  - Closed/past: `neutral-300` text, not tappable
- Swipe left/right to navigate months

**Footer:**
- "Next" — `primary` button, full width, disabled until date selected

---

### 7.2 Step 2 — Select Time Interval

**Header:**
- "Select time" — `heading-xl`
- Selected date displayed: "Tuesday, 14 October" — `body-lg`, `primary-600`

**Duration indicator:**
- Pill at top: "Select a start and end time" → updates to "2h 00min" once selected
- `neutral-100` bg, `radius-full`, `label-md`, `neutral-700`

**Slot grid:**
- Vertical scroll
- Time labels column (left, 48px wide): every 30 min from open to close time
  - Font: `label-sm`, `neutral-500`
  - Current time: `accent-500` text
- Slot cells (right, flex-1):
  - Height: 40px per 30-min block
  - Divider line between cells: 1px `neutral-100`
  - States: see color table in §2.1

**Interaction:**
1. Tap first available cell → marks as start (top of selection)
2. Tap another cell below → marks as end → full range highlights
3. Cannot select: booked cells block selection (snaps to available contiguous range)
4. Tap same cell twice → deselects

**Selected range visual:**
- `primary-100` background for all cells in range
- Start cell: `primary-600` top-left + top-right radius
- End cell: `primary-600` bottom-left + bottom-right radius
- Middle cells: no radius, `primary-100` bg
- Left border: 3px `primary-600` continuous line from start to end

**Current time line:**
- 1px `accent-500` dashed horizontal line with dot on left
- Shows current time position

**Price preview strip (sticky at bottom, above Next):**
- White bg, 12px padding
- "2h × 80 RON/h = **160 RON**"
- `body-md`, `neutral-700`, bold part `neutral-900`

**Footer:**
- "Next" — `primary` button, disabled until valid interval selected

---

### 7.3 Step 3 — Teams & Shirts

**Header:** "Teams & equipment"

**Teams section:**
- Label: "Number of teams" — `heading-sm`
- Segmented control: "2 Teams" | "3 Teams"
  - Width: full, equal segments
  - Selected: white bg, `shadow-xs`, `neutral-900` text
  - Unselected: transparent, `neutral-500` text
  - Container: `neutral-100` bg, `radius-sm`, 3px padding

**Players per team (optional):**
- Label: "Players per team (optional)" — `heading-sm`
- Subtext: "Helps check pitch capacity" — `body-sm`, `neutral-500`
- Per team row (repeats for each team):
  - Team label: "Team A", "Team B", "Team C"
  - Stepper: `−` (44×44px) + count (40px wide, centred `body-lg`) + `+` (44×44px)
  - Min: 1, Max: 15
  - Disabled state: `neutral-300` icon

**Shirts section:**
- Label: "Coloured shirts" — `heading-sm`
- Toggle row: "I need shirts" — `Switch` right aligned
  - `primary-600` when on, `neutral-300` when off

**When toggle ON (animated expand):**
- For each team row:
  - Team label: "Team A shirts" — `label-md`, `neutral-700`
  - Colour swatches row (horizontal scroll if needed):
    - Each swatch: 36×36px circle
    - Active: 3px `neutral-900` ring around swatch
    - Colours: RED `#EF4444`, BLUE `#3B82F6`, GREEN `#22C55E`, YELLOW `#FBBF24`, ORANGE `#F97316`, WHITE `#F9FAFB` (with border), BLACK `#111827`, PURPLE `#A855F7`
  - Quantity stepper (same as players stepper)
  - Availability note (if insufficient): "Only X available in this colour" — `body-sm`, `warning-500`

**Shirt cost preview:**
- Inline: "X shirts × XX RON = **XX RON**" — `body-sm`, `neutral-500`

**Note to manager (optional):**
- "Note to manager (optional)" — `label-md`, `neutral-700`
- `TextInput`, multiline, height: auto (min 80px), max 200 chars
- Character counter: "XX / 200" — `label-sm`, `neutral-400`, bottom right of input

**Price summary (live update):**
- Row: "Pitch rental" + "XX RON"
- Row (if shirts): "Shirt rental" + "XX RON"
- Divider
- Row: "Total" (bold) + "**XX RON**" (bold, `neutral-900`)

**Footer:** "Next" — `primary` button

---

### 7.4 Step 4 — Summary & Payment

**Header:** "Review & pay"

**Booking summary card:**
- `neutral-50` bg, `radius-md`, 16px padding
- Rows (icon + label + value):
  - `calendar` — date
  - `clock-outline` — time interval + duration
  - `map-marker` — pitch name + company
  - `account-group` — "2 teams · X players total"
  - `tshirt-crew` — "Team A: X red shirts, Team B: X blue shirts" (if ordered)
  - `note-text` — note (if entered, truncated at 1 line)

**Price breakdown card:**
- White bg, `shadow-sm`, `radius-md`, 16px padding
- "Price breakdown" — `heading-sm`
- Row: "Pitch rental (Xh × XX RON/h)" + "XX RON" — `body-md`
- Row: "Shirt rental (X shirts)" + "XX RON" — `body-md` (if applicable)
- Row: "Platform fee" + "XX RON" — `body-md`, info icon with tooltip
- Divider (1px `neutral-200`)
- Row: "**Total**" + "**XX RON**" — `heading-sm`, `price` font for value

**Cancellation policy:**
- `info-50` bg, `info-500` left border 3px, `radius-sm` (right corners), 12px padding
- `info-circle` icon + "Free cancellation until {datetime}" — `body-sm`, `neutral-700`
- Second line: policy summary

**Payment method:**
- "Payment method" — `heading-sm`
- Saved card row (if exists):
  - Card brand logo (Visa/Mastercard) + "···· 4242" + expiry — `body-md`
  - Right: `check-circle` `primary-600` if selected
  - 44×44px tap target
- "+ Add new card" row:
  - `plus` icon `primary-600` + "Add new card" `label-md` `primary-600`
  - Tapping opens Stripe card sheet modal

**Stripe card input sheet:**
- Standard Stripe Elements CardField
- Card number, expiry, CVC fields
- "Save this card" toggle
- "Add card" → `primary` button

**Footer:**
- "Confirm & Pay XX RON" — `cta` (`accent-500`) button, full width, `xl` size
- Loading state: spinner in button, text: "Processing..."
- On error: shake animation on button, toast with error message

---

### 7.5 Step 5 — Confirmation

**Full screen success state:**
- Background: white
- Top 40%: large animated checkmark
  - Circle: `primary-600`
  - Checkmark: white stroke, draw animation (600ms)
  - After draw: subtle pulse animation (scale 1.0→1.05→1.0, 800ms)
- "Booking confirmed!" — `heading-xl`, `neutral-900`, centred, 24px below checkmark
- "Get ready to play!" — `body-md`, `neutral-500`, 8px below

**Summary card (below):**
- `neutral-50` bg, `radius-md`, 16px margin horizontal
- Booking ID: "Booking #AB12CD" — `label-sm`, `neutral-400`, monospace, centred
- Pitch + company name
- Date + time
- Total paid

**Actions:**
- "View my booking" — `primary` button, full width
- "Back to Discover" — `ghost` button, full width, 8px below

---

## 8. Mobile — My Bookings

### 8.1 Bookings List Screen

**Header:** "My Bookings" — `heading-xl`, left aligned, 16px margin

**Tabs (segmented, full width):**
- "Upcoming" | "Past" | "Cancelled"
- Active: `primary-600` bottom underline 2px
- Same style as company detail tabs

**Upcoming tab:**

Empty state: "No upcoming bookings" + calendar illustration + "Find a pitch" → CTA → Discover

Booking card:
- White bg, `shadow-sm`, `radius-md`, 16px padding
- Status badge top right: "Confirmed" (green), "Pending" (amber — if manual confirm)
- Company logo 40×40px + company name `label-md` `neutral-700` + pitch name `heading-sm` `neutral-900`
- `calendar` icon + date — `body-md`, `neutral-700`
- `clock-outline` icon + time interval — `body-md`, `neutral-700`
- Countdown chip (if < 24h): "`clock-fast` Starts in 3h 20min" — `warning-500` text, `warning-50` bg
- "Cancel" ghost button (if eligible) — right aligned, `error-500` text

**Past tab:**
Similar cards, with:
- Status: "Completed" (green) or "No-show" (red)
- "Leave a review" button (if not reviewed) — `secondary`, small
- "Re-book" button — `ghost`, small

**Cancelled tab:**
Similar cards, with:
- "Cancelled by you" or "Cancelled by manager"
- Refund amount: "Refund: XX RON" — `body-sm`, `primary-600`

---

### 8.2 Booking Detail Screen

**Header:** "Booking Details" + booking ID (`label-sm`, `neutral-400`, monospace, below title)

**Status banner (full width, top):**
- Confirmed: `success-50` bg, `success-500` text + `check-circle` icon
- No-show: `error-50` bg, `error-500` text + `alert-circle` icon
- Cancelled: `neutral-100` bg, `neutral-500` text
- Height: 48px, centred content

**Company section:**
- Logo 56px + name `heading-md` + address + phone (tappable)

**Booking details card:**
- `neutral-50` bg, `radius-md`
- Rows: date, time, duration, pitch name, pitch surface + size
- Divider
- Teams: "2 teams"
- Per team: colour swatch + "X players · X shirts"
- Note to manager (if any)

**Payment card:**
- Price breakdown (same as summary step)
- Payment method: card last 4 + charge date

**Status history:**
- Vertical timeline:
  - Dot + label + timestamp
  - E.g. "Booked" → "Confirmed" → "Completed"
- Dot: 10px circle, `primary-600` for completed steps, `neutral-300` for future
- Line: 1px `neutral-200` connecting dots

**Action buttons (context-dependent):**
- Upcoming + eligible: "Cancel Booking" — `destructive-outline`, full width
- Past + no review: "Rate this pitch" — `primary`, full width
- No-show: "Dispute no-show" — `secondary`, full width

---

### 8.3 Cancel Booking Bottom Sheet

**Title:** "Cancel this booking?"

**Content:**
- Pitch name + date + time — compact summary
- Cancellation policy in `warning-50` box:
  - Refund amount: "You'll receive **XX RON** back"
  - Timeline: "Refund processed in 5–10 business days"
- If 0% refund: `error-50` box, "No refund — cancellation window has passed"

**Actions:**
- "Keep my booking" — `primary`, full width
- "Cancel — get XX RON refund" — `destructive-outline`, full width, 8px below

---

### 8.4 Review Screen

**Header:** "Rate your experience"

**Pitch info (compact):**
- Pitch name + company name + date played

**Star picker:**
- 5 large stars (40px each, 12px gap)
- Tap to select (all stars up to tapped fill)
- Shake animation if submitted with 0 stars

**Rating labels (below stars, contextual):**
| Stars | Label |
|---|---|
| 1 | "Very poor" |
| 2 | "Poor" |
| 3 | "Average" |
| 4 | "Good" |
| 5 | "Excellent!" |

**Review text input:**
- Placeholder: "Share your experience (optional)..."
- Multiline, min 80px, max 500 chars
- Character counter

**Photo upload:**
- "Add photos (optional)" — `label-md`, `neutral-700`
- Row of 3 photo slots (80×80px each, `radius-sm`, dashed `neutral-300` border)
- Filled slot: thumbnail + remove X button
- Empty slot: `plus` icon `neutral-400`

**Anonymous toggle:**
- Row: "Post anonymously" + `Switch`
- Subtext: "Your name won't be shown" — `body-sm`, `neutral-500`

**Submit button:** "Submit review" — `primary`, full width

---

## 9. Mobile — Notifications

### 9.1 Notification List

**Header:** "Notifications" + "Mark all read" right (`label-md`, `primary-600`)

**Grouped by date:**
- Section headers: "Today", "Yesterday", "Earlier this week", "Older" — `label-sm`, `neutral-400`, uppercase

**Notification row:**
- Height: auto (min 64px)
- Left: icon in 40×40px circle
  - Booking confirmed: `check-circle`, `success-50` bg, `success-500` icon
  - No-show: `alert-circle`, `error-50` bg, `error-500` icon
  - Reminder: `clock-outline`, `info-50` bg, `info-500` icon
  - Penalty: `currency-usd`, `error-50` bg, `error-500` icon
  - Review: `star`, `warning-50` bg, `warning-500` icon
- Right of icon (12px gap):
  - Title: `label-md`, `neutral-900` (bold if unread)
  - Body: `body-sm`, `neutral-500`, max 2 lines
  - Time: `body-sm`, `neutral-400`, right aligned or below body
- Unread indicator: 8px `primary-600` dot, left of row (outside padding)
- Unread row background: `primary-50`
- Tap: marks as read + navigates to related screen (booking, review, etc.)
- Swipe left: "Delete" action (red)

**Empty state:** Bell illustration + "All caught up!" + "No notifications yet"

---

## 10. Mobile — Profile

### 10.1 Profile Screen

**Header:** "Profile" — `heading-xl`, left

**User card (top):**
- Avatar 80px (`radius-full`)
- Name: `heading-lg`, `neutral-900`
- Email: `body-md`, `neutral-500`
- Phone: `body-md`, `neutral-500`
- "Edit profile" — `secondary` button, small, 8px below name
- City chip: `map-marker` icon + city name, `neutral-100` bg, `radius-full`

**Trust score card:**
- White bg, `shadow-sm`, `radius-md`, 16px padding
- Left: circular progress ring (60px diameter) + score inside (`heading-lg`) + tier label below
- Right side:
  - "Your Trust Score" — `heading-sm`
  - Tier description: "You can book freely." — `body-sm`, `neutral-700`
  - "View history" — `label-md`, `primary-600`

**Menu sections (list with dividers):**

"Account"
- Edit profile → chevron
- Change password → chevron
- Payment methods → chevron
- My reviews → chevron

"Legal"
- Terms of Service → chevron (opens webview)
- Privacy Policy → chevron (opens webview)

"Support"
- Help & FAQ → chevron
- Contact support → chevron

"Danger zone"
- Log out — `error-500` text, no chevron
- Delete account — `error-500` text, no chevron

---

### 10.2 Trust Score Detail

**Header:** "Trust Score"

**Score ring (large):**
- 120px diameter
- Ring fill: colour per tier
- Score number: `display-md`, inside ring
- Tier label: `heading-sm`, tier colour, below ring

**History timeline:**
- Each event row: delta (`+2` green / `-20` red) + reason label + date
- Ordered most recent first

**Tier table:**
- 4 rows showing all tiers, current one highlighted

**Tips card:**
- "How to improve your score" — `heading-sm`
- Bullet list: show up to bookings, cancel early, leave reviews

---

### 10.3 Payment Methods

**List of saved cards:**
- Card row: brand logo + "···· 4242" + expiry + default badge
- Swipe left → "Remove"
- Tap → set as default

**Add card:**
- "Add new card" row at bottom with `plus` icon

---

## 11. Web — Global Layout Rules

### 11.1 Sidebar Navigation (Manager)

**Width:** 240px (collapsed: 64px, icon only)
**Background:** `neutral-900` (dark sidebar, lighter main content)
**Logo:** top, 24px padding, "PitchUp" white wordmark
**Collapse toggle:** bottom of sidebar, `chevron-left` / `chevron-right`

**Nav items:**
- Height: 40px
- Padding: 8px 12px
- Border radius: `radius-sm`
- Icon: 20px, `neutral-400`
- Label: `label-lg`, `neutral-400`
- Hover: `neutral-800` bg
- Active: `primary-600` bg, white icon + text
- 4px gap between items

**Nav sections:**
```
Overview        (home icon)
Calendar        (calendar icon)
Bookings        (list icon)
─── Manage ───
Pitches         (football icon)
Reviews         (star icon)
─── Business ───
Analytics       (chart-bar icon)
─── Account ───
Settings        (settings icon)
```

**Bottom of sidebar:**
- Avatar + name + "Manager" badge
- Logout button

### 11.2 Top Bar

**Height:** 64px
**Background:** white
**Bottom border:** 1px `neutral-200`
**Left:** Page title — `heading-md`, `neutral-900`
**Right:** Notification bell (with badge) + avatar dropdown

### 11.3 Main Content Area

- Background: `neutral-50`
- Padding: 32px
- Max content width: 1024px (centered within available area)

### 11.4 Responsive breakpoints

| Name | Width | Behaviour |
|---|---|---|
| `mobile` | < 768px | Single column, no sidebar |
| `tablet` | 768–1024px | Sidebar collapsed (icon only) |
| `desktop` | > 1024px | Full sidebar |

---

## 12. Web — Auth

### 12.1 Manager Login Page

**Split layout:**
- Left 50%: form panel (white bg)
- Right 50%: brand panel (`primary-600` bg, illustration, tagline)

**Form panel:**
- Centred vertically, max 400px wide, 48px horizontal padding
- Logo + wordmark top
- "Manager portal" chip — `primary-100` bg, `primary-700` text
- "Sign in to your account" — `display-md`
- Email + password inputs
- Forgot password link
- "Sign in" → `primary` button, full width
- "Don't have an account? Register your company" → link

**Brand panel:**
- PitchUp logo large, white
- "Everything you need to manage your pitches." — `display-md`, white
- 3 feature bullets with checkmarks

---

### 12.2 Company Registration Wizard

**Layout:** Single column, max 640px, centred on page with white bg
**Progress steps:** step indicator at top (4 steps, connected dots + labels)

Step components follow the same rules as PRD §8.1 but in web form layout:
- 2-column grid for paired inputs (first + last name, city + postal)
- Section headers with subtle `neutral-200` divider below
- File upload: drag-and-drop zone (dashed border, `neutral-200`, `radius-md`) with click fallback

---

## 13. Web — Manager Dashboard

### 13.1 Overview Page

**Top stats row (4 cards):**
- Card: white bg, `shadow-sm`, `radius-md`, 20px padding
- Icon (32px, coloured): `primary-600`, `accent-500`, `info-500`, `warning-500`
- Value: `display-md`, `neutral-900`
- Label: `body-md`, `neutral-500`
- Delta badge: "+12% vs last week" — `success-500` or `error-500`

Cards: Revenue today | Bookings today | Occupancy rate | No-shows this week

**Upcoming bookings table (next 10 bookings):**
- Table: white bg, `shadow-sm`, `radius-md`
- Table header: `neutral-50` bg, `label-md`, `neutral-500`, uppercase
- Row height: 56px
- Columns: Time | Pitch | Player | Teams | Shirts | Status | Actions
- Status pill: same colours as mobile
- Actions: "Details" link

**Quick actions row:**
- "Add pitch" — `primary` button
- "Block time" — `secondary` button (adds unavailability to calendar)

---

## 14. Web — Pitch Management

### 14.1 Pitch List

**Table:**
- Columns: Photo (48px thumbnail) | Name | Surface | Size | Status | Today's bookings | Rating | Actions
- Actions per row: "Edit" (icon) | "Activate/Deactivate" (toggle) | "Delete" (icon, `error-500`)
- Sort on column headers
- "Add Pitch" button top right (`primary`)

### 14.2 Pitch Editor

**Layout:** 2-column (sidebar tabs left, content right on desktop; stacked on tablet)

**Tabs (left sidebar, 200px):**
- Basic Info
- Photos
- Amenities
- Pricing
- Shirts
- Availability

Each tab content in main panel, same specs as PRD §8.2 but in web form:

**Photos tab:**
- Drag-and-drop grid (3-column, responsive)
- Each photo: thumbnail, drag handle (reorder), delete X
- Upload dropzone: dashed, "Drag photos here or click to upload"
- Photo limit: 10, count shown "3 / 10"

**Pricing tab:**
- Inline table for peak periods: + Add period button, each row = day checkboxes + time range + rate
- Live preview: "A player booking 2h on Thursday at 19:00 would pay XX RON"

**Availability tab:**
- 7-row weekly schedule grid
- Each row: day label + "Closed" toggle + open time + close time (if not closed)
- Exception dates: date picker + reason input + "Add exception" button, listed below

**Save/Cancel:**
- Sticky footer bar inside content panel
- "Save changes" — `primary` button
- "Cancel" — `ghost` button
- Unsaved indicator: "Unsaved changes" dot in tab label

---

## 15. Web — Booking Management

### 15.1 Calendar View

**Header:** Month/Week/Day toggle (segmented control) + date navigation + "Today" button
**Pitch filter:** multi-select dropdown (show/hide specific pitches)

**Week view (default):**
- 7 columns (Mon–Sun), rows = time slots (30-min height: 40px each)
- Each booking block: pitch colour bg, pitch name + player name + time label
- Click block → slide-in drawer (booking detail, right side)
- Empty slot click → quick-add booking (future feature)
- Current time line: `accent-500` dashed

**Pitch colour legend:** colour dot + pitch name, horizontal row below date header

### 15.2 Booking List

**Filters bar:**
- Date range picker + pitch selector + status filter + search player name
- "Export CSV" button (right)

**Table:**
- Columns: Date | Time | Duration | Pitch | Player | Teams | Shirts | Amount | Status | Actions
- Row actions: "View" | "Mark no-show" (only if eligible — greyed otherwise)
- Expandable rows: click to inline-expand teams/shirts detail

### 15.3 Booking Detail (side drawer or full page)

Same data as PRD §8.3, laid out in 2-column card grid.

**No-show button:**
- `destructive` button, enabled 30 min after booking start
- Clicks → confirmation modal:
  - Warning text (cannot be undone)
  - Reason dropdown
  - "Confirm no-show" — `destructive` button
  - "Cancel" — `ghost` button

---

## 16. Web — Analytics

### 16.1 Layout

Date range picker top right (last 7d / 30d / 90d / custom).

**Revenue chart:**
- Line chart, `primary-600` stroke, `primary-50` fill below line
- X-axis: dates, Y-axis: RON
- Hover tooltip: date + revenue + booking count

**Occupancy heatmap:**
- Grid: rows = Mon–Sun, columns = 08:00–23:00 (30-min slots)
- Cell colour: white (0%) → `primary-100` (25%) → `primary-300` (50%) → `primary-500` (75%) → `primary-700` (100%)
- Hover: tooltip with exact occupancy %

**Pitch performance table:**
- Sortable columns
- Sparkline in Revenue column (mini 7-day trend line)

**No-show section:**
- Gauge chart: no-show rate %
- Threshold markers: 5% (good), 10% (warning), 20% (critical)

---

## 17. Web — Reviews

**Two-panel layout:**
- Left (340px): pitch selector + rating summary per pitch
- Right: review list for selected pitch

**Review list:**
- Filter: All | Unanswered | Flagged
- Sort: Newest | Lowest rated
- Each review card: avatar + name + stars + date + text + photos
- "Reply" button → inline reply textarea (shows beneath review, 300 char limit)
- Submitted reply: shown indented under review, edit button (within 24h)
- "Report" button: dropdown reason → submit to admin

---

## 18. Web — Settings

**Section tabs (left nav within settings page):**
- Company Profile
- Working Hours
- Payout & Billing
- Notifications
- Team (future)
- Danger zone

**Company Profile:** same fields as onboarding, edit + save.

**Working Hours:** weekly grid (same as pitch availability but company-wide).

**Payout & Billing:**
- Current Stripe Connect status: "Connected ✓" or "Setup required"
- "Manage payout settings" → Stripe Express dashboard link
- Platform fee % displayed (informational, not editable)
- Billing history table: date + amount + status (past payouts)

**Notifications:**
- Toggle grid: event type × channel (email / push)
- "Save preferences" button

**Danger zone:**
- "Deactivate company" — `destructive-outline` button (reversible, hides all pitches)
- "Delete company" — `destructive` button, requires type company name to confirm

---

## 19. Accessibility

- **Touch targets:** minimum 44×44px on all interactive elements (mobile)
- **Colour contrast:** all text ≥ 4.5:1 against background (WCAG AA)
- **Focus states:** visible focus ring on all interactive elements (web: 2px `primary-600` outline, 2px offset)
- **Screen reader:** all images have descriptive `alt` text; icons with no label have `accessibilityLabel`
- **Semantic HTML:** use `<button>`, `<nav>`, `<main>`, `<h1>`–`<h3>` correctly (web)
- **Dynamic text:** layouts flex to accommodate larger font sizes (no fixed-height text containers on mobile)
- **Reduced motion:** animations disabled when system `prefers-reduced-motion` is set
- **Error announcements:** form errors announced via `aria-live="polite"` (web) / `AccessibilityInfo.announceForAccessibility` (mobile)

---

## 20. Animation & Motion

**Principles:** Purposeful, fast, never blocking.

| Animation | Duration | Easing | Notes |
|---|---|---|---|
| Screen push (mobile) | 350ms | `easeInOutCubic` | RN default navigation |
| Bottom sheet open | 300ms | `spring (damping 20, stiffness 200)` | Feels physical |
| Bottom sheet close | 250ms | `easeIn` | Slightly faster out |
| Modal fade in | 200ms | `easeOut` | |
| Toast appear | 250ms | `spring` | Slide up + fade |
| Toast dismiss | 200ms | `easeIn` | Slide down + fade |
| Booking progress bar | 300ms | `easeInOut` | Per step transition |
| Confirmation checkmark | 600ms | custom path draw | SVG stroke animation |
| Confirmation pulse | 800ms | `easeInOut`, infinite | Subtle, 1.0→1.05 |
| Skeleton shimmer | 1500ms | linear, infinite loop | |
| Button press | 100ms | `easeIn` | Scale 0.97 |
| Star rating select | 150ms | `easeOut` | Fill left-to-right |
| Slot selection | 200ms | `easeOut` | Background colour transition |
| Amenity chip toggle | 150ms | `easeOut` | Colour + border |
| Filter count badge | 200ms | `spring` | Scale pop |
| Tab switch | 200ms | `easeInOut` | Underline slide |

**Rule:** No animation > 400ms for user-initiated actions. Longer only for celebratory moments (confirmation).
