#!/usr/bin/env bash
# e10.sh — create all E10 Manager: Pitch Mgmt issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E10 — Manager: Pitch Mgmt")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E10 — Manager: Pitch Mgmt' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E10 — Manager: Pitch Mgmt)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E10-01 — Backend: POST /pitches + PUT /pitches/:id — basic info CRUD
# ─────────────────────────────────────────────────────────────────────────────
title="[E10-01] [Backend] POST /pitches + PUT /pitches/:id — create and update pitch basic info"
read -r -d '' body << 'BODY' || true
## Summary
Create a new pitch and update its basic info. Only the manager who owns the company can manage its pitches. Pitch starts inactive (hidden from players until manager activates).

## Reference
- PRD §8.2 Tab 1

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/pitches/route.ts` | Create — POST |
| `apps/web/src/app/api/v1/pitches/[id]/route.ts` | Create — GET, PUT, DELETE (stubs for other handlers) |
| `apps/web/src/lib/managerGuard.ts` | Create — `requireManagerOwnsPitch()` helper |

## Schema
```typescript
// packages/shared/src/schemas/pitch.ts
export const PitchBasicInfoSchema = z.object({
  name: z.string().min(2).max(60),
  surfaceType: z.enum(['NATURAL_GRASS', 'ARTIFICIAL_GRASS', 'FUTSAL']),
  size: z.enum(['FIVE_A_SIDE', 'SEVEN_A_SIDE', 'ELEVEN_A_SIDE', 'CUSTOM']),
  widthMeters: z.number().positive().optional(),
  lengthMeters: z.number().positive().optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional().default(false),
});
```

## Default dimensions by size
```typescript
const DEFAULT_DIMENSIONS: Record<string, { width: number; length: number }> = {
  FIVE_A_SIDE:    { width: 25, length: 42 },
  SEVEN_A_SIDE:   { width: 40, length: 60 },
  ELEVEN_A_SIDE:  { width: 68, length: 105 },
};
// If size !== CUSTOM and no dimensions provided: auto-fill from table
// If size === CUSTOM: widthMeters + lengthMeters both required
```

## POST /pitches logic
```typescript
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  const company = await getActiveManagerCompany(user.id);
  if (!company) return err('NO_COMPANY', 'No active company found', 403);

  const body = await validateBody(req, PitchBasicInfoSchema);

  if (body.size === 'CUSTOM' && (!body.widthMeters || !body.lengthMeters)) {
    return err('DIMENSIONS_REQUIRED', 'Custom size requires width and length', 422);
  }

  const dims = body.size !== 'CUSTOM'
    ? DEFAULT_DIMENSIONS[body.size]
    : { width: body.widthMeters!, length: body.lengthMeters! };

  const pitch = await prisma.pitch.create({
    data: {
      companyId: company.id,
      name: body.name,
      surfaceType: body.surfaceType,
      size: body.size,
      widthMeters: dims.width,
      lengthMeters: dims.length,
      description: body.description ?? null,
      isActive: false,  // always starts inactive
    },
    select: { id: true, name: true, isActive: true },
  });

  return ok(pitch, 201);
}
```

## requireManagerOwnsPitch helper
```typescript
// lib/managerGuard.ts
export async function requireManagerOwnsPitch(userId: string, pitchId: string) {
  const pitch = await prisma.pitch.findFirst({
    where: { id: pitchId, company: { managerId: userId } },
    include: { company: true },
  });
  if (!pitch) throw new ApiError('FORBIDDEN', 'Pitch not found or not yours', 403);
  return pitch;
}
```

## Acceptance criteria
- [ ] Requires auth + MANAGER role
- [ ] Company must be ACTIVE (not DRAFT / PENDING_APPROVAL) to create pitches
  - Exception: PENDING_APPROVAL managers can pre-create pitches (they go live on approval)
- [ ] Pitch always created with `isActive: false`
- [ ] Custom size: width + length required — 422 if missing
- [ ] Standard size: dimensions auto-filled if not provided
- [ ] PUT: only updates provided fields (partial); manager must own pitch
- [ ] `requireManagerOwnsPitch` reused across all pitch sub-endpoints

## Edge cases
- Manager with PENDING_APPROVAL status: can create pitches (pre-setup); pitches auto-activate when company approved
- Deleting all pitches of ACTIVE company: allowed (company stays ACTIVE with 0 pitches)

## Definition of done
- `managerId` ownership verified through Company join (not direct on Pitch model)
- Default dimensions match common Romanian football pitch standards
BODY

create_issue "$title" "$body" '["E10 — Manager: Pitch Mgmt","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E10-02 — Backend: Photo management (upload, reorder, delete)
# ─────────────────────────────────────────────────────────────────────────────
title="[E10-02] [Backend] Pitch photo management — upload (Cloudinary), reorder, delete, cover photo"
read -r -d '' body << 'BODY' || true
## Summary
Manage up to 10 photos per pitch. Photos uploaded to Cloudinary via signed URL (E01-10). Backend stores URLs and `order` field. Reorder via drag-and-drop sends new order array. First photo (order=0) is the cover.

## Reference
- PRD §8.2 Tab 2

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/pitches/[id]/photos/route.ts` | Create — POST (add), GET (list) |
| `apps/web/src/app/api/v1/pitches/[id]/photos/reorder/route.ts` | Create — PUT |
| `apps/web/src/app/api/v1/pitches/[id]/photos/[photoId]/route.ts` | Create — DELETE |

