#!/usr/bin/env bash
# e09.sh — create all E09 Manager: Onboarding issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E09 — Manager: Onboarding")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E09 — Manager: Onboarding' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E09 — Manager: Onboarding)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E09-01 — Backend: POST /onboarding/company — Step 1 company creation
# ─────────────────────────────────────────────────────────────────────────────
title="[E09-01] [Backend] POST /onboarding/company — Step 1: create company record (info + logo)"
read -r -d '' body << 'BODY' || true
## Summary
Create the Company record from Step 1 of the manager onboarding wizard. Associates company with the authenticated MANAGER user. Company starts in DRAFT status. Logo already uploaded via Cloudinary signed URL before this call.

## Reference
- PRD §8.1 Step 1

## File to create
`apps/web/src/app/api/v1/onboarding/company/route.ts` — POST

## Schema
```typescript
// packages/shared/src/schemas/onboarding.ts
export const CompanyInfoSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().refine(u => u.startsWith('https://res.cloudinary.com/'), 'Must be Cloudinary URL'),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  facebookUrl: z.string().url().optional().or(z.literal('')),
  instagramUrl: z.string().url().optional().or(z.literal('')),
});
```

## Logic
```typescript
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (user.role !== 'MANAGER') return err('FORBIDDEN', 'Manager role required', 403);

  // Prevent duplicate: manager cannot create a second company in v1
  const existing = await prisma.company.findFirst({ where: { managerId: user.id } });
  if (existing) return err('COMPANY_EXISTS', 'You already have a company', 409);

  const body = await validateBody(req, CompanyInfoSchema);

  const company = await prisma.company.create({
    data: {
      ...body,
      managerId: user.id,
      status: 'DRAFT',
    },
    select: { id: true, name: true, status: true },
  });

  return ok(company, 201);
}
```

## PUT /onboarding/company (update Step 1 if returning)
```typescript
// Same schema, finds company by managerId, updates fields
// Allowed only while status is DRAFT or PENDING_APPROVAL
```

## Acceptance criteria
- [ ] Requires auth + MANAGER role (403 if PLAYER)
- [ ] One company per manager — 409 if already exists
- [ ] `status: DRAFT` on creation
- [ ] logoUrl validated as Cloudinary domain
- [ ] Optional fields accept empty string (normalised to null in DB)
- [ ] Returns company id for subsequent onboarding steps

## Definition of done
- PLAYER calling this endpoint gets 403 (not 500)
- `managerId` stored as `@unique` on Company model (enforced at DB level)
BODY

create_issue "$title" "$body" '["E09 — Manager: Onboarding","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E09-02 — Backend: PUT /onboarding/location — Step 2 geocoding + map pin
# ─────────────────────────────────────────────────────────────────────────────
title="[E09-02] [Backend] PUT /onboarding/location — Step 2: address, geocoding, lat/lng storage"
read -r -d '' body << 'BODY' || true
## Summary
Update company with location data. Server-side geocoding via Google Maps Geocoding API converts address to lat/lng. Manager can override with manually adjusted coordinates.

## File to create
`apps/web/src/app/api/v1/onboarding/location/route.ts` — PUT

## Schema
```typescript
export const CompanyLocationSchema = z.object({
  addressLine1: z.string().min(5).max(100),
  addressLine2: z.string().max(100).optional(),
  city: z.string().refine(c => CITIES.includes(c), 'City not supported'),
  county: z.string().max(60),
  country: z.string().default('Romania'),
  postalCode: z.string().min(4).max(10),
  lat: z.number().min(-90).max(90).optional(),   // manual override
  lng: z.number().min(-180).max(180).optional(),  // manual override
});
```

## Geocoding logic
```typescript
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results[0]) return null;
  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

// If lat/lng provided in body (manual drag) → use those directly, skip geocoding
// Else → geocode `${addressLine1}, ${city}, ${country}`
// If geocoding fails → return { geocoded: false } with 200, store address only (no lat/lng)
```

## Response
```json
{
  "data": {
    "id": "...",
    "lat": 46.77,
    "lng": 23.59,
    "geocoded": true
  }
}
```

