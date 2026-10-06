# Product Requirements Document — PitchUp

> **App name (working title):** PitchUp  
> **Version:** 1.0  
> **Last updated:** 2026-10-05  
> **Author:** Alexandru David Serea  
> **Status:** Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Personas](#3-user-personas)
4. [Tech Stack](#4-tech-stack)
5. [Information Architecture](#5-information-architecture)
6. [Authentication & Accounts](#6-authentication--accounts)
7. [Player Features](#7-player-features)
8. [Manager Features](#8-manager-features)
9. [Penalty & Trust System](#9-penalty--trust-system)
10. [Notifications](#10-notifications)
11. [Ratings & Reviews](#11-ratings--reviews)
12. [Admin Panel (Internal)](#12-admin-panel-internal)
13. [Data Models](#13-data-models)
14. [API Surface (high-level)](#14-api-surface-high-level)
15. [Edge Cases & Business Rules](#15-edge-cases--business-rules)
16. [Open Questions](#16-open-questions)

---

## 1. Overview

PitchUp is a two-sided marketplace platform for booking football pitches.

- **Players** find, review, and book football pitches near them.
- **Managers** (venue owners / operators) list their pitches, manage availability, and grow their business.

Platform surfaces:
- **Web app** (Next.js 15) — primary for managers, accessible to players
- **Mobile app** (React Native CLI) — primary for players

Both share a single backend (Next.js API Routes) and database (PostgreSQL via Prisma).

---

## 2. Goals & Success Metrics

### Business Goals

| Goal | Metric | Target (6 months post-launch) |
|---|---|---|
| Player adoption | Registered players | 1,000 |
| Venue coverage | Active companies listed | 50 |
| Booking volume | Bookings per month | 500 |
| Reliability | No-show rate | < 10% |
| Quality | Average pitch rating | ≥ 4.0 / 5.0 |

### Learning Goals (for developer)

- Build and own a full-stack TypeScript monorepo
- Understand REST API design, DB modeling, and auth
- Implement real payment and file upload flows
- Deploy a production-grade web + mobile product

---

## 3. User Personas

### 3.1 Player (end user)

**Who:** 18–35 year old recreational football player. Organises weekly games with friends. Books 1–4 times per month.

**Needs:**
- Find available pitches quickly by location
- See real availability (no phone tag with venues)
- Know exact price upfront
- Manage his group's shirt colours so teams are distinguishable
- Trust that his booking won't be double-booked

**Pain points:**
- Calling venues that don't pick up
- Arriving and finding the pitch occupied
- Unclear pricing (hidden fees)

### 3.2 Manager (venue operator)

**Who:** Owner or employee of a sports complex. Manages 1–10 pitches. May not be tech-savvy.

**Needs:**
- Reduce phone-call bookings and manual calendar management
- Avoid no-shows that waste pitch time
- Collect payment upfront
- Understand revenue and occupancy at a glance

**Pain points:**
- No-shows with no recourse
- Double-bookings from phone + walk-in combinations
- No visibility into peak hours or revenue trends

### 3.3 Platform Admin (internal)

**Who:** Developer / operator of PitchUp.

**Needs:**
- Approve new company registrations
- Handle dispute resolution
- Monitor system health and abuse

---

## 4. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Monorepo | Turborepo | Workspace: apps/web, apps/mobile, packages/shared |
| Web | Next.js 15 (App Router) | SSR + API Routes + Server Actions |
| Mobile | React Native CLI (bare) | iOS + Android |
| Styling (web) | Tailwind CSS | shadcn/ui component library |
| Styling (mobile) | StyleSheet + custom design tokens | No NativeWind for now |
| Backend | Next.js API Routes | REST, co-located with web |
| Database | PostgreSQL | Hosted on Railway or Supabase (DB only) |
| ORM | Prisma | Type-safe queries, migrations |
| Auth | NextAuth.js v5 | Sessions for web; JWT tokens for mobile |
| File storage | Cloudinary | Pitch photos, profile photos |
| Maps (web) | Google Maps JS API | Venue map view |
| Maps (mobile) | react-native-maps | Google Maps provider |
| Location (mobile) | react-native-geolocation-service | GPS + permission handling |
| Payments | Stripe | Checkout + Connect for payouts |
| Email | Resend | Transactional emails |
| SMS | Twilio | OTP verification, booking reminders |
| Shared types/validation | Zod | Shared between web + mobile + API |
| Server state (web) | TanStack Query v5 | Data fetching + caching |
| Server state (mobile) | TanStack Query v5 | Same |
| Global state | Zustand | Lightweight, minimal |
| Deploy (web) | Vercel | Auto-deploy from main |
| Deploy (mobile) | Manual / Fastlane (later) | APK/IPA build locally for now |

---

## 5. Information Architecture

### 5.1 Mobile app screens (Player)

```
(Auth)
  ├── Splash
  ├── Onboarding (3 slides)
  ├── Login
  ├── Register
  └── Phone Verification (OTP)

(Main — Tab Bar)
  ├── Discover (tab 1)
  │   ├── City selector / Location banner
  │   ├── Company list (default)
  │   ├── Map view toggle
  │   ├── Company detail
  │   │   ├── Pitch list
  │   │   └── Reviews tab
  │   └── Pitch detail
  │       ├── Photo gallery
  │       ├── Info (amenities, surface, size)
  │       ├── Pricing
  │       ├── Reviews
  │       └── → Book Now button → Booking Flow
  │
  ├── My Bookings (tab 2)
  │   ├── Upcoming
  │   ├── Past
  │   ├── Cancelled
  │   └── Booking detail
  │       ├── Status
  │       ├── Pitch + company info
  │       ├── Date / time / duration
  │       ├── Teams + shirts
  │       ├── Payment receipt
  │       └── Cancel button (if eligible)
  │
  ├── Notifications (tab 3)
  │   └── Notification list (grouped by date)
  │
  └── Profile (tab 4)
      ├── Personal info
      ├── Trust score
      ├── Payment methods
      ├── My reviews
      ├── Penalty history
      └── Settings (notifications, language, logout)

(Booking Flow — Modal Stack)
  ├── Step 1: Select date
  ├── Step 2: Select time interval (slot picker with availability overlay)
  ├── Step 3: Teams & shirts
  ├── Step 4: Summary & payment
  └── Step 5: Confirmation
```

### 5.2 Web app screens (Manager)

```
(Auth)
  ├── Login
  └── Register (company)
      ├── Step 1: Account info
      ├── Step 2: Company info
      ├── Step 3: Stripe Connect onboarding
      └── Step 4: Awaiting approval (if admin review required)

(Dashboard — Sidebar nav)
  ├── Overview (revenue, bookings today, alerts)
  ├── Calendar (all pitches, day/week/month view)
  ├── Bookings
  │   ├── List (filterable)
  │   └── Booking detail
  │       ├── Player info
  │       ├── Booking details
  │       ├── Payment status
  │       └── Mark no-show button
  ├── Pitches
  │   ├── Pitch list
  │   └── Pitch editor
  │       ├── Basic info
  │       ├── Photos
  │       ├── Amenities
  │       ├── Pricing
  │       ├── Availability schedule
  │       └── Shirt inventory
  ├── Reviews
  │   ├── Review list
  │   └── Reply modal
  ├── Analytics
  │   ├── Revenue chart
  │   ├── Occupancy heatmap
  │   └── No-show report
  └── Settings
      ├── Company profile
      ├── Payout settings
      └── Notification preferences
```

### 5.3 Web app (Player — same domain, different route prefix)

Players can also use the web app for booking. Same features as mobile, responsive layout.

---

## 6. Authentication & Accounts

### 6.1 Registration — Player

**Fields:**
- Full name (required)
- Email address (required, unique)
- Phone number (required, unique) — format: +country code + number
- Password (required, min 8 chars, 1 uppercase, 1 number)
- City (required, from predefined list or GPS)
- Profile photo (optional, set later)
- Date of birth (required, must be ≥ 16 years old)

**Flow:**
1. Fill registration form
2. Verify email (magic link or 6-digit code, expires in 15 min)
3. Verify phone (6-digit SMS OTP, expires in 10 min)
4. Profile complete → redirect to Discover

**Social login (mobile only):**
- Google Sign-In
- Apple Sign-In (iOS required by App Store)
- On first social login: collect phone number + city before completing

### 6.2 Registration — Manager

**Fields (Account):**
- Full name
- Email address
- Password
- Phone number

**Fields (Company — separate step):**
- Company name
- Company phone number (public-facing)
- Address (street, city, country)
- Description (max 500 chars)
- Logo (image upload)
- Tax/business ID (optional at launch, required for payout)

**Flow:**
1. Create manager account (same fields as player)
2. Company setup wizard (3 steps)
3. Stripe Connect onboarding (for receiving payouts)
4. Admin approves company (manual at first, auto later)
5. Company goes live — can add pitches

### 6.3 Login

- Email + password
- "Forgot password" → email reset link (expires in 1 hour)
- Social login (mobile)
- Session: web uses HttpOnly cookie; mobile uses JWT stored in SecureStorage

### 6.4 Account roles

| Role | Can do |
|---|---|
| `PLAYER` | Browse, book, review, manage own profile |
| `MANAGER` | Everything a player can + manage company/pitches/bookings |
| `ADMIN` | Full access, internal panel |

A manager account automatically has player capabilities.

### 6.5 Profile — Player

- Edit name, email, phone, photo, city
- Changing email/phone triggers re-verification
- Delete account: soft delete, bookings remain for history

### 6.6 Security

- Passwords hashed with bcrypt (cost factor 12)
- JWT secret rotated monthly
- Rate limiting: 5 login attempts per 15 min per IP
- All API routes require auth except public listing endpoints

---

## 7. Player Features

### 7.1 Location & City Selection

**Auto-detect (mobile):**
1. App requests location permission on first launch (Discover tab)
2. If granted → reverse geocode to city → show "Showing pitches in {City}" banner
3. User can tap banner to change city manually

**Manual select:**
- Modal with searchable city list (predefined, seeded from DB)
- Selection persists in local storage

**Web:**
- Banner on Discover page with detected or selected city
- Location permission via browser Geolocation API (not required, fallback to manual)

**Business rules:**
- City selection is mandatory before showing pitches
- If location denied and no city selected → city picker modal blocks Discover tab

---

### 7.2 Discover — Company List

**Default view:** List of companies in selected city

**Each company card shows:**
- Company logo
- Company name
- City / neighbourhood
- Number of pitches (e.g. "3 pitches")
- Average rating (1 decimal, e.g. 4.3) + review count
- Distance from user (if location granted, in km)
- "Open now" badge (based on any pitch being available at current time)
- Price range indicator (e.g. "from 50 RON/h")

**Sorting:**
- Default: distance (if location available), else by rating
- Sort options: Distance, Rating (high to low), Price (low to high), Newest

**Filtering:**
- City (already selected, can change)
- Surface type (multi-select): Natural grass, Artificial grass, Futsal
- Pitch size: 5v5, 7v7, 11v11
- Amenities (multi-select): Showers, Parking, Lighting, Changing rooms, Ball rental
- Price range: slider (min/max per hour)
- Available now: toggle (shows only companies with a pitch available in next 2 hours)
- Open now: toggle

**Map view toggle:**
- Switches list to a full map with company pin markers
- Tapping a pin shows mini company card at bottom
- Mini card has "View" button → company detail

**Search:**
- Search bar at top
- Searches company name and city
- Live results as user types (debounced 300ms)

---

### 7.3 Company Detail

**Header:**
- Company logo (large)
- Company name
- Address (tappable → opens maps app)
- Phone number (tappable → calls)
- Working hours (today's hours prominently, expandable full week schedule)
- Verified badge (if admin approved)
- Overall rating + review count

**Pitches tab:**
- List of all pitches belonging to this company
- Each pitch card: name, surface, size, price/hour, thumbnail, rating
- Tap → Pitch Detail

**Reviews tab:**
- Overall rating breakdown (1–5 stars with bar chart)
- List of reviews (most recent first)
- Each review: player name + avatar, rating, date, text, manager reply (if any)
- Load more (pagination)

---

### 7.4 Pitch Detail

**Photos:**
- Horizontal scroll gallery (up to 10 photos)
- Tap to open fullscreen lightbox
- Photo counter (e.g. "3 / 10")

**Info section:**
- Pitch name
- Surface type + icon (grass/artificial/futsal)
- Size: "5v5 (25×45m)" format
- Description (collapsible if > 4 lines)

**Amenities:**
- Grid of amenity chips with icons
- Available: filled/coloured chip
- Not available: greyed out chip
- Amenities: Showers, Changing rooms, Parking, Night lighting, Ball rental (free/paid), Refreshments, Lockers, Referee available, First aid kit

**Pricing:**
- Clear table:
  - Off-peak: Mon–Fri 08:00–17:00 → XX RON/h
  - Peak: Mon–Fri 17:00–22:00 + Weekends all day → XX RON/h
  - Notes (e.g., "minimum 1 hour, billed per 30 min after")
- Shirt rental: XX RON per shirt (shown if shirts available)

**Rating & Reviews (preview):**
- Overall rating + 3 most recent reviews
- "See all reviews" → expands or navigates to Reviews screen

**Availability preview:**
- This week's availability shown as a compact slot grid (today + next 6 days)
- Each day has colour-coded blocks: available (green), booked (red), unavailable/closed (grey)
- Tap day → jumps to booking flow with that date pre-selected

**Book Now button:**
- Sticky at bottom
- Disabled with tooltip if: pitch is inactive, company is not approved, user's trust score blocks booking

---

### 7.5 Booking Flow

Multi-step bottom sheet modal (mobile) / multi-step page (web).

**Step 1 — Select Date**

- Calendar picker (current month + next 2 months scrollable)
- Unavailable dates greyed out:
  - Dates before today
  - Dates where pitch has no working hours (e.g. pitch closed on Mondays)
  - Dates fully booked
- Selected date highlighted
- Next button → Step 2

---

**Step 2 — Select Time Interval**

- Header: selected date
- Visual slot timeline: 08:00 – 23:00 (configurable per pitch)
- Each 30-min block is a selectable cell
- States:
  - Available: white/light
  - Booked by others: red, non-selectable
  - Your selection: blue/primary, draggable
  - Outside working hours: dark grey, non-selectable
- Interaction:
  - Tap start slot → tap end slot → interval selected
  - OR: tap-hold and drag to select range
  - Minimum booking: 1 hour
  - Maximum booking: 4 hours (configurable per pitch)
  - Selection cannot span booked slots (auto-snaps to available range)
- Selected interval shown as a summary chip: "19:00 – 21:00 (2 hours)"
- Duration + price preview: "2h × 80 RON/h = 160 RON"
- Back button → Step 1 | Next button → Step 3

---

**Step 3 — Teams & Shirts**

- **Number of teams:**
  - Segmented control: "2 Teams" | "3 Teams"
  - Default: 2 Teams

- **Number of players (optional but encouraged):**
  - Numeric stepper for each team
  - Team A: − [n] +
  - Team B: − [n] +
  - (Team C: − [n] +) if 3 teams selected
  - Used for: capacity warning if total > pitch size recommends (e.g. >22 for 11v11)

- **Coloured shirts:**
  - Toggle: "I need coloured shirts" (on/off)
  - If on:
    - Per-team shirt picker:
      - Each team gets a colour selector (swatches: red, blue, green, yellow, orange, white, black, purple)
      - Quantity stepper per team (default: number of players entered)
    - Total shirts requested shown
    - Availability check: if requested > manager's shirt inventory → warning "Only X shirts available in this colour"
    - Shirt rental cost added to price preview
  - If off: no charge for shirts

- **Optional note to manager:**
  - Text field (max 200 chars)
  - Placeholder: "e.g. It's a birthday game, could we get some extra time setup?"

- Price summary updates live as selections change
- Back → Step 2 | Next → Step 4

---

**Step 4 — Summary & Payment**

- Full booking summary card:
  - Pitch name + company name
  - Date + time interval + duration
  - Number of teams
  - Players per team (if entered)
  - Shirts (colour + quantity per team, if selected)
  - Note to manager (if entered)

- Price breakdown:
  - Pitch rental: Xh × Y RON/h = Z RON
  - Shirt rental: N shirts × M RON = P RON
  - Platform fee: Q RON (e.g. 5% or fixed)
  - **Total: T RON**

- Cancellation policy (displayed clearly):
  - "Free cancellation until {datetime — 24h before booking}"
  - "After that: 50% refund"
  - "No refund if cancelled within 2 hours of booking"

- Payment method:
  - Saved card (if any) shown as default
  - "+ Add card" opens Stripe card element
  - No storing raw card numbers (Stripe handles this)

- Confirm & Pay button:
  - On tap → Stripe payment intent created → card charged
  - Loading state during payment processing
  - On success → Step 5
  - On failure → toast with error, stay on Step 4

---

**Step 5 — Confirmation**

- Success animation (checkmark)
- Summary:
  - Booking ID
  - Pitch + company
  - Date + time
  - Total paid
- Buttons:
  - "View Booking" → navigates to Booking Detail in My Bookings
  - "Back to Home" → closes modal, returns to Discover

- Email confirmation sent automatically (Resend)
- Push notification sent

---

### 7.6 My Bookings

**Tabs:** Upcoming | Past | Cancelled

**Each booking card (Upcoming):**
- Pitch name + company logo
- Date + time interval
- Status badge: Confirmed | Pending (if manual confirm enabled) | No-show reported
- "Starts in X days / X hours" countdown
- Tap → Booking Detail

**Each booking card (Past):**
- Same info
- Status: Completed | No-show
- "Leave a review" button (if not yet reviewed)

**Each booking card (Cancelled):**
- Status: Cancelled by player | Cancelled by manager
- Refund amount shown

**Booking Detail screen:**
- Company name + logo + address + phone (tappable)
- Pitch name
- Date, start time, end time, duration
- Teams: count + colours (if shirts ordered)
- Shirts: per team breakdown
- Note to manager
- Booking ID
- Payment breakdown (same as summary)
- Refund info (if cancelled)
- Status history (e.g. Booked 14:32 → Confirmed 14:35 → Completed)
- Actions (context-dependent):
  - Upcoming + cancellation eligible: "Cancel Booking" (red, triggers confirmation bottom sheet)
  - Past + no review: "Rate this pitch"
  - No-show disputed: "Dispute no-show"

---

### 7.7 Cancel Booking

**Trigger:** Cancel button on Booking Detail

**Bottom sheet confirmation:**
- Shows cancellation policy for this booking
- Shows refund amount (calculated based on time until booking)
- Two buttons: "Keep Booking" | "Cancel — get {refund} refund"
- On confirm → API call → booking status = CANCELLED → refund initiated
- Toast: "Booking cancelled. Refund of X RON will appear in 5–10 business days."

**Cancellation fee rules (see §9 for full policy):**
- > 24h before: full refund, no fee
- 2–24h before: 50% refund
- < 2h before or no-show: 0% refund + trust score impact

---

### 7.8 Reviews & Ratings

**Trigger:** After booking status = COMPLETED, player gets push notification + prompt in Past tab.

**Review form:**
- Star rating 1–5 (required)
- Text review (optional, min 10 chars if provided, max 500 chars)
- Photo upload (optional, max 3 photos)
- Anonymous toggle (hides player name, shows "Anonymous player")
- Submit → review visible immediately, manager notified

**Review display rules:**
- A player can only leave 1 review per booking
- Review can be edited within 24h of submission
- Review can be deleted by player (soft delete, replaced with "Review deleted by user")
- Admin can remove abusive reviews

---

## 8. Manager Features

### 8.1 Company Setup (Onboarding Wizard)

**Step 1 — Company Info**
- Company name (max 80 chars)
- Description (max 500 chars, markdown not supported)
- Logo upload (min 200×200px, JPEG/PNG, max 2MB)
- Website URL (optional)
- Social links: Facebook, Instagram (optional)

**Step 2 — Location**
- Address line 1
- Address line 2 (optional)
- City (from predefined list)
- County / State
- Country (default: Romania)
- Postal code
- Map pin confirmation (auto-geocoded, manager can drag to correct)

**Step 3 — Contact & Hours**
- Public phone number
- Public email
- Working hours per day of week:
  - Each day: Closed toggle | Open time – Close time
  - Can set different hours per day
  - E.g. Mon–Fri: 08:00–23:00, Sat–Sun: 07:00–24:00

**Step 4 — Stripe Connect**
- Redirect to Stripe Connect onboarding
- After completing Stripe: return to app, company status = PENDING_APPROVAL

**After submit:**
- Admin receives notification of new company registration
- Manager sees "Your company is under review" screen
- Admin approves → company status = ACTIVE → manager notified

---

### 8.2 Pitch Management

**Pitch List page:**
- Table of all pitches: name, surface, size, status (Active/Inactive), bookings today
- "Add Pitch" button → Pitch Editor

**Pitch Editor — tabs:**

**Tab 1: Basic Info**
- Pitch name (max 60 chars)
- Surface type: Natural grass | Artificial grass | Futsal (concrete/rubber)
- Pitch size: 5v5 | 7v7 | 11v11 | Custom
- Dimensions: width × length (metres) — auto-filled for standard sizes
- Description (max 1000 chars)
- Active / Inactive toggle (inactive = hidden from players, existing bookings unaffected)

**Tab 2: Photos**
- Upload up to 10 photos
- Drag to reorder (first photo = cover/thumbnail)
- Min resolution: 800×600px
- Max size per photo: 5MB
- Accepted formats: JPEG, PNG, WebP
- Cloudinary handles resizing + optimisation

**Tab 3: Amenities**
Checkbox list:
- [ ] Showers (free)
- [ ] Showers (paid)
- [ ] Changing rooms
- [ ] Parking (free)
- [ ] Parking (paid)
- [ ] Night lighting
- [ ] Ball rental (free)
- [ ] Ball rental (paid, specify price)
- [ ] Refreshments / canteen
- [ ] Lockers
- [ ] Referee available (specify if free or paid)
- [ ] First aid kit
- [ ] Wheelchair accessible
- [ ] Wi-Fi

**Tab 4: Pricing**
- Off-peak rate: __ RON / hour
- Peak rate: __ RON / hour
- Peak hours definition:
  - Days: checkboxes Mon–Sun
  - Time range: start – end (e.g. 17:00 – 23:00)
  - Multiple peak ranges can be added (e.g. weekday evenings + all weekend)
- Minimum booking duration: 1h | 1.5h | 2h (selector)
- Maximum booking duration: 2h | 3h | 4h | No limit
- Advance booking limit: bookable up to 30 | 60 | 90 days in advance

**Tab 5: Shirt Inventory**
- Does this pitch offer coloured shirts? Yes | No
- If yes:
  - Per colour row: colour swatch + colour name + quantity (e.g. Red: 14 shirts)
  - Add colour button
  - Remove colour button
- Shirt rental price: __ RON per shirt per booking
- Note: shirt availability is checked at booking time against total booked shirts for that time slot

**Tab 6: Availability Schedule**
- Weekly recurring schedule: same as company hours but pitch-specific
  - Can be more restrictive than company hours (never more permissive)
- Exception dates:
  - Add blocked dates (e.g. maintenance, holidays)
  - Reason (optional, internal only)
  - Blocked dates show as unavailable to players

---

### 8.3 Booking Management

**Calendar view:**
- Month / Week / Day toggle
- Each booking shown as a block on the calendar
- Colour-coded by pitch (each pitch gets a consistent colour)
- Hover/tap → booking mini-card
- Click → Booking Detail (manager view)

**Booking list view:**
- Columns: Date, Time, Duration, Pitch, Player name, Teams, Shirts, Status, Payment
- Sortable columns
- Filterable: date range, pitch, status, payment status
- Export to CSV button

**Booking Detail (manager view):**
- Player: name, phone (tappable), email
- Booking: pitch, date, time, duration
- Teams: count, player counts per team
- Shirts: per team colour + quantity
- Note from player (if any)
- Payment: amount, paid at, payment method last 4 digits
- Status: Confirmed | No-show | Cancelled
- Actions:
  - "Mark as No-show" (only available 30 min after booking start time)
    - Confirmation modal: "Are you sure? This will trigger a penalty charge and affect this player's trust score."
    - Requires a reason (dropdown): Player didn't arrive | Arrived late | Only partial group arrived | Other
    - On confirm → no-show recorded → penalty system triggered
  - "Cancel booking" (manager-initiated, full refund given to player, note to player)
  - "Contact player" → opens phone/email options

---

### 8.4 Analytics Dashboard

**Overview cards (today):**
- Revenue today: X RON
- Bookings today: N
- Occupancy rate: X% (booked hours / total available hours)
- No-shows this week: N

**Revenue chart:**
- Line chart: daily revenue for selected period (default: last 30 days)
- Date range picker
- Breakdown by pitch (toggle)

**Occupancy heatmap:**
- X-axis: hours (08:00 – 23:00)
- Y-axis: days of week (Mon – Sun)
- Cell colour intensity = occupancy rate
- Shows busiest time slots → helps manager set peak prices

**Pitch performance table:**
- Columns: Pitch name, Total bookings, Revenue, Avg rating, No-show rate
- Sortable

**No-show report:**
- Total no-shows in period
- No-show rate (%)
- List of no-show bookings with player name, date, penalty charged

---

### 8.5 Reviews Management

**Reviews list:**
- Filter: All pitches | specific pitch
- Sort: Newest | Lowest rated | Unanswered
- Each review: star rating, text, player name, date, pitch name
- "Reply" button (opens inline reply form, max 300 chars)
- "Report" button (flags to admin)
- Manager can reply once per review, can edit reply within 24h

---

### 8.6 Stripe Connect & Payouts

**Onboarding:**
- Manager redirected to Stripe Express onboarding
- After: Stripe `account_id` stored on company record

**Payout flow:**
- When player pays: funds held by platform (Stripe)
- After booking completes (+ 24h buffer for disputes): funds transferred to manager's Stripe account minus platform fee
- Platform fee: 8% of booking value (configurable)
- Shirt rental revenue: also transferred to manager minus fee

**Refund flow:**
- Player cancels with refund eligible: Stripe reverse the charge
- Partial refund: Stripe partial refund, platform adjusts transfer
- No-show: no refund, platform processes transfer to manager (minus fee)

---

## 9. Penalty & Trust System

### 9.1 Trust Score

Every player starts with a trust score of **100**.

| Event | Score Change |
|---|---|
| Booking completed (showed up) | +2 (max +10/month) |
| Booking completed + left review | +1 |
| Late cancellation (2–24h before) | −5 |
| Very late cancellation (< 2h) | −10 |
| No-show confirmed by manager | −20 |
| Successful dispute of false no-show | +10 (restored) |

**Score tiers:**

| Tier | Score | Effect |
|---|---|---|
| Excellent | 90–100 | No restrictions. Can book up to 4 slots in advance. |
| Good | 70–89 | No restrictions. |
| Fair | 50–69 | Must add credit card on file to book. Warning shown. |
| Poor | 30–49 | Requires upfront deposit (100% of booking). Max 1 active booking at a time. |
| Suspended | < 30 | Cannot book. Must contact support to appeal. |

Score is visible to player on their profile. Score is **not** visible to managers directly (to avoid discrimination), but the "Poor" and "Suspended" tiers block booking at the platform level.

Score recovers at +1 per calendar month of no negative events (capped at 100).

---

### 9.2 Cancellation Policy

| When cancelled | Refund |
|---|---|
| > 24h before booking | 100% refund |
| 2h – 24h before booking | 50% refund |
| < 2h before booking | 0% refund |
| No-show (manager confirmed) | 0% refund + penalty charge |

Cancellation window can be configured per company (manager can set stricter, not looser, than platform defaults).

---

### 9.3 No-Show Process

1. Booking start time passes
2. 30 minutes after start: manager's "Mark no-show" button activates
3. Manager marks no-show + selects reason
4. System:
   - Logs no-show event
   - Charges player: platform fee (10 RON flat) + no-show penalty (20% of booking value, configurable)
   - Deducts 20 trust score points
   - Sends push + email to player: "You've been reported as a no-show for your booking at {Pitch} on {date}"
   - Manager receives transfer (full booking amount minus platform fee)
5. Player has 24h to dispute

---

### 9.4 No-Show Dispute

1. Player sees no-show notification
2. Taps "Dispute this no-show" in booking detail or notification
3. Dispute form:
   - What happened? (text, max 300 chars)
   - Evidence: optional photos (max 3, e.g. showing they were there)
4. Dispute created → admin notified
5. Admin reviews:
   - Can side with player → no-show reversed, score restored, penalty refunded, manager notified
   - Can side with manager → no-show stands
6. Decision communicated to both parties
7. Resolution target: 48 hours

---

### 9.5 Insurance / Deposit (Future — v1.1)

Idea: players with low trust scores or high-value bookings can optionally purchase cancellation insurance (via Stripe) that covers the penalty fee in case of emergency cancellation. Out of scope for v1.0.

---

## 10. Notifications

### 10.1 Channels

- **Push notifications** (mobile — Firebase FCM)
- **Email** (all users — Resend)
- **SMS** (booking reminders + OTP — Twilio)

### 10.2 Notification Events

| Event | Push | Email | SMS |
|---|---|---|---|
| Booking confirmed | ✓ | ✓ | — |
| Booking reminder: 24h before | ✓ | ✓ | ✓ |
| Booking reminder: 2h before | ✓ | — | — |
| Booking cancelled by player | ✓ | ✓ | — |
| Booking cancelled by manager | ✓ | ✓ | ✓ |
| Refund processed | ✓ | ✓ | — |
| No-show reported | ✓ | ✓ | ✓ |
| Penalty charge | ✓ | ✓ | — |
| Dispute resolved | ✓ | ✓ | — |
| Review left on your pitch | (manager) ✓ | ✓ | — |
| Manager replied to your review | ✓ | — | — |
| OTP code | — | — | ✓ |
| Password reset | — | ✓ | — |

### 10.3 Notification Preferences

Player can turn off (except OTP, legal, security):
- Marketing / promotional (off by default)
- Booking reminders (on by default)
- Review prompts (on by default)

Manager can turn off:
- New booking alerts (on by default)
- Daily digest (off by default)

---

## 11. Ratings & Reviews

### 11.1 Review Eligibility

- Only players who completed a booking at a pitch can review that pitch
- One review per booking (not per player — same player can review after each separate booking)
- Review window: 1–14 days after booking end time
- After 14 days: review prompt dismissed, can no longer submit for that booking

### 11.2 Rating Calculation

- Overall pitch rating = arithmetic mean of all ratings, rounded to 1 decimal
- Minimum 3 reviews required before rating is shown publicly (shows "Not rated yet" before)
- Company overall rating = mean of all its pitches' ratings

### 11.3 Review Moderation

- Auto-flag: profanity filter (basic wordlist)
- Flagged reviews held for admin review
- Admin: Approve | Edit (with reason) | Remove
- Players can report a review ("Report this review" → category: spam, offensive, irrelevant, fake)

---

## 12. Admin Panel (Internal)

Web-only, separate route `/admin`, requires `ADMIN` role.

**Sections:**
- **Companies:** list of all companies, filter by status (pending/active/suspended), approve/reject/suspend
- **Users:** list of all players + managers, search, view profile, adjust trust score manually, suspend account
- **Bookings:** global list, view detail, intervene in disputes
- **Disputes:** list of open disputes, view detail, resolve
- **Reviews:** flagged reviews queue, approve/remove
- **Analytics:** platform-wide metrics (total revenue, GMV, booking volume, active users)
- **Config:** platform fee %, cancellation windows, penalty amounts

Admin panel can be a simple table-based UI, not prioritized for v1.0 polish.

---

## 13. Data Models

High-level entities and key fields (Prisma schema to be defined separately).

### User
```
id, email, phone, passwordHash, name, profilePhotoUrl, city, dateOfBirth,
role (PLAYER | MANAGER | ADMIN), trustScore, stripeCustomerId,
emailVerified, phoneVerified, createdAt, updatedAt, deletedAt
```

### Company
```
id, ownerId (→ User), name, description, logoUrl, websiteUrl,
phone, email, addressLine1, addressLine2, city, country, postalCode,
lat, lng, workingHours (JSON), stripeAccountId,
status (PENDING | ACTIVE | SUSPENDED), createdAt, updatedAt
```

### Pitch
```
id, companyId (→ Company), name, description, surfaceType, size,
widthMeters, lengthMeters, isActive, coverPhotoIndex,
minBookingHours, maxBookingHours, advanceBookingDays,
offPeakRate, peakRate, peakHoursDefinition (JSON),
shirtRentalPrice, hasShirts, createdAt, updatedAt
```

### PitchPhoto
```
id, pitchId, url, cloudinaryPublicId, order, createdAt
```

### PitchAmenity
```
id, pitchId, amenityType (enum), isPaid, price (nullable)
```

### ShirtInventory
```
id, pitchId, colour, quantity
```

### Booking
```
id, pitchId, playerId, startTime, endTime, teamCount,
teamsData (JSON: [{colour, playerCount, shirts: [{colour, qty}]}]),
noteToManager, status (PENDING | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW),
cancelledBy, cancelledAt, cancellationReason,
pitchRateSnapshot, shirtRateSnapshot, platformFee,
totalAmount, refundAmount, stripePaymentIntentId, stripeRefundId,
createdAt, updatedAt
```

### NoShow
```
id, bookingId, reportedByManagerId, reason, penaltyAmount,
disputeStatus (NONE | OPEN | RESOLVED_PLAYER | RESOLVED_MANAGER),
disputeText, disputeEvidenceUrls (JSON), resolvedByAdminId,
resolvedAt, createdAt
```

### Review
```
id, bookingId, pitchId, playerId, rating (1-5), text,
photoUrls (JSON), isAnonymous, managerReply, managerRepliedAt,
isFlagged, flagReason, moderationStatus (APPROVED | PENDING | REMOVED),
createdAt, updatedAt
```

### Notification
```
id, userId, type (enum), title, body, data (JSON),
isRead, sentPush, sentEmail, sentSms, createdAt
```

### TrustScoreEvent
```
id, userId, delta, reason (enum), relatedBookingId, createdAt
```

---

## 14. API Surface (high-level)

Base URL: `/api/v1`

### Auth
```
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/verify-email
POST /auth/send-phone-otp
POST /auth/verify-phone-otp
```

### Users
```
GET    /users/me
PATCH  /users/me
DELETE /users/me
GET    /users/me/trust-score
GET    /users/me/trust-score/history
```

### Companies
```
GET    /companies?city=&page=&sort=&filter=
GET    /companies/:id
POST   /companies                    (manager)
PATCH  /companies/:id                (manager, owner)
GET    /companies/:id/pitches
GET    /companies/:id/reviews
```

### Pitches
```
GET    /pitches/:id
POST   /pitches                      (manager)
PATCH  /pitches/:id                  (manager, owner)
DELETE /pitches/:id                  (manager, owner)
GET    /pitches/:id/availability?date=
POST   /pitches/:id/photos           (manager, multipart)
DELETE /pitches/:id/photos/:photoId  (manager)
PATCH  /pitches/:id/photos/reorder   (manager)
```

### Bookings
```
GET    /bookings                     (player: own, manager: company's)
GET    /bookings/:id
POST   /bookings                     (player)
POST   /bookings/:id/cancel          (player or manager)
POST   /bookings/:id/no-show         (manager)
POST   /bookings/:id/dispute         (player)
```

### Reviews
```
GET    /reviews?pitchId=&page=
GET    /reviews/:id
POST   /reviews                      (player, after completed booking)
PATCH  /reviews/:id                  (player, within 24h)
DELETE /reviews/:id                  (player)
POST   /reviews/:id/reply            (manager)
POST   /reviews/:id/report           (player)
```

### Payments
```
POST   /payments/intent              (create Stripe payment intent)
POST   /payments/webhook             (Stripe webhook — no auth)
GET    /payments/methods             (player's saved cards)
DELETE /payments/methods/:id
```

### Notifications
```
GET    /notifications
PATCH  /notifications/:id/read
PATCH  /notifications/read-all
GET    /notifications/preferences
PATCH  /notifications/preferences
```

### Admin (all require ADMIN role)
```
GET    /admin/companies?status=
PATCH  /admin/companies/:id/status
GET    /admin/users
PATCH  /admin/users/:id
GET    /admin/disputes
PATCH  /admin/disputes/:id/resolve
GET    /admin/reviews/flagged
PATCH  /admin/reviews/:id/moderate
```

---

## 15. Edge Cases & Business Rules

### Booking conflicts
- Slot availability checked at payment intent creation AND at payment confirmation (double-check)
- If slot becomes unavailable between intent creation and payment: payment fails gracefully, player informed, returned to slot picker
- Concurrent booking attempts for same slot: first to confirm payment wins; second gets conflict error

### Shirt inventory conflicts
- Shirt quantities checked at booking creation
- If not enough shirts: warning shown to player but booking still allowed without shirts (player chooses)
- Manager is responsible for accurate inventory count

### Pitch deactivated after booking
- Existing bookings remain valid and active
- Players are notified if the pitch is permanently closed (manager cancels all future bookings → full refunds)

### Manager account suspended
- All future bookings auto-cancelled with full refund to players
- Players notified

### Player account suspended
- Active bookings: cancelled with full refund (suspension is exceptional — admin decision)
- No new bookings possible

### Daylight saving time
- All times stored in UTC in DB
- Displayed in user's local timezone (frontend handles conversion)

### Booking that spans midnight
- Not allowed. A booking must start and end within the same calendar day.

### Player is also a manager
- Single account, role = MANAGER
- Manager can book other companies' pitches as a player
- Manager cannot book their own company's pitches (conflict of interest — enforce in API)

### Refund failures
- If Stripe refund fails: logged as error, admin alerted, manual resolution
- Player informed: "Your refund is being processed manually, expect 5–10 days"

### Rating with no text
- Allowed (text is optional)
- A 1-star rating with no text still counts

### Zero reviews pitch
- "Not yet rated" shown instead of score
- No star display until ≥ 3 reviews

### Working hours edge: pitch has no available slots today
- Today greyed out in calendar but future days still accessible

### Very long company names / descriptions
- Names truncated with ellipsis in cards, full in detail view
- Descriptions truncated at 4 lines in detail view with "Show more" toggle

---

## 16. Open Questions

| # | Question | Default assumption | Needs decision by |
|---|---|---|---|
| 1 | Multi-currency support? (RON only at launch?) | RON only for v1.0 | Before launch |
| 2 | Should managers be able to accept booking manually (confirmation required)? | Auto-confirm at v1.0 | Before pitch editor build |
| 3 | Should players be able to split payment with friends? | No, single payer in v1.0 | v1.1 backlog |
| 4 | Referee booking add-on (if pitch has referee amenity)? | Not in v1.0 | v1.1 backlog |
| 5 | App name final decision | "PitchUp" working title | Before any branding assets |
| 6 | Should player names be shown in booked slots to other players? | No — only show slot as "Booked" | Privacy call needed |
| 7 | Admin approval of companies: auto or manual? | Manual at launch (simple) | Before manager onboarding build |
| 8 | Minimum trust score to leave a review? | No minimum (completed booking is enough) | Before review system build |
| 9 | Dispute resolution SLA (48h target realistic)? | 48h for v1.0 (manual admin) | Before penalty system build |
| 10 | Shirt colours: predefined list or custom hex? | Predefined list (8–12 colours) | Before shirt inventory build |