## POST /pitches/:id/photos — add photo
```typescript
const AddPhotoSchema = z.object({
  url: z.string().url().refine(u => u.startsWith('https://res.cloudinary.com/'), 'Cloudinary URL required'),
  cloudinaryPublicId: z.string(),  // for deletion later
});

// requireManagerOwnsPitch
// Count existing photos — reject if already 10: err('PHOTO_LIMIT', 'Maximum 10 photos', 400)
// Create PitchPhoto: { pitchId, url, cloudinaryPublicId, order: existingCount }
// Return created photo
```

## PUT /pitches/:id/photos/reorder
```typescript
const ReorderSchema = z.object({
  photoIds: z.array(z.string().cuid()),  // new order — all existing photo IDs, reordered
});

// requireManagerOwnsPitch
// Validate: photoIds length === existing photos count, all IDs belong to this pitch
// Update each: photo.order = photoIds.indexOf(photo.id)
// Prisma $transaction: multiple updates atomically
```

## DELETE /pitches/:id/photos/:photoId
```typescript
// requireManagerOwnsPitch
// Delete from Cloudinary: deleteImage(photo.cloudinaryPublicId) from E01-10
// Delete PitchPhoto row
// Re-sequence remaining photos: order 0,1,2...N-1
```

## GET /pitches/:id/photos
```typescript
// requireManagerOwnsPitch (manager view) or public (player view in E04-02)
// Returns photos ordered by order ASC
// For manager: includes cloudinaryPublicId (needed for deletion)
// For player (no auth or PLAYER role): omit cloudinaryPublicId
```

## Acceptance criteria
- [ ] Max 10 photos enforced at API level (not just client)
- [ ] Photo URL must be Cloudinary domain
- [ ] Reorder: validates all IDs belong to this pitch (prevents cross-pitch injection)
- [ ] Reorder: atomic (all or nothing — use transaction)
- [ ] Delete: Cloudinary asset deleted before DB row (idempotent if Cloudinary fails)
- [ ] Delete: remaining photos re-sequenced (no gaps in order)
- [ ] Cover photo (order=0) is first in `GET /pitches/:id` response

## Edge cases
- Delete cover photo (order=0): next photo (order=1) becomes new cover
- Reorder with stale photo IDs (photo deleted between GET and PUT): 422 with "Photo list out of sync"
- Cloudinary deletion fails: log error + Sentry, still delete DB row (orphaned Cloudinary asset acceptable)

## Definition of done
- Reorder transaction tested: partial failure leaves order unchanged
- Cloudinary `public_id` stored at upload time (from `POST /upload/sign` response)
BODY

create_issue "$title" "$body" '["E10 — Manager: Pitch Mgmt","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E10-03 — Backend: Amenities + Pricing + Booking limits
# ─────────────────────────────────────────────────────────────────────────────
title="[E10-03] [Backend] PUT /pitches/:id/amenities + PUT /pitches/:id/pricing — amenities and rates"
read -r -d '' body << 'BODY' || true
## Summary
Two update endpoints: amenities (checkbox array stored in PitchAmenity junction table) and pricing (off-peak/peak rates, peak period definitions, booking duration limits).

## Reference
- PRD §8.2 Tab 3, Tab 4

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/pitches/[id]/amenities/route.ts` | Create — PUT |
| `apps/web/src/app/api/v1/pitches/[id]/pricing/route.ts` | Create — PUT |

## PUT /pitches/:id/amenities

### Schema
```typescript
export const AmenityEnum = z.enum([
  'SHOWERS_FREE', 'SHOWERS_PAID', 'CHANGING_ROOMS',
  'PARKING_FREE', 'PARKING_PAID', 'NIGHT_LIGHTING',
  'BALL_RENTAL_FREE', 'BALL_RENTAL_PAID',
  'REFRESHMENTS', 'LOCKERS', 'REFEREE',
  'FIRST_AID', 'WHEELCHAIR_ACCESSIBLE', 'WIFI',
]);