## Acceptance criteria
- [ ] Requires auth + owns company (403 otherwise)
- [ ] City validated against CITIES list
- [ ] If manual lat/lng provided: skip geocoding, store directly
- [ ] If no manual coords: call Google Geocoding API
- [ ] Geocoding failure: store address without coords, return `geocoded: false` (not an error)
- [ ] `GOOGLE_MAPS_API_KEY` server-only env var (never exposed to client)
- [ ] Company status stays DRAFT after this step

## Security
- `GOOGLE_MAPS_API_KEY` restricted to server-side Geocoding API only (set in Google Cloud Console)
- Never log full geocoding response (may contain sensitive address data)

## Definition of done
- Test with real Romanian addresses (Cluj-Napoca, Bucharest, Timișoara)
- Manual override tested: dragging map pin in Step 2 UI sends lat/lng → skips geocode
BODY

create_issue "$title" "$body" '["E09 — Manager: Onboarding","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E09-03 — Backend: PUT /onboarding/contact-hours — Step 3
# ─────────────────────────────────────────────────────────────────────────────
title="[E09-03] [Backend] PUT /onboarding/contact-hours — Step 3: phone, email, working hours per day"
read -r -d '' body << 'BODY' || true
## Summary
Store public contact info and per-day working hours for the company. Working hours stored as a JSON column on Company (one object keyed by day 0–6).

## File to create
`apps/web/src/app/api/v1/onboarding/contact-hours/route.ts` — PUT

## Schema
```typescript
const DayHoursSchema = z.discriminatedUnion('closed', [
  z.object({ closed: z.literal(true) }),
  z.object({ closed: z.literal(false), open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }),
]);

export const ContactHoursSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  email: z.string().email().max(100),
  workingHours: z.record(z.enum(['0','1','2','3','4','5','6']), DayHoursSchema),
});
```

## Validation rules
- All 7 days (0=Sunday, 1=Monday … 6=Saturday) must be present in `workingHours`
- If not closed: `open < close` (e.g. "08:00" < "23:00") — string comparison works for HH:MM format
- Minimum 1 non-closed day per week

## Logic
```typescript
// Find company by managerId
// Validate workingHours completeness + time ordering
// Update company: phone, email, workingHours (JSON)
// Company status remains DRAFT
```

## Response
```json
{ "data": { "id": "...", "phone": "+40712345678", "email": "contact@demo.ro" } }
```

## Acceptance criteria
- [ ] Requires auth + owns company
- [ ] All 7 days required in workingHours — 422 if any missing
- [ ] open < close validated — 422 if close ≤ open
- [ ] At least 1 open day — 422 if all closed
- [ ] Phone E.164 format validated
- [ ] Email validated
- [ ] Company status stays DRAFT after this step

## Definition of done
- `workingHours` stored as `Json` type in Prisma schema (not separate table)
- JSON shape validated at insert time with Zod (not just at API level)
BODY

create_issue "$title" "$body" '["E09 — Manager: Onboarding","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E09-04 — Backend: POST /onboarding/stripe-connect — Step 4
# ─────────────────────────────────────────────────────────────────────────────
title="[E09-04] [Backend] POST /onboarding/stripe-connect — Stripe Connect account + onboarding link"
read -r -d '' body << 'BODY' || true
## Summary
Create a Stripe Express account for the company and return an onboarding link. Manager is redirected there to complete identity verification. On return, company status → PENDING_APPROVAL.

## Reference
- PRD §8.1 Step 4, §8.6

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/onboarding/stripe-connect/route.ts` | Create — POST |
| `apps/web/src/app/api/v1/onboarding/stripe-connect/return/route.ts` | Create — GET (Stripe return URL) |

## POST /onboarding/stripe-connect
```typescript
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  const company = await getManagerCompany(user.id);
  if (!company) return err('NOT_FOUND', 'Company not found', 404);

  // Create Stripe Express account if not already created
  let stripeAccountId = company.stripeAccountId;
  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'RO',
      email: user.email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { companyId: company.id, managerId: user.id },
    });
    stripeAccountId = account.id;
    await prisma.company.update({ where: { id: company.id }, data: { stripeAccountId } });
  }

  // Create onboarding link
  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/stripe-connect?refresh=1`,
    return_url:  `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/onboarding/stripe-connect/return?companyId=${company.id}`,
    type: 'account_onboarding',
  });

  return ok({ url: link.url });
}
```

