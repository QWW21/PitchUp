#!/usr/bin/env bash
# e07.sh — create all E07 Reviews issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E07 — Reviews")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E07 — Reviews' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E07 — Reviews)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E07-01 — Backend: GET /pitches/:id/reviews — full paginated review listing
# ─────────────────────────────────────────────────────────────────────────────
title="[E07-01] [Backend] GET /pitches/:id/reviews — full paginated listing with rating breakdown"
read -r -d '' body << 'BODY' || true
## Summary
Full paginated review listing for a pitch. Returns rating breakdown (count per star), all approved reviews with player info, manager reply, and photos. Public endpoint. E04-07 had a preview (3 reviews); this is the complete paginated list.

## Reference
- PRD §11
- UIUX_SPEC §6.1 (review card)

## File to create
`apps/web/src/app/api/v1/pitches/[id]/reviews/route.ts`

## Query params
| Param | Default | Notes |
|-------|---------|-------|
| `cursor` | none | bookingId-based cursor |
| `limit` | 20 | max 50 |
| `sort` | `newest` | `newest` \| `highest` \| `lowest` \| `unanswered` |

## Response
```json
{
  "data": {
    "avgRating": 4.3,
    "reviewCount": 127,
    "breakdown": { "5": 64, "4": 38, "3": 15, "2": 7, "1": 3 },
    "items": [{
      "id": "clxyz...",
      "rating": 5,
      "text": "Great pitch!",
      "isAnonymous": false,
      "player": { "fullName": "Ion P.", "avatarUrl": null },
      "photos": [{ "url": "https://res.cloudinary.com/...", "order": 0 }],
      "reply": {
        "text": "Thanks for the review!",
        "createdAt": "2026-10-07T10:00:00Z"
      },
      "createdAt": "2026-10-06T10:00:00Z"
    }],
    "nextCursor": "clxyz2...",
    "hasMore": true
  }
}
```

## Anonymisation
```typescript
// If review.isAnonymous → replace player with { fullName: "Anonymous player", avatarUrl: null }
// Never expose userId in response
```

## Deleted reviews
- `deletedAt !== null` → exclude from results (filter in query)

## Sort logic
- `newest`: `createdAt DESC`
- `highest`: `rating DESC, createdAt DESC`
- `lowest`: `rating ASC, createdAt DESC`
- `unanswered`: `reply IS NULL, createdAt DESC` (manager-facing sort — still public endpoint)

## Rating breakdown
- Single `groupBy` query: `prisma.review.groupBy({ by: ['rating'], _count: true })`
- Fill missing star counts with 0

## Acceptance criteria
- [ ] Public endpoint — no auth required
- [ ] Cursor pagination, ordered per `sort` param
- [ ] Anonymous reviews: player replaced with "Anonymous player"
- [ ] Deleted reviews excluded
- [ ] `breakdown` always has keys 1–5, even if count = 0
- [ ] `avgRating` null if `reviewCount < 3` (not enough data)
- [ ] `reply` null if no manager reply

## Definition of done
- No N+1 queries — single Prisma query with includes
- `avgRating` precision: 1 decimal place (round at query level or serialiser)
BODY

create_issue "$title" "$body" '["E07 — Reviews","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E07-02 — Backend: GET /reviews/mine — player's own reviews
# ─────────────────────────────────────────────────────────────────────────────
title="[E07-02] [Backend] GET /reviews/mine — player's submitted reviews with editability window"
read -r -d '' body << 'BODY' || true
## Summary
Return all reviews submitted by the authenticated player. Includes pitch/company context, editability flag (within 24h), and manager reply. Used by My Reviews screens on mobile and web.

## File to create
`apps/web/src/app/api/v1/reviews/mine/route.ts`

## Response
```json
{
  "data": [{
    "id": "clxyz...",
    "rating": 4,
    "text": "Great pitch, well maintained.",
    "isAnonymous": false,
    "photos": [{ "url": "https://...", "order": 0 }],
    "isEditable": true,
    "editableUntil": "2026-10-07T10:00:00Z",
    "reply": { "text": "Thanks!", "createdAt": "2026-10-07T11:00:00Z" },
    "pitch": { "id": "...", "name": "Pitch A" },
    "company": { "id": "...", "name": "Demo Sports Club" },
    "bookingDate": "2026-10-05",
    "createdAt": "2026-10-06T10:00:00Z"
  }]
}
```