export const UpdateAmenitiesSchema = z.object({
  amenities: z.array(AmenityEnum),
});
```

### Logic
```typescript
// requireManagerOwnsPitch
// Delete all existing PitchAmenity rows for this pitch
// Create new rows for each amenity in request array
// Transaction: delete + createMany atomic
```

### Response: `{ amenities: string[] }` — the new set

## PUT /pitches/:id/pricing

### Schema
```typescript
const PeakPeriodSchema = z.object({
  days: z.array(z.enum(['0','1','2','3','4','5','6'])).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
}).refine(p => p.startTime < p.endTime, 'Peak start must be before end');

export const UpdatePricingSchema = z.object({
  offPeakRate: z.number().positive().max(9999),
  peakRate: z.number().positive().max(9999),
  peakPeriods: z.array(PeakPeriodSchema).max(5),
  minBookingDuration: z.enum(['60', '90', '120']),   // minutes
  maxBookingDuration: z.enum(['120', '180', '240', '0']),  // 0 = no limit
  advanceBookingDays: z.enum(['30', '60', '90']),
});
```

### Logic
```typescript
// requireManagerOwnsPitch
// peakRate >= offPeakRate validation (422 if not)
// Upsert PitchPricing (or update Pitch fields directly — depends on schema choice)
// Store peakPeriods as JSON array on Pitch model
```

### Pricing stored on Pitch model
```prisma
// Additional Pitch fields:
offPeakRate        Float
peakRate           Float
peakPeriods        Json    @default("[]")
minBookingDuration Int     @default(60)   // minutes
maxBookingDuration Int     @default(0)    // 0 = unlimited
advanceBookingDays Int     @default(60)
```

## Acceptance criteria (amenities)
- [ ] requireManagerOwnsPitch
- [ ] Replaces entire amenity set (not partial update)
- [ ] Empty array `[]` allowed (no amenities)
- [ ] Unknown amenity name → 422

## Acceptance criteria (pricing)
- [ ] peakRate >= offPeakRate — 422 if not
- [ ] peakPeriods: startTime < endTime per period
- [ ] Up to 5 peak periods
- [ ] minBookingDuration one of: 60, 90, 120
- [ ] advanceBookingDays one of: 30, 60, 90

## Definition of done
- `calcPrice` function in `packages/shared` uses `peakPeriods` JSON to determine rate per slot (used in E05-03 price preview and E05-07 booking creation)
- Migration adds pricing fields to Pitch model with sensible defaults
BODY

create_issue "$title" "$body" '["E10 — Manager: Pitch Mgmt","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E10-04 — Backend: Shirt inventory + Availability schedule
# ─────────────────────────────────────────────────────────────────────────────
title="[E10-04] [Backend] PUT /pitches/:id/shirts + PUT /pitches/:id/availability — inventory and schedule"
read -r -d '' body << 'BODY' || true
## Summary
Two endpoints: shirt inventory setup (per-colour quantities + rental price) and pitch-specific availability schedule (weekly hours + exception/blocked dates).

## Reference
- PRD §8.2 Tab 5, Tab 6

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/pitches/[id]/shirts/route.ts` | Create — PUT |
| `apps/web/src/app/api/v1/pitches/[id]/availability/route.ts` | Create — PUT |
| `apps/web/src/app/api/v1/pitches/[id]/exceptions/route.ts` | Create — POST, DELETE |

## PUT /pitches/:id/shirts

### Schema
```typescript
const ShirtColourEnum = z.enum(['RED','BLUE','GREEN','YELLOW','ORANGE','WHITE','BLACK','PURPLE']);

export const UpdateShirtsSchema = z.object({
  offersShirts: z.boolean(),
  shirtRentalPrice: z.number().positive().max(999).optional(),  // RON per shirt
  inventory: z.array(z.object({
    colour: ShirtColourEnum,
    quantity: z.number().int().min(0).max(999),
  })).optional(),
});
```

### Logic
```typescript
// requireManagerOwnsPitch
// If offersShirts: shirtRentalPrice required, inventory required and non-empty
// If !offersShirts: clear all ShirtInventory rows for pitch
// Upsert ShirtInventory per colour: { pitchId, colour, totalQty, availableQty: totalQty }
// Store shirtRentalPrice on Pitch model
```

### Important: `availableQty` vs `totalQty`
- `totalQty`: set by manager — total shirts owned
- `availableQty`: computed at booking time (totalQty minus shirts booked for overlapping slots)
- At inventory setup: `availableQty = totalQty` (no bookings yet)
- Reducing totalQty below current bookings: warn but allow (412 with warning + `force: true` flag)