## GET /onboarding/stripe-connect/return (Stripe redirect-back)
```typescript
// Stripe redirects here after manager completes (or abandons) onboarding
// 1. Retrieve Stripe account: stripe.accounts.retrieve(company.stripeAccountId)
// 2. Check account.details_submitted
// 3. If true: update company.status = PENDING_APPROVAL, company.chargesEnabled, company.payoutsEnabled
// 4. Create admin Notification: "New company pending approval: {company.name}"
// 5. Redirect to /onboarding/pending (the "under review" page)
// 6. If not submitted (abandoned): redirect back to /onboarding/step/4
```

## Acceptance criteria
- [ ] Requires auth + MANAGER role
- [ ] Creates Stripe Express account on first call, reuses on subsequent calls
- [ ] Returns `url` for redirect to Stripe hosted onboarding
- [ ] Return URL handler: company.status → PENDING_APPROVAL if details_submitted
- [ ] Return URL handler: admin notification created
- [ ] `stripeAccountId` stored on Company immediately after account creation

## Security
- `STRIPE_SECRET_KEY` server-only
- Return URL validated: `companyId` from query param verified against session's company (prevent IDOR)

## Edge cases
- Manager closes Stripe tab without completing → Stripe redirects to `refresh_url` → frontend shows "Resume Stripe setup" button → POST creates new accountLink (same account)
- Stripe account already has details_submitted (refresh scenario): skip PENDING_APPROVAL transition if already set

## Definition of done
- Stripe test mode: complete Express onboarding with test SSN 000-00-0000 (US test) → company status changes
- Admin notification verified in DB after return
BODY

create_issue "$title" "$body" '["E09 — Manager: Onboarding","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E09-05 — Backend: GET /onboarding/status + manager dashboard guard
# ─────────────────────────────────────────────────────────────────────────────
title="[E09-05] [Backend] GET /onboarding/status + manager middleware guard (redirect by company status)"
read -r -d '' body << 'BODY' || true
## Summary
Endpoint returning current onboarding status and completed steps. Used by wizard to restore progress. Next.js middleware guards manager dashboard routes — redirects to onboarding if company not ACTIVE.

## Files to create / modify
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/onboarding/status/route.ts` | Create |
| `apps/web/src/middleware.ts` | Modify — add manager dashboard guard |

## GET /onboarding/status
```typescript
// requireAuth + MANAGER role
// Returns:
{
  "data": {
    "companyId": "clxyz...",          // null if no company yet
    "companyStatus": "DRAFT",         // DRAFT | PENDING_APPROVAL | ACTIVE | SUSPENDED | null
    "completedSteps": ["info", "location", "contact-hours"],
    "stripeConnected": false,
    "currentStep": 4                  // next step to complete (1–4), null if all done
  }
}
```

## Step completion logic
```typescript
function deriveCompletedSteps(company: Company | null): string[] {
  if (!company) return [];
  const steps: string[] = [];
  if (company.name && company.logoUrl) steps.push('info');
  if (company.lat && company.lng) steps.push('location');
  if (company.phone && company.email && company.workingHours) steps.push('contact-hours');
  if (company.stripeAccountId) steps.push('stripe');
  return steps;
}
```

## Middleware guard (apps/web/src/middleware.ts)
```typescript
// Routes starting with /manager/* require:
// 1. Active session with role MANAGER
// 2. company.status === 'ACTIVE'
// If no company or status !== ACTIVE:
//   → DRAFT / incomplete: redirect /onboarding/step/{nextStep}
//   → PENDING_APPROVAL: redirect /onboarding/pending
//   → SUSPENDED: redirect /manager/suspended
// If not MANAGER role: redirect /
```

## Acceptance criteria
- [ ] GET requires MANAGER role
- [ ] Returns correct completedSteps based on company data presence
- [ ] `currentStep` = first incomplete step (1–4), null if Stripe done
- [ ] Middleware redirects DRAFT manager from /manager/* to correct onboarding step
- [ ] Middleware redirects PENDING_APPROVAL manager to /onboarding/pending
- [ ] ACTIVE manager: no redirect (full dashboard access)
- [ ] Non-manager accessing /manager/*: redirect to /

## Definition of done
- All 4 middleware states tested (no company, DRAFT, PENDING_APPROVAL, SUSPENDED)
- GET /onboarding/status accurately reflects each wizard step state
BODY

create_issue "$title" "$body" '["E09 — Manager: Onboarding","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E09-06 — Web: Onboarding Step 1 — Company Info form
# ─────────────────────────────────────────────────────────────────────────────
title="[E09-06] [Web] Onboarding Step 1 — Company info form (name, description, logo upload, socials)"
read -r -d '' body << 'BODY' || true
## Summary
First step of the manager onboarding wizard. Form for company name, description, logo (drag-and-drop Cloudinary upload), optional website and social links.

## Reference
- PRD §8.1 Step 1
- UIUX_SPEC §12.2

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/onboarding/layout.tsx` | Create — wizard shell (progress, step nav) |
| `apps/web/src/app/onboarding/step/1/page.tsx` | Create |
| `apps/web/src/components/onboarding/StepProgress.tsx` | Create |
| `apps/web/src/components/onboarding/LogoUploadZone.tsx` | Create |