## Logic
```typescript
const reviews = await prisma.review.findMany({
  where: { userId: user.id, deletedAt: null },
  orderBy: { createdAt: 'desc' },
  include: { photos: true, reply: true, pitch: true, booking: { select: { date: true } } },
});

return reviews.map(r => ({
  ...r,
  isEditable: new Date(r.createdAt.getTime() + 24 * 3_600_000) > new Date(),
  editableUntil: new Date(r.createdAt.getTime() + 24 * 3_600_000),
  bookingDate: r.booking.date,
}));
```

## Acceptance criteria
- [ ] Requires auth
- [ ] Returns only the authenticated user's reviews
- [ ] `isEditable` computed server-side (not client-side, avoids clock skew bugs)
- [ ] Deleted reviews excluded (`deletedAt: null` filter)
- [ ] Sorted newest first
- [ ] No pagination for v1 (players rarely have > 50 reviews)

## Definition of done
- `isEditable` correct at boundary (exactly 24h: false, 23h59m: true)
BODY

create_issue "$title" "$body" '["E07 — Reviews","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E07-03 — Backend: Manager reply API
# ─────────────────────────────────────────────────────────────────────────────
title="[E07-03] [Backend] POST/PUT /reviews/:id/reply — manager reply, edit within 24h"
read -r -d '' body << 'BODY' || true
## Summary
Manager can reply once per review. Reply editable within 24h. Requires MANAGER role and company ownership of the pitch being reviewed.

## Reference
- PRD §8.5

## Files to create
`apps/web/src/app/api/v1/reviews/[id]/reply/route.ts` — POST + PUT + DELETE

## POST /reviews/:id/reply
```typescript
const CreateReplySchema = z.object({
  text: z.string().min(1).max(300),
});

// requireAuth + requireRole('MANAGER')
// Fetch review → verify review.pitch.companyId === manager's company
// Reject if reply already exists (409)
// Create ReviewReply: { reviewId, text, managerId }
// Notify player (E13)
```

## PUT /reviews/:id/reply (edit)
```typescript
// Same auth + ownership checks
// Check reply.createdAt + 24h > now → else 400 EDIT_WINDOW_CLOSED
// Update reply.text
```

## DELETE /reviews/:id/reply
```typescript
// Same auth + ownership checks
// Hard delete the reply row (manager can un-reply)
```

## Prisma model (add to schema)
```prisma
model ReviewReply {
  id        String   @id @default(cuid())
  reviewId  String   @unique
  review    Review   @relation(fields: [reviewId], references: [id])
  managerId String
  manager   User     @relation(fields: [managerId], references: [id])
  text      String   @db.VarChar(300)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Acceptance criteria
- [ ] Requires MANAGER role (403 if PLAYER calls this)
- [ ] Manager can only reply to reviews for their company's pitches
- [ ] POST: 409 if reply already exists
- [ ] PUT: 400 after 24h edit window
- [ ] DELETE: removes reply, review shows no reply
- [ ] Reply appears immediately in GET /pitches/:id/reviews response
- [ ] Player notified on new reply (E13 dependency — just call notify stub)

## Edge cases
- Review deleted after manager replied: reply silently orphaned (no error)
- Manager account suspended: requireRole check still passes (role unchanged) — fine for v1

## Definition of done
- Manager from different company cannot reply to reviews for pitches they don't own
- `@unique` on `reviewId` enforced at DB level (one reply per review)
BODY

create_issue "$title" "$body" '["E07 — Reviews","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E07-04 — Backend: POST /reviews/:id/report — flag abusive review
# ─────────────────────────────────────────────────────────────────────────────
title="[E07-04] [Backend] POST /reviews/:id/report — flag review for admin moderation"
read -r -d '' body << 'BODY' || true
## Summary
Any authenticated user (player or manager) can report a review as abusive/inappropriate. Creates a moderation flag, notifies admin. Review not hidden immediately — admin decides.

## File to create
`apps/web/src/app/api/v1/reviews/[id]/report/route.ts`

## Schema
```typescript
const ReportReviewSchema = z.object({
  reason: z.enum(['INAPPROPRIATE', 'SPAM', 'FAKE', 'OFFENSIVE', 'OTHER']),
  notes: z.string().max(300).optional(),
});
```

## Logic
```typescript
// requireAuth
// Check review exists and is not deleted
// Prevent duplicate report: one report per user per review
// Create ReviewReport: { reviewId, reporterId, reason, notes }
// Create admin Notification: "Review #id reported as REASON by userId"
// Return 200 { message: 'Report submitted' }
```

## Prisma model
```prisma
model ReviewReport {
  id         String   @id @default(cuid())
  reviewId   String
  review     Review   @relation(fields: [reviewId], references: [id])
  reporterId String
  reporter   User     @relation(fields: [reporterId], references: [id])
  reason     ReportReason
  notes      String?
  createdAt  DateTime @default(now())
  @@unique([reviewId, reporterId])
}