## PUT /pitches/:id/availability

### Schema
```typescript
// Same structure as company working hours (E09-03) but pitch-specific
// Must be ≤ company working hours (cannot extend beyond company schedule)
export const PitchScheduleSchema = z.object({
  weeklySchedule: z.record(z.enum(['0','1','2','3','4','5','6']), DayHoursSchema),
});
```

### Validation against company hours
```typescript
// For each day: if pitch is open, verify pitch open >= company open AND pitch close <= company close
// 422 if pitch tries to be open when company is closed that day
```

## POST /pitches/:id/exceptions — add blocked date

### Schema
```typescript
export const AddExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});
```

### Logic
```typescript
// requireManagerOwnsPitch
// Check date is in future (can't block past dates)
// Create PitchException: { pitchId, date, reason }
// If existing bookings on that date: return 409 with list of affected bookingIds
// Manager must cancel those bookings first (or use force: true)
```

## DELETE /pitches/:id/exceptions/:exceptionId
```typescript
// requireManagerOwnsPitch
// Hard delete PitchException row (unblocks the date)
```

## Acceptance criteria (shirts)
- [ ] offersShirts: false → all ShirtInventory rows deleted, shirtRentalPrice null
- [ ] offersShirts: true → shirtRentalPrice and inventory required
- [ ] Inventory allows setting quantity to 0 (colour exists but none available)
- [ ] Reducing quantity below existing bookings: 412 + warning + affected bookingIds

## Acceptance criteria (availability)
- [ ] Pitch schedule cannot exceed company schedule — 422 if violation
- [ ] All 7 days required
- [ ] Exceptions: future dates only
- [ ] Exception on date with bookings: 409 with bookingIds

## Definition of done
- `GET /pitches/:id/availability` (E04-03) reads both weeklySchedule + exceptions
- Shirt availability check in `POST /bookings` (E05-07) uses `totalQty - bookedQty` per slot
BODY

create_issue "$title" "$body" '["E10 — Manager: Pitch Mgmt","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E10-05 — Backend: Pitch status + GET /manager/pitches list
# ─────────────────────────────────────────────────────────────────────────────
title="[E10-05] [Backend] PATCH /pitches/:id/status + DELETE + GET /manager/pitches — pitch lifecycle"
read -r -d '' body << 'BODY' || true
## Summary
Activate/deactivate pitch, soft-delete pitch, and list all pitches for a manager's company with stats (today's bookings, rating). Used by the Pitch List page.

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/api/v1/pitches/[id]/status/route.ts` | Create — PATCH |
| `apps/web/src/app/api/v1/manager/pitches/route.ts` | Create — GET |
| `apps/web/src/app/api/v1/pitches/[id]/route.ts` | Modify — add DELETE handler |

## PATCH /pitches/:id/status
```typescript
const StatusSchema = z.object({
  isActive: z.boolean(),
});

// requireManagerOwnsPitch
// Update pitch.isActive
// If activating: require at least 1 photo uploaded (422 if no photos)
// If deactivating: no restrictions — existing bookings unaffected
// Return { id, isActive }
```

## DELETE /pitches/:id (soft delete)
```typescript
// requireManagerOwnsPitch
// Check no upcoming PENDING/CONFIRMED bookings (422 if any — must cancel first)
// Set pitch.deletedAt = now
// Set pitch.isActive = false
// Return 204
```

## GET /manager/pitches — pitch list with stats
```typescript
// requireAuth + MANAGER role + active company
// Returns all non-deleted pitches for manager's company
// Include per pitch: today's booking count, avgRating, reviewCount, photo count
// No pagination (companies rarely have > 20 pitches)
```

### Response
```json
{
  "data": [{
    "id": "...",
    "name": "Pitch A",
    "surfaceType": "ARTIFICIAL_GRASS",
    "size": "FIVE_A_SIDE",
    "isActive": true,
    "coverPhotoUrl": "https://res.cloudinary.com/...",
    "avgRating": 4.3,
    "reviewCount": 42,
    "bookingsToday": 3,
    "photoCount": 5
  }]
}
```

### bookingsToday computation
```typescript
const today = startOfDay(new Date());
const tomorrow = endOfDay(new Date());
// count CONFIRMED bookings where date = today per pitch
// Single Prisma query using _count with where clause
```

## Acceptance criteria
- [ ] Activate: requires at least 1 photo — 422 if none
- [ ] Deactivate: no restrictions; existing bookings unaffected
- [ ] Delete: blocked if upcoming bookings exist
- [ ] Delete: soft (deletedAt set, not hard delete)
- [ ] GET /manager/pitches: only manager's own pitches
- [ ] `coverPhotoUrl`: first photo by order ASC, null if no photos
- [ ] `bookingsToday`: CONFIRMED bookings only (not PENDING/CANCELLED)

## Edge cases
- Manager activates pitch with photos but no pricing set: allow (pricing has defaults, player sees "from 0 RON/h" — bad UX but API doesn't block it; v1.1: require pricing before activation)
- Deleted pitch: excluded from all player-facing endpoints (filter `deletedAt: null`)
- Re-creating after delete: just create a new pitch (no undelete in v1)

## Definition of done
- Soft delete: deleted pitch not returned by GET /companies/:id (player-facing)
- `bookingsToday` accurate at midnight boundary (timezone = Europe/Bucharest)
BODY

create_issue "$title" "$body" '["E10 — Manager: Pitch Mgmt","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E10-06 — Web: Pitch list page
# ─────────────────────────────────────────────────────────────────────────────
title="[E10-06] [Web] Manager pitch list page — table, add pitch, activate/deactivate toggle, delete"
read -r -d '' body << 'BODY' || true
## Summary
`/manager/pitches` — table of all pitches with photo thumbnail, stats, and inline actions. "Add Pitch" button creates new pitch and opens editor. Activate/deactivate toggle. Soft-delete with confirmation.

## Reference
- UIUX_SPEC §14.1

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/manager/pitches/page.tsx` | Create |
| `apps/web/src/components/manager/PitchTable.tsx` | Create |
| `apps/web/src/components/manager/PitchStatusToggle.tsx` | Create |