## Wizard layout
- Max 640px centred, white bg, 48px vertical padding
- StepProgress: 4 connected step dots + labels ("Company info" | "Location" | "Contact & Hours" | "Payments")
  - Active dot: primary-600 filled circle; completed: primary-600 with check; future: neutral-200
- Each step page handles its own "Next" button

## Step 1 form fields
- Company name: `<input>` max 80 chars + counter "XX / 80"
- Description: `<textarea>` max 500 chars + counter, min-height 100px
- Logo: LogoUploadZone component
- Website URL: `<input type="url">` optional, placeholder "https://yourclub.ro"
- Social links section:
  - Facebook: `<input>` optional, placeholder "https://facebook.com/yourclub"
  - Instagram: `<input>` optional, placeholder "https://instagram.com/yourclub"

## LogoUploadZone spec
- Dashed border 2px neutral-200, radius-md, 160×160px centred
- Default: upload-cloud icon (32px neutral-300) + "Drag logo here or click to upload" body-sm neutral-500
- Accepts: JPEG, PNG — max 2MB — min 200×200px (validated after pick)
- On file select: validate dimensions client-side (create HTMLImageElement, check naturalWidth/Height)
- Upload: POST /api/v1/upload/sign?folder=logos → Cloudinary direct upload → preview in zone
- Uploaded: show preview (cover-fit), remove X button top-right
- Error states: "File too large (max 2MB)" | "Image too small (min 200×200px)" | "Upload failed, try again"

## Form submission
```typescript
// react-hook-form + Zod (CompanyInfoSchema from packages/shared)
// On submit: POST /api/v1/onboarding/company (or PUT if returning)
// On success: router.push('/onboarding/step/2')
// Save companyId to sessionStorage (or URL param) for subsequent steps
```

## Resume support
- On page load: GET /onboarding/status → if step 1 already done → pre-fill form + redirect to next step if manager returns

## Acceptance criteria
- [ ] Logo drag-and-drop works (DragEvent handlers)
- [ ] Click-to-upload also works (hidden file input)
- [ ] Dimension validation client-side before upload
- [ ] Logo preview shown after successful upload
- [ ] Name max 80 chars enforced with live counter
- [ ] Description max 500 chars enforced
- [ ] Form validates on submit (Zod)
- [ ] On success: navigate to step 2
- [ ] StepProgress shows step 1 as active

## Definition of done
- Logo upload tested: 200×200 minimum enforced (99×99 rejected client-side)
- Drag-and-drop tested in Chrome, Firefox, Safari
BODY

create_issue "$title" "$body" '["E09 — Manager: Onboarding","type: feature","platform: web","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E09-07 — Web: Onboarding Step 2 — Location + Google Maps pin
# ─────────────────────────────────────────────────────────────────────────────
title="[E09-07] [Web] Onboarding Step 2 — Location form with Google Maps geocoding and draggable pin"
read -r -d '' body << 'BODY' || true
## Summary
Step 2 of onboarding wizard. Address form + embedded Google Maps for visual pin confirmation. Auto-geocodes after address entry. Manager can drag pin to correct location.