enum ReportReason { INAPPROPRIATE SPAM FAKE OFFENSIVE OTHER }
```

## Acceptance criteria
- [ ] Requires auth
- [ ] 404 if review not found or deleted
- [ ] 409 if same user reports same review twice
- [ ] Admin notification created
- [ ] Review NOT hidden — only flagged (admin acts in E15)
- [ ] Manager can report reviews on their own pitches

## Definition of done
- DB constraint prevents duplicate reports
- Admin notification viewable in E15 admin panel
BODY

create_issue "$title" "$body" '["E07 — Reviews","type: feature","platform: backend","priority: medium"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E07-05 — Backend: avgRating recalculation utility
# ─────────────────────────────────────────────────────────────────────────────
title="[E07-05] [Backend] Review rating recalculation — pitch avgRating + reviewCount kept in sync"
read -r -d '' body << 'BODY' || true
## Summary
Keep `pitch.avgRating` and `pitch.reviewCount` (denormalised on Pitch model) updated after each review create/delete. Also provide `GET /companies/:id/reviews` for manager review management page.

## Files to create / modify
| File | Action |
|------|--------|
| `apps/web/src/lib/reviewAggregate.ts` | Create — recalculate and update pitch |
| `apps/web/src/app/api/v1/companies/[id]/reviews/route.ts` | Create — GET for manager |

## reviewAggregate.ts
```typescript
export async function recalcPitchRating(pitchId: string, tx?: Prisma.TransactionClient): Promise<void> {
  const db = tx ?? prisma;
  const agg = await db.review.aggregate({
    where: { pitchId, deletedAt: null, moderationStatus: 'APPROVED' },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await db.pitch.update({
    where: { id: pitchId },
    data: {
      avgRating: agg._count.rating >= 3 ? Math.round((agg._avg.rating ?? 0) * 10) / 10 : null,
      reviewCount: agg._count.rating,
    },
  });
}
```

Call `recalcPitchRating` from:
- `POST /reviews` (after create) — E06-05
- `DELETE /reviews/:id` (after soft delete) — E06-05
- `POST /reviews/:id/report` → only if admin hard-deletes (E15 hook)

## GET /companies/:id/reviews (manager endpoint)
```typescript
// requireAuth + requireRole('MANAGER') + company ownership
// Returns all reviews for all pitches belonging to this company
// Query params: pitchId (filter), sort (newest|lowest|unanswered), cursor, limit 20
// Includes: player name, rating, text, pitch name, reply (if any), reportCount
// Used by manager Reviews Management page (E07-09)
```

## Response
```json
{
  "data": {
    "items": [{
      "id": "...",
      "rating": 2,
      "text": "Pitch lights were broken.",
      "player": { "fullName": "Ion P." },
      "pitch": { "id": "...", "name": "Pitch A" },
      "reply": null,
      "reportCount": 0,
      "createdAt": "2026-10-05T18:00:00Z"
    }],
    "nextCursor": null,
    "hasMore": false
  }
}
```

## Acceptance criteria
- [ ] `recalcPitchRating` called after every review create and delete
- [ ] `avgRating` null when `reviewCount < 3`
- [ ] `avgRating` rounded to 1 decimal
- [ ] `pitch.reviewCount` equals count of non-deleted APPROVED reviews
- [ ] GET /companies/:id/reviews: only manager of that company can call
- [ ] Manager can filter by pitch, sort by lowest-rated or unanswered

## Definition of done
- Add `avgRating Float?` and `reviewCount Int @default(0)` to Pitch model (Prisma migration)
- `recalcPitchRating` wrapped in same transaction as review mutation where possible
BODY

create_issue "$title" "$body" '["E07 — Reviews","type: feature","platform: backend","priority: high"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E07-06 — Mobile: My Reviews screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E07-06] [Mobile] My Reviews screen — submitted reviews list, edit within 24h, delete"
read -r -d '' body << 'BODY' || true
## Summary
Mobile screen under Profile → "My reviews" showing all reviews the player has submitted. Cards show pitch, rating, text, photos, manager reply. Edit and delete actions within constraints.

## Reference
- PRD §7.8
- UIUX_SPEC §8.4 (review form reference)

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/profile/MyReviewsScreen.tsx` | Create |
| `apps/mobile/src/screens/profile/components/MyReviewCard.tsx` | Create |
| `apps/mobile/src/screens/profile/EditReviewScreen.tsx` | Create |

## MyReviewCard spec
- white bg, shadow-sm, radius-md, 16px padding
- Row 1: pitch name (heading-sm) + company name (body-sm neutral-500)
- Row 2: date played (body-sm neutral-400) + star row (14px warning-500)
- Review text (body-md neutral-700, max 3 lines, "Show more" toggle)
- Photos (if any): horizontal scroll, 60×60px thumbnails, radius-sm
- Manager reply (if any): indented 12px, neutral-50 bg, radius-sm, 8px padding
  - "Response from manager" — label-sm neutral-500
  - Reply text — body-md neutral-700
- Bottom row (if isEditable): "Edit" ghost-sm left | "Delete" ghost-sm error-500 right
- Bottom row (if !isEditable): "Delete" ghost-sm error-500 right only

## EditReviewScreen
- Pre-fills rating, text, isAnonymous from existing review
- Photos NOT editable (show as static thumbnails, "Photo editing coming soon")
- "Save changes" → PUT /reviews/:id
- Shows: "Edit window closes {editableUntil formatted}" — body-sm neutral-400
- On success: navigate back, invalidate ['reviews', 'mine'] query

## Delete flow
- Alert.alert "Delete this review?" + "This cannot be undone" → OK
- DELETE /reviews/:id → remove card from list (optimistic update)
- Toast: "Review deleted"

## Empty state
- Star illustration (48px neutral-300) + "No reviews yet" + "Book a pitch and share your experience" → CTA ghost → Discover tab

## Acceptance criteria
- [ ] Cards show all fields per spec
- [ ] Manager reply rendered indented if present
- [ ] "Edit" only visible when isEditable === true
- [ ] Edit navigates to EditReviewScreen pre-filled
- [ ] Delete confirmation shown, deleted card removed from list
- [ ] Pull-to-refresh reloads list
- [ ] Empty state shown when no reviews

## Definition of done
- Accessible from Profile screen → "My reviews" menu item
- Edit window check comes from API (isEditable flag), not client clock
BODY

create_issue "$title" "$body" '["E07 — Reviews","type: feature","platform: mobile","priority: medium"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E07-07 — Mobile: Full reviews list on Pitch Detail (paginated)
# ─────────────────────────────────────────────────────────────────────────────
title="[E07-07] [Mobile] Pitch reviews full list screen — rating breakdown bar chart, infinite scroll"
read -r -d '' body << 'BODY' || true
## Summary
Full-screen reviews list navigated from "See all X reviews" on Pitch Detail. Shows rating breakdown bar chart + paginated review cards. E04-07 had the preview; this is the complete list.

## Reference
- UIUX_SPEC §6.1 (review cards, breakdown chart)
- PRD §11

## Files to create
| File | Action |
|------|--------|
| `apps/mobile/src/screens/pitch/AllReviewsScreen.tsx` | Create |
| `apps/mobile/src/screens/pitch/components/RatingBreakdownChart.tsx` | Create |
| `apps/mobile/src/screens/pitch/components/ReviewCard.tsx` | Create (extract from E04-07) |
| `apps/mobile/src/screens/pitch/components/ReviewSortSelector.tsx` | Create |

## RatingBreakdownChart spec (from UIUX_SPEC §6.1)
- Large rating number: display-md neutral-900, centred
- Star row below number: 20px stars, warning-500
- 5 bar rows (5★ to 1★):
  - Star count label: label-sm neutral-500
  - Track: neutral-100 bg, radius-full, flex-1 height 8px
  - Fill: Animated.timing to correct % on mount, 600ms ease-out, primary-600
  - Count label: label-sm neutral-500, right aligned
- All bars animate simultaneously on mount

## ReviewCard spec
- Already built in E04-07 (extract to shared component)
- Avatar (32px) + name + date — top row
- Stars (14px)
- Review text — body-md neutral-700
- Photos (if any): horizontal scroll, 80×80px
- Manager reply (if any): indented 12px, neutral-50 bg

## Sort selector
- Pills row: "Newest" | "Highest" | "Lowest" | "Unanswered"
- Active: primary-600 bg, white text; Inactive: neutral-100 bg, neutral-700 text
- Changing sort resets list and re-fetches

## Infinite scroll
- useInfiniteQuery hitting GET /pitches/:id/reviews
- FlatList with onEndReachedThreshold: 0.3

## Acceptance criteria
- [ ] RatingBreakdownChart bars animate on mount
- [ ] Sort selector changes query sort param, resets list
- [ ] Infinite scroll loads more reviews
- [ ] Anonymous reviews show "Anonymous player"
- [ ] Manager reply shown below review text
- [ ] Pull-to-refresh resets to first page

## Definition of done
- Animated bars tested on low-end Android (no jank)
- Extracted ReviewCard component reused between AllReviewsScreen and Pitch Detail preview
BODY

create_issue "$title" "$body" '["E07 — Reviews","type: feature","platform: mobile","priority: medium"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E07-08 — Web: Player My Reviews page
# ─────────────────────────────────────────────────────────────────────────────
title="[E07-08] [Web] Player /profile/my-reviews — submitted reviews list, edit within 24h, delete"
read -r -d '' body << 'BODY' || true
## Summary
Web page under `/profile/my-reviews` listing all player-submitted reviews. Edit form (within 24h), delete with confirm dialog. Already referenced in E06-10 but built here.

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/profile/my-reviews/page.tsx` | Create |
| `apps/web/src/app/profile/my-reviews/[id]/edit/page.tsx` | Create |

## List page
- Header: "My Reviews" — heading-xl
- Sorted newest first, no pagination (v1)
- Review card per item:
  - Pitch name + company name — heading-sm + body-sm neutral-500
  - Date played — body-sm neutral-400
  - Stars (14px warning-500)
  - Review text (collapsible after 3 lines)
  - Photos thumbnails (60×60px) if present
  - Manager reply section if present
  - Actions row: Edit pencil (if isEditable) + Delete trash
- Empty state: "No reviews yet" + CTA to discover pitches
- Auth guard → redirect `/auth/login` if no session

## Edit page `/profile/my-reviews/:id/edit`
- react-hook-form pre-populated
- Star picker (CSS hover-fill, same logic as WebStarPicker from E06-10)
- Textarea, anonymous toggle
- "Save changes" → PUT /reviews/:id → redirect to `/profile/my-reviews?updated=1`
- Shows edit deadline: "You can edit this until {editableUntil}"
- If isEditable = false (e.g. direct URL access after window): show 400 message inline

## Delete flow
- Confirm `window.confirm()` dialog → DELETE /reviews/:id → router.refresh()
- Toast: "Review deleted"

## Acceptance criteria
- [ ] All reviews listed, sorted newest first
- [ ] Edit link only shown if isEditable
- [ ] Edit form pre-filled, saves successfully
- [ ] Delete removes review from list
- [ ] Empty state correct
- [ ] Auth guard working

## Definition of done
- Matches GET /reviews/mine shape exactly (no extra API calls)
- Deleted review no longer appears on pitch detail page
BODY

create_issue "$title" "$body" '["E07 — Reviews","type: feature","platform: web","priority: medium"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E07-09 — Web: Manager reviews management page
# ─────────────────────────────────────────────────────────────────────────────
title="[E07-09] [Web] Manager reviews management — list, filter, reply inline, report"
read -r -d '' body << 'BODY' || true
## Summary
Web page in manager dashboard under `/manager/reviews`. Lists all reviews across company pitches, filtered by pitch/sort. Manager can reply inline (max 300 chars), edit reply within 24h, report abusive reviews to admin.

## Reference
- PRD §8.5
- UIUX_SPEC §13 (manager dashboard layout)

## Files to create
| File | Action |
|------|--------|
| `apps/web/src/app/manager/reviews/page.tsx` | Create |
| `apps/web/src/components/manager/ReviewReplyForm.tsx` | Create |

## Page layout (uses manager sidebar from E09)
- Filter bar:
  - "All pitches" dropdown → specific pitch selector
  - Sort: "Newest" | "Lowest rated" | "Unanswered"
  - Search (player name) — debounced 300ms
- Review cards list (max 800px wide)

## Review card (manager view)
- pitch name chip (neutral-100 bg) + player name + date + stars
- Review text (full, no truncation)
- Photo thumbnails if present
- Reply section:
  - If no reply: "Reply to this review" — text-sm primary-600 button → expands inline form
  - If reply exists: shows reply text + "Edit reply" link (if within 24h) + "Delete reply" trash icon
- Report button (flag icon, neutral-400) → opens modal with reason select + notes textarea

## ReviewReplyForm (inline)
```tsx
// Textarea: max 300 chars, character counter
// Submit: POST /reviews/:id/reply
// On success: reply appears in card, form collapses
// On error: inline error message
```

## Acceptance criteria
- [ ] Only manager's company reviews shown
- [ ] Pitch filter updates list
- [ ] Sort works: lowest-rated shows 1★ first; unanswered shows reviews with no reply first
- [ ] Reply form expands inline, submits correctly
- [ ] Reply edit visible within 24h of reply creation
- [ ] Reply delete removes reply from card
- [ ] Report modal: reason required, notes optional → submits POST /reviews/:id/report
- [ ] Auth + role guard: PLAYER cannot access /manager/* routes

## Definition of done
- Reply appears immediately (optimistic update or router.refresh())
- Report confirmation toast shown after submit
BODY

create_issue "$title" "$body" '["E07 — Reviews","type: feature","platform: web","priority: medium"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E07-10 — Web: Review display on pitch pages + SEO structured data
# ─────────────────────────────────────────────────────────────────────────────
title="[E07-10] [Web] Review display on pitch pages — full list, sort, rating breakdown, SEO schema"
read -r -d '' body << 'BODY' || true
## Summary
Enhance web pitch detail pages with full review section: rating breakdown chart, sort controls, paginated review cards with manager replies. Add JSON-LD AggregateRating structured data for SEO.

## Reference
- PRD §11
- UIUX_SPEC §6.1 (review layout)

## Files to modify / create
| File | Action |
|------|--------|
| `apps/web/src/app/pitches/[id]/reviews/page.tsx` | Create — standalone reviews page |
| `apps/web/src/components/pitch/WebRatingBreakdown.tsx` | Create |
| `apps/web/src/components/pitch/WebReviewCard.tsx` | Create |
| `apps/web/src/app/pitches/[id]/page.tsx` | Modify — add JSON-LD schema |

## WebRatingBreakdown
- CSS progress bars (not SVG): `<div>` with `width: ${pct}%`, `transition: width 0.6s ease`
- Triggered via IntersectionObserver (animate on scroll into view)
- Same data as mobile: 5 rows, star label + bar + count

## JSON-LD AggregateRating (in pitch page `<script type="application/ld+json">`)
```json
{
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  "name": "Pitch A — Demo Sports Club",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.3",
    "reviewCount": "127",
    "bestRating": "5",
    "worstRating": "1"
  }
}
```
Only include if `reviewCount >= 3` (Google requires min reviews for rich results).

## `/pitches/:id/reviews` page
- Server component: first page SSR, client-side infinite scroll for subsequent pages
- URL param: `?sort=newest|highest|lowest|unanswered`
- Back link to pitch detail
- Same review card component as pitch detail page

## Acceptance criteria
- [ ] Rating breakdown bars animate on scroll-into-view
- [ ] Sort controls update URL param + re-fetch
- [ ] Infinite scroll loads more reviews (IntersectionObserver)
- [ ] Manager replies shown indented
- [ ] Anonymous reviews show "Anonymous player"
- [ ] JSON-LD present in `<head>` only when reviewCount >= 3
- [ ] JSON-LD validates in Google Rich Results Test

## Definition of done
- Lighthouse SEO score ≥ 95 on pitch pages with reviews
- No layout shift from review section loading (skeleton placeholders match card size)
BODY

create_issue "$title" "$body" '["E07 — Reviews","type: feature","platform: web","priority: medium"]' "$MILESTONE"

echo "✓ E07 — 10 issues created"