## Table spec (UIUX_SPEC §14.1)
- Columns: Photo | Name | Surface | Size | Status | Today's bookings | Rating | Actions
- Photo: 48×48px thumbnail (cover photo), radius-sm; placeholder icon if no photo
- Name: label-md neutral-900, link to editor
- Surface: chip (same colours as player-facing chips from E03-06)
- Size: "5v5" | "7v7" | "11v11" | "Custom"
- Status: "Active" (success-600 text, success-50 bg, radius-full) | "Inactive" (neutral-500 text, neutral-100 bg)
- Today's bookings: body-md neutral-900, centred
- Rating: stars (12px) + count; "–" if reviewCount < 3
- Actions: Edit icon | Status toggle | Delete icon (error-500)

## PitchStatusToggle
```tsx
// Toggle switch (shadcn/ui Switch)
// On toggle ON (activating):
//   - If photoCount === 0: show inline warning toast "Add at least one photo before activating"
//   - Else: PATCH /pitches/:id/status { isActive: true } → optimistic update
// On toggle OFF: PATCH immediately (no confirmation needed)
```

## Delete action
- Delete icon → confirm dialog: "Delete Pitch A? This cannot be undone."
  - If upcoming bookings: show "This pitch has X upcoming bookings. Cancel them first."
  - Else: DELETE /pitches/:id → remove row from table (router.refresh())

## "Add Pitch" button
- Top right, primary
- Click: POST /pitches { name: "New Pitch", surfaceType: "ARTIFICIAL_GRASS", size: "FIVE_A_SIDE" } with minimal defaults
- On success: router.push(`/manager/pitches/${newPitch.id}/edit`)

## Column sorting
- Sortable: Name (alpha), Rating (desc), Today's bookings (desc)
- Client-side sort for v1 (all pitches loaded at once — typically < 20)
- Sort indicator: chevron-up / chevron-down next to active column header

## Empty state
- No pitches: football icon (64px primary-600) + "No pitches yet" heading-sm + "Add your first pitch" primary CTA

## Acceptance criteria
- [ ] Table renders all manager's pitches
- [ ] Photo thumbnail shown (or placeholder)
- [ ] Surface chips correct colour per type
- [ ] Status toggles correctly, optimistic update
- [ ] Activating without photos: toast warning, toggle reverts
- [ ] Delete blocked if upcoming bookings exist
- [ ] "Add Pitch" creates pitch and opens editor
- [ ] Column sort works (Name, Rating, bookingsToday)
- [ ] Empty state shown

## Definition of done
- Tested with 0, 1, and 5+ pitches
- Status toggle correctly calls PATCH and reflects in table without full reload
BODY

create_issue "$title" "$body" '["E10 — Manager: Pitch Mgmt","type: feature","platform: web","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E10-07 — Web: Pitch editor — Basic Info + Photos + Amenities tabs
# ─────────────────────────────────────────────────────────────────────────────
title="[E10-07] [Web] Pitch editor — Basic Info tab, Photos tab (drag-and-drop grid), Amenities tab"
read -r -d '' body << 'BODY' || true
## Summary
First 3 tabs of the Pitch Editor at `/manager/pitches/:id/edit`. Sidebar tab navigation. Basic Info form, drag-and-drop photo grid with Cloudinary upload, amenities checkbox list.