## Reference
- PRD §8.1 Step 2

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/onboarding/step/2/page.tsx` | Create |
| `apps/web/src/components/onboarding/AddressMapPicker.tsx` | Create — Google Maps embed |

## Address form fields (2-column grid on desktop, 1-column on mobile)
- Address line 1 (full width): `<input>` min 5 chars, max 100
- Address line 2 (full width, optional)
- City (left): `<select>` from CITIES list
- Postal code (right): `<input>` max 10 chars
- County (left): `<input>` max 60 chars
- Country (right): `<input>` default "Romania", read-only in v1

## AddressMapPicker
- Embeds `@react-google-maps/api` `<GoogleMap>` component
- Map: 100% width, 300px height, radius-md
- After address form is complete: auto-geocode (debounced 800ms after last field change)
  - Show map centred on geocoded coords
  - Draggable `<Marker>` at geocoded position
  - Geocoding indicator: spinner inside "Locating address..." label-sm neutral-500
- If geocoding fails: show "Could not locate address — please drag pin manually"
- On marker drag: update local lat/lng state → sent with form submission

```typescript
// Client-side geocoding via Google Maps Geocoding API
// (separate from server-side geocoding in E09-02)
// Use: new google.maps.Geocoder().geocode({ address }) → get lat/lng for map preview
// On submit: send manual lat/lng from dragged pin (overrides server geocoding)
```

## Form submission
```typescript
// PUT /api/v1/onboarding/location with { address fields + lat + lng }
// On success: router.push('/onboarding/step/3')
```

## Acceptance criteria
- [ ] All address fields render correctly
- [ ] City dropdown populated from CITIES constant
- [ ] Geocoding fires after 800ms debounce on address change
- [ ] Map shown after geocoding, centred on result
- [ ] Marker draggable — drag updates coordinates
- [ ] Coordinates sent to backend on form submit
- [ ] Geocoding error: map shows Romania centred, "drag pin manually" message
- [ ] StepProgress shows step 2 active, step 1 complete

## Definition of done
- `@react-google-maps/api` package installed
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.example` (restricted to Maps JS API)
- Map visible on real addresses (test: "Str. Sportului 1, Cluj-Napoca")
BODY

create_issue "$title" "$body" '["E09 — Manager: Onboarding","type: feature","platform: web","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E09-08 — Web: Onboarding Step 3 — Contact & Working Hours
# ─────────────────────────────────────────────────────────────────────────────
title="[E09-08] [Web] Onboarding Step 3 — Contact info + working hours grid (per-day open/close/closed)"
read -r -d '' body << 'BODY' || true
## Summary
Step 3: public phone + email + per-day working hours. 7-row grid (Mon–Sun) with closed toggle, time-range pickers per day. "Copy to all" shortcut.

## Reference
- PRD §8.1 Step 3
- UIUX_SPEC §14.2 Availability tab (same pattern)

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/onboarding/step/3/page.tsx` | Create |
| `apps/web/src/components/onboarding/WorkingHoursGrid.tsx` | Create |

## Contact fields
- Phone: `<input type="tel">` + E.164 format hint "+ country code"
- Email: `<input type="email">`

## WorkingHoursGrid spec
- 7 rows (Mon–Sun order displayed; stored as 0=Sun … 6=Sat internally)
- Each row:
  - Day label: "Monday" — label-md neutral-700, 80px wide
  - "Closed" toggle Switch — when on: row greys out, time pickers hidden (LayoutAnimation-like CSS transition)
  - Open time picker: `<select>` or `<input type="time">` — 30-min increments 00:00–23:30
  - "–" separator label
  - Close time picker: same, must be > open time (validated client-side inline)
  - Inline error: "Close must be after open" — body-sm error-500

## "Copy to all" shortcut
- After setting Monday hours: "Copy Mon hours to all days" — text-sm primary-600 button
- Copies open/close to all non-closed days

## Default suggestion
- Mon–Fri: 08:00–23:00 pre-filled (manager can adjust)
- Sat–Sun: 08:00–22:00 pre-filled

## Form submission
```typescript
// PUT /api/v1/onboarding/contact-hours
// workingHours format: { "0": { closed: true }, "1": { closed: false, open: "08:00", close: "23:00" }, ... }
// On success: router.push('/onboarding/step/4')
```

## Acceptance criteria
- [ ] 7 rows rendered Mon–Sun
- [ ] Closed toggle hides time pickers for that day
- [ ] "Close before open" shows inline error, blocks submit
- [ ] At least 1 open day required (backend validates too)
- [ ] "Copy Mon to all" copies times to all non-closed days
- [ ] Defaults pre-filled correctly
- [ ] Phone E.164 validated (not empty, includes country code)
- [ ] Submit → step 4

## Definition of done
- Time picker works on Firefox (native `<input type="time">` supported in modern browsers)
- Backend validates same rules as client — test mismatched close/open via curl
BODY

create_issue "$title" "$body" '["E09 — Manager: Onboarding","type: feature","platform: web","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E09-09 — Web: Onboarding Step 4 — Stripe Connect + return + pending page
# ─────────────────────────────────────────────────────────────────────────────
title="[E09-09] [Web] Onboarding Step 4 — Stripe Connect redirect, return handling, pending review screen"
read -r -d '' body << 'BODY' || true
## Summary
Step 4 UI: explain Stripe Connect, button to start, redirect to Stripe hosted onboarding. Return URL handler page. "Under review" screen shown after Stripe completion. Admin approval → ACTIVE notification.

## Reference
- PRD §8.1 Step 4, §8.6

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/onboarding/step/4/page.tsx` | Create — Stripe intro + start |
| `apps/web/src/app/onboarding/pending/page.tsx` | Create — under review screen |
| `apps/web/src/app/onboarding/stripe-connect/refresh/page.tsx` | Create — refresh URL page |

## Step 4 page spec
- Header: "Set up payouts" — heading-xl
- Explanation card (info-50 bg, info-500 left border):
  - "PitchUp uses Stripe to process payments and pay you out."
  - "You'll need to provide your business details and bank account."
  - "This is handled securely by Stripe — PitchUp never sees your bank info."
- Feature list (check-circle primary-600 per bullet):
  - "Receive payments directly from bookings"
  - "Automatic payouts after each completed booking"
  - "Secure identity verification by Stripe"
- "Connect with Stripe" — primary button, full width, Stripe logo inline
  - On click: POST /api/v1/onboarding/stripe-connect → redirect to returned URL

## Pending page `/onboarding/pending`
- Illustrated waiting state (clock or hourglass SVG, 80px primary-600)
- "Your company is under review" — heading-xl, centred
- "We'll notify you by email once your account is approved. This usually takes 1–2 business days." — body-md neutral-500, centred
- Company name shown: "Demo Sports Club is pending approval."
- "While you wait:" section:
  - "Add your pitches (you can set them up now — they'll go live when approved)" → link to `/manager/pitches`
    - Note: manager can access pitch setup even while PENDING_APPROVAL (partial dashboard access)
- "Need help?" → contact support email link

## Stripe refresh page `/onboarding/stripe-connect/refresh`
- Shown when manager abandons Stripe onboarding and Stripe redirects to refresh_url
- "Let's finish setting up payouts" — heading-xl
- "Your Stripe account was created but setup isn't complete." — body-md
- "Resume Stripe setup" — primary button → POST /api/v1/onboarding/stripe-connect (reuses existing account, generates new link)

## Post-approval flow (triggered by E15 admin panel)
1. Admin approves company (E15)
2. company.status → ACTIVE
3. Resend email sent to manager: "🎉 Your company is approved! Start listing pitches."
4. Next time manager visits /onboarding/pending → middleware redirects to /manager/overview

## Acceptance criteria
- [ ] "Connect with Stripe" button calls API → redirects to Stripe URL
- [ ] Stripe return URL (E09-04 backend) correctly sets PENDING_APPROVAL
- [ ] Pending page shows company name
- [ ] Pitch setup link accessible from pending page
- [ ] Refresh page shows "Resume" button that generates new Stripe link
- [ ] After admin approval (manual DB update for testing): middleware redirects pending manager to dashboard

## Definition of done
- Stripe test mode: full flow works with test SSN 000-00-0000
- Stripe test: use `account_onboarding` type (not `account_update`)
BODY

create_issue "$title" "$body" '["E09 — Manager: Onboarding","type: feature","platform: web","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E09-10 — Web: Manager dashboard layout + overview page
# ─────────────────────────────────────────────────────────────────────────────
title="[E09-10] [Web] Manager dashboard layout — sidebar nav, top bar, responsive, overview page shell"
read -r -d '' body << 'BODY' || true
## Summary
Build the manager dashboard shell: dark sidebar (240px), top bar (64px), responsive collapsing (tablet: 64px icon-only, mobile: hidden + hamburger). Overview page with 4 stat cards and upcoming bookings table skeleton.