## Reference
- PRD §8.2 Tabs 1–3
- UIUX_SPEC §14.2

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/manager/pitches/[id]/edit/layout.tsx` | Create — editor shell + tab nav |
| `apps/web/src/app/manager/pitches/[id]/edit/basic-info/page.tsx` | Create |
| `apps/web/src/app/manager/pitches/[id]/edit/photos/page.tsx` | Create |
| `apps/web/src/app/manager/pitches/[id]/edit/amenities/page.tsx` | Create |
| `apps/web/src/components/pitch-editor/PhotoGrid.tsx` | Create |
| `apps/web/src/components/pitch-editor/PhotoUploadDropzone.tsx` | Create |

## Editor shell layout (UIUX_SPEC §14.2)
- Desktop: 200px tab sidebar (left) + main content (right)
- Tablet/mobile: tab list at top, content below (stacked)
- Sidebar tabs: Basic Info | Photos | Amenities | Pricing | Shirts | Availability
  - Active: primary-600 bg, white text, full width
  - Inactive: neutral-700 text
  - Unsaved indicator: small orange dot on tab label if dirty
- Page title: "Edit {pitch name}" — heading-md
- Breadcrumb: Pitches → {pitch name}

## Basic Info tab
- Pitch name (max 60 chars, live counter)
- Surface type: radio group (Natural Grass | Artificial Grass | Futsal)
- Pitch size: radio group (5v5 | 7v7 | 11v11 | Custom)
- Dimensions: 2-col grid, auto-filled on size change, editable if Custom
- Description: textarea max 1000 chars
- "Active" toggle: Switch, primary-600; if toggling on without photos → inline warning
- Sticky footer: "Save changes" primary | "Cancel" ghost | "Unsaved changes" indicator

## Photos tab

### PhotoGrid spec
- 3-column responsive grid (2-col on tablet, 1-col on mobile)
- Each photo card: thumbnail (cover fit, 160px height), drag handle (top-left `≡`), delete X (top-right, error-500)
- Photo count badge: "3 / 10" — top-right of grid, label-sm neutral-500
- Order indicator: "1", "2", etc. bottom-left, label-xs white, rgba(0,0,0,0.5) bg

### Drag-and-drop reorder
- `@dnd-kit/core` + `@dnd-kit/sortable`
- On drag end: PUT /pitches/:id/photos/reorder with new photoIds array
- Optimistic UI: update order immediately, revert on API error

### PhotoUploadDropzone
- Dashed border, radius-md, min-height 100px, centred
- "Drag photos here or click to upload" — body-sm neutral-500
- Accepts: image/jpeg, image/png, image/webp
- Max: 5MB per file, 800×600px minimum (validate client-side after pick)
- Multi-select: can pick multiple files at once
- Upload flow per file: POST /api/v1/upload/sign?folder=pitches → Cloudinary → POST /pitches/:id/photos
- Per-file progress: individual progress bars below dropzone during upload
- Error per file: "IMG_001.jpg: File too large" — body-sm error-500

## Amenities tab
- 14 checkbox rows in 2-column grid
- Checkbox label matches PRD §8.2 Tab 3 exactly
- "Save amenities" sticky footer button → PUT /pitches/:id/amenities

## Acceptance criteria (Basic Info)
- [ ] Surface radio buttons styled correctly
- [ ] Dimension fields auto-fill on size change; editable when Custom
- [ ] "Unsaved changes" dot in tab label when form is dirty
- [ ] Sticky footer always visible (sticky bottom)

## Acceptance criteria (Photos)
- [ ] Drag-and-drop reorders photos
- [ ] Photo limit: 10 max (dropzone disabled when at limit)
- [ ] Dimension validation: 800×600px minimum, reject smaller
- [ ] Multi-file upload: parallel uploads with individual progress
- [ ] Delete: Cloudinary + DB row removed, grid re-orders

## Acceptance criteria (Amenities)
- [ ] All 14 amenities listed
- [ ] Pre-populated from existing pitch data
- [ ] Save replaces full amenity set

## Definition of done
- `@dnd-kit` drag-and-drop tested across browsers
- Photo upload: 5 simultaneous uploads work without race condition
BODY

create_issue "$title" "$body" '["E10 — Manager: Pitch Mgmt","type: feature","platform: web","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E10-08 — Web: Pitch editor — Pricing tab
# ─────────────────────────────────────────────────────────────────────────────
title="[E10-08] [Web] Pitch editor — Pricing tab (rates, peak periods, booking limits, live preview)"
read -r -d '' body << 'BODY' || true
## Summary
Pricing tab of the Pitch Editor. Off-peak and peak rates, multiple peak period definitions (day checkboxes + time range), booking duration limits, advance booking window. Live booking price preview.

## Reference
- PRD §8.2 Tab 4
- UIUX_SPEC §14.2 Pricing tab

## File to create
`apps/web/src/app/manager/pitches/[id]/edit/pricing/page.tsx`

## Rates section
- "Off-peak rate" — number input, suffix "RON / hour", min 0 max 9999
- "Peak rate" — number input, suffix "RON / hour", must be ≥ off-peak (inline error if not)
- Inline note: "Peak rate applies during peak periods. Off-peak applies at all other times."

## Peak periods table (UIUX_SPEC §14.2)
- "+ Add period" button (top right of table) → appends new row
- Each row:
  - Day checkboxes: "Mon Tue Wed Thu Fri Sat Sun" (compact, 32px each)
  - Start time `<input type="time">` step="1800" (30-min steps)
  - "–" separator
  - End time `<input type="time">`
  - Inline error: "End must be after start"
  - Delete row button: trash icon, error-500
- Max 5 peak periods (disable "+ Add period" at limit)
- Empty state: "No peak periods defined — off-peak rate applies all day"

## Booking limits section
- "Minimum booking duration": radio group — 1h | 1.5h | 2h
- "Maximum booking duration": radio group — 2h | 3h | 4h | No limit
- "Advance booking": radio group — Book up to 30 days ahead | 60 days | 90 days

## Live preview (UIUX_SPEC §14.2)
- Card: neutral-50 bg, radius-md, 12px padding
- Updates in real-time as manager changes rates/periods
- Text: "A player booking **2h** on **Thursday at 19:00** would pay **XX RON**"
- XX RON computed using `calcPrice(date, startTime, endTime, offPeakRate, peakRate, peakPeriods)` from `packages/shared`

## Form submission
- "Save pricing" sticky footer → PUT /pitches/:id/pricing
- Validate client-side: peakRate >= offPeakRate, end > start per period
- On success: toast "Pricing saved"

## Acceptance criteria
- [ ] Off-peak rate and peak rate inputs with RON suffix
- [ ] Peak rate < off-peak: inline error, form blocked
- [ ] Add period: new row appended, up to 5 max
- [ ] Each period: day checkboxes + time pickers + delete
- [ ] End before start: inline error per row
- [ ] Live preview updates as fields change (debounced 300ms)
- [ ] Preview shows correct price using shared `calcPrice` function
- [ ] Booking limits: correct radio options
- [ ] Save: PUT /pitches/:id/pricing with correct payload

## Definition of done
- `calcPrice` from `packages/shared` used in both preview and `POST /bookings` (E05-07) — single source of truth
- Live preview tested: Thursday 19:00 during a peak period shows peak rate; 10:00 off-peak shows off-peak rate
BODY

create_issue "$title" "$body" '["E10 — Manager: Pitch Mgmt","type: feature","platform: web","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E10-09 — Web: Pitch editor — Shirts tab
# ─────────────────────────────────────────────────────────────────────────────
title="[E10-09] [Web] Pitch editor — Shirts tab (colour inventory, rental price, offer toggle)"
read -r -d '' body << 'BODY' || true
## Summary
Shirts tab: toggle shirt rental on/off, set rental price per shirt, manage per-colour inventory quantities.

## Reference
- PRD §8.2 Tab 5

## File to create
`apps/web/src/app/manager/pitches/[id]/edit/shirts/page.tsx`

## Page layout
- "Offer shirt rental?" — Switch toggle, primary-600 active
- When toggle OFF: rest of form hidden
- When toggle ON (animated expand):

### Rental price
- "Rental price per shirt" — number input suffix "RON / shirt", min 1 max 999

### Inventory table
- Columns: Colour swatch | Colour name | Quantity | Actions
- 8 colour rows (all 8 standard colours, always shown):
  | Colour | Hex |
  |--------|-----|
  | Red | #EF4444 |
  | Blue | #3B82F6 |
  | Green | #22C55E |
  | Yellow | #FBBF24 |
  | Orange | #F97316 |
  | White | #F9FAFB (border: neutral-200) |
  | Black | #111827 |
  | Purple | #A855F7 |
- Colour swatch: 24×24px circle, correct hex
- Quantity: number input min 0, max 999 (0 = colour available but out of stock)
- Inline note below table: "Set quantity to 0 to disable a colour. Players will see a 'not available' warning."

### Active colours summary
- Below table: "Active colours: Red (14), Blue (10), Green (0)" — body-sm neutral-500
- A colour is "active" if quantity > 0

## Form submission
- "Save shirt setup" sticky footer → PUT /pitches/:id/shirts
- If toggle OFF: `{ offersShirts: false }` — clears all inventory
- If toggle ON: `{ offersShirts: true, shirtRentalPrice: XX, inventory: [{ colour, quantity }...] }`

## Acceptance criteria
- [ ] Toggle OFF hides form (animated), submit sends `offersShirts: false`
- [ ] Toggle ON shows form
- [ ] All 8 colour rows shown
- [ ] White swatch has border (visible on white background)
- [ ] Quantity 0 allowed (means not available)
- [ ] Rental price required when toggle ON (validated before submit)
- [ ] Active colours summary updates as quantities change
- [ ] Save: correct payload to PUT /pitches/:id/shirts

## Definition of done
- Colour swatches match exact hex values used on player booking screen (E05-04)
- Quantity reduction warning: if reducing below existing bookings, API returns 412 → show inline warning to manager
BODY

create_issue "$title" "$body" '["E10 — Manager: Pitch Mgmt","type: feature","platform: web","priority: medium"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E10-10 — Web: Pitch editor — Availability tab (schedule + exceptions)
# ─────────────────────────────────────────────────────────────────────────────
title="[E10-10] [Web] Pitch editor — Availability tab (weekly schedule grid, exception dates)"
read -r -d '' body << 'BODY' || true
## Summary
Availability tab: per-day open/close time grid constrained by company hours, plus exception dates (blocked days for maintenance, holidays, etc.).

## Reference
- PRD §8.2 Tab 6
- UIUX_SPEC §14.2 Availability tab

## File to create
`apps/web/src/app/manager/pitches/[id]/edit/availability/page.tsx`

## Weekly schedule grid (UIUX_SPEC §14.2)
- 7 rows (Mon–Sun display order)
- Each row:
  - Day label (80px, label-md neutral-700)
  - "Closed" Switch — when ON: row greys out (company is closed that day OR manager chose to close)
  - Open time `<input type="time">` (disabled if closed)
  - "–" separator
  - Close time `<input type="time">` (disabled if closed)
  - Company hours context: "(Company: 08:00–23:00)" — body-sm neutral-400 below time inputs

## Constraint validation
- Pitch schedule must stay within company hours for that day
- If company is closed: pitch must also be closed (Closed switch locked ON, greyed)
- If pitch tries to open before company or close after company: inline error per row

```typescript
function validatePitchHours(
  pitchOpen: string, pitchClose: string,
  companyOpen: string, companyClose: string
): string | null {
  if (pitchOpen < companyOpen) return `Cannot open before company (${companyOpen})`;
  if (pitchClose > companyClose) return `Cannot close after company (${companyClose})`;
  return null;
}
```

## "Copy company hours" shortcut
- Button: "Copy company hours to pitch" — ghost, below grid
- Fills all pitch hours to match company hours (for days company is open)

## Exception dates section
- Header: "Blocked dates" — heading-sm
- Date picker (HTML `<input type="date">`) + reason input (max 200 chars, optional) + "Add" button
- On Add: POST /pitches/:id/exceptions
  - If bookings exist on that date: inline error "This date has X bookings. Cancel them first."
  - On success: date appears in list below

### Blocked dates list
- Each row: date formatted "Wednesday, 15 October 2026" + reason (if any, body-sm neutral-500)
- Delete (X) icon → DELETE /pitches/:id/exceptions/:id → row removed
- Sorted by date ASC
- Past dates: shown in neutral-300 (cannot delete past blocks — they're history)

## Form submission
- "Save availability" sticky footer → PUT /pitches/:id/availability (weekly schedule only)
- Exception dates saved immediately on add/delete (not batched with schedule save)

## Acceptance criteria
- [ ] Company-closed days: pitch Closed switch locked, greyed
- [ ] Pitch hours outside company hours: inline error per row, form blocked
- [ ] "Copy company hours" fills pitch schedule correctly
- [ ] Exception date picker: future dates only (past dates disabled)
- [ ] Exception with bookings: clear error message with booking count
- [ ] Exception added immediately (no batch save)
- [ ] Past exception dates shown greyed, undeletable
- [ ] Schedule save: PUT /pitches/:id/availability with all 7 days

## Definition of done
- Constraint validation tested: pitch 07:00 when company opens 08:00 → inline error
- Exception flow tested end-to-end: add date → verify unavailable in player booking (E05-03)
BODY

create_issue "$title" "$body" '["E10 — Manager: Pitch Mgmt","type: feature","platform: web","priority: medium"]' "$MILESTONE"

echo "✓ E10 — 10 issues created"