## Reference
- UIUX_SPEC §11 (Global Layout Rules), §13.1 (Overview page)

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/manager/layout.tsx` | Create — sidebar + top bar shell |
| `apps/web/src/app/manager/overview/page.tsx` | Create — stats + upcoming table |
| `apps/web/src/components/manager/Sidebar.tsx` | Create |
| `apps/web/src/components/manager/TopBar.tsx` | Create |
| `apps/web/src/components/manager/StatCard.tsx` | Create |

## Sidebar spec (UIUX_SPEC §11.1)
- Width: 240px desktop / 64px tablet (icon only) / hidden mobile
- Background: neutral-900
- Logo: "PitchUp" white wordmark, 24px padding top
- Nav items (40px height, 8px 12px padding, radius-sm):
  - Icon 20px neutral-400 | Label label-lg neutral-400
  - Hover: neutral-800 bg
  - Active: primary-600 bg, white icon + text
  - 4px gap between items
- Sections:
  ```
  Overview        (home)
  Calendar        (calendar)
  Bookings        (format-list-bulleted)
  ─── Manage ───  (section label: label-xs neutral-500 uppercase, 8px padding)
  Pitches         (football)
  Reviews         (star)
  ─── Business ───
  Analytics       (chart-bar)
  ─── Account ───
  Settings        (cog)
  ```
- Bottom: avatar (32px) + name (label-md white) + "Manager" chip (primary-100 bg primary-700 text)
- Collapse toggle: chevron-left / chevron-right at very bottom (desktop only)

## TopBar spec (UIUX_SPEC §11.2)
- Height: 64px, white bg, 1px neutral-200 bottom border
- Left: hamburger icon (mobile only, 44×44px) + page title (heading-md neutral-900)
- Right: notification bell (with badge if unread) + avatar dropdown (profile / logout)

## Responsive breakpoints (UIUX_SPEC §11.4)
- `< 768px`: no sidebar, hamburger opens slide-over drawer
- `768–1024px`: sidebar collapsed to 64px (icon only, no label), no toggle shown
- `> 1024px`: full 240px sidebar with collapse toggle

## Overview page — 4 stat cards
Data from `GET /api/v1/manager/stats/today` (create endpoint):
- Revenue today (RON) — primary-600 icon
- Bookings today (count) — accent-500 icon
- Occupancy rate (%) — info-500 icon
- No-shows this week (count) — warning-500 icon

StatCard spec: white bg, shadow-sm, radius-md, 20px padding
- Icon: 32px coloured
- Value: display-md neutral-900
- Label: body-md neutral-500
- Delta badge: "+12% vs last week" — success-500 or error-500, body-sm

## Overview page — upcoming bookings table
- "Next 10 bookings" — heading-md
- Table: white bg, shadow-sm, radius-md
- Header: neutral-50 bg, label-md neutral-500 uppercase (Time | Pitch | Player | Status | Actions)
- Row height 56px
- "Details" link → booking detail page
- Empty: "No upcoming bookings" centred in table body

## Backend: GET /api/v1/manager/stats/today
```typescript
// requireAuth + MANAGER role + active company
// Returns: revenueToday, bookingsToday, occupancyRate, noShowsThisWeek
// occupancyRate = confirmed booking hours / total available hours today across all pitches
```

## Acceptance criteria
- [ ] Sidebar renders all nav items with correct icons
- [ ] Active item highlighted per current route (use `usePathname`)
- [ ] Sidebar collapses to icon-only on tablet
- [ ] Mobile: sidebar hidden, hamburger shows slide-over drawer
- [ ] Collapse toggle (desktop) persists state in localStorage
- [ ] TopBar shows correct page title
- [ ] Notification bell badge shows unread count
- [ ] Overview 4 stat cards load data from API
- [ ] Upcoming bookings table renders (or empty state)
- [ ] Middleware (E09-05) redirects non-ACTIVE managers before reaching this page

## Definition of done
- Sidebar tested at all 3 breakpoints (browser devtools resize)
- Page title updates correctly when navigating between dashboard sections
- `position: sticky` sidebar stays fixed during main content scroll
BODY

create_issue "$title" "$body" '["E09 — Manager: Onboarding","type: feature","platform: web","priority: high"]' "$MILESTONE"

echo "✓ E09 — 10 issues created"
