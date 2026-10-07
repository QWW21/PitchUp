#!/usr/bin/env bash
# setup.sh — create all labels and milestones for PitchUp
# Run once before creating any issues.
# Usage: GITHUB_TOKEN=xxx bash scripts/github/setup.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

check_token

echo ""
echo "═══════════════════════════════════════"
echo "  Creating labels"
echo "═══════════════════════════════════════"

# ── Epic labels ──────────────────────────────────────────────────────────────
echo "→ Epic labels"
create_label "epic: infrastructure"       "0075ca" "E01 — DB, Prisma, shared packages, env, tooling"
create_label "epic: auth"                 "e4e669" "E02 — Registration, login, OTP, password reset"
create_label "epic: player-discover"      "a2eeef" "E03 — Location, city selector, company list, map, filters"
create_label "epic: player-pitch-detail"  "d4c5f9" "E04 — Company detail, pitch detail, gallery, amenities"
create_label "epic: player-booking-flow"  "f9d0c4" "E05 — 5-step booking modal, Stripe payment"
create_label "epic: player-bookings"      "c2e0c6" "E06 — My Bookings tabs, booking detail, cancel"
create_label "epic: reviews"              "fef2c0" "E07 — Submit, edit, delete review, manager reply"
create_label "epic: player-profile"       "bfd4f2" "E08 — Profile, trust score display, payment methods"
create_label "epic: manager-onboarding"   "e4f4f0" "E09 — Company wizard, Stripe Connect, admin approval"
create_label "epic: manager-pitch-mgmt"   "f4e4f0" "E10 — Pitch CRUD, photos, amenities, pricing, shirts"
create_label "epic: manager-booking-mgmt" "e4e4f4" "E11 — Calendar, booking list, no-show marking"
create_label "epic: penalty-trust"        "f4f4e4" "E12 — Trust score engine, no-show, dispute flow"
create_label "epic: notifications"        "f4e4e4" "E13 — Push, email, SMS, preferences"
create_label "epic: analytics"            "e4f4e4" "E14 — Revenue chart, occupancy heatmap, performance table"
create_label "epic: admin"                "f4e4f4" "E15 — Admin panel: companies, users, disputes, config"

# ── Priority labels ───────────────────────────────────────────────────────────
echo "→ Priority labels"
create_label "priority: critical" "b60205" "Blocks other work — must be done first"
create_label "priority: high"     "e11d48" "Core feature, needed for MVP"
create_label "priority: medium"   "f97316" "Important but not blocking"
create_label "priority: low"      "84cc16" "Nice-to-have, can defer"

# ── Type labels ───────────────────────────────────────────────────────────────
echo "→ Type labels"
create_label "type: backend"          "0052cc" "API route, DB query, server logic"
create_label "type: frontend-web"     "5319e7" "Next.js UI — React component, page, layout"
create_label "type: frontend-mobile"  "006b75" "React Native screen or component"
create_label "type: infra"            "1d76db" "Config, tooling, CI, deployment, env"
create_label "type: design-system"    "e4d0ff" "Shared UI token, component, or pattern"
create_label "type: cross-platform"   "0e8a16" "Touches both web and mobile"

# ── Status labels ─────────────────────────────────────────────────────────────
echo "→ Status labels"
create_label "status: blocked"      "b60205" "Waiting on another ticket or external dependency"
create_label "status: needs-spec"   "fbca04" "Requires further design or product clarification"
create_label "status: in-progress"  "0075ca" "Actively being worked on"

echo ""
echo "═══════════════════════════════════════"
echo "  Creating milestones"
echo "═══════════════════════════════════════"

create_milestone "E01 — Infrastructure"          "DB, Prisma schema, shared Zod schemas, env validation, tooling, API base layer, NextAuth, Cloudinary"
create_milestone "E02 — Auth"                    "Player + Manager register/login, email/phone verification, OTP, password reset, social login (Google, Apple)"
create_milestone "E03 — Player: Discover"        "Location detection, city selector, company list, map view, search, filters, sort"
create_milestone "E04 — Player: Pitch Detail"    "Company detail screen, pitch detail screen, photo gallery, amenities, pricing, availability preview"
create_milestone "E05 — Player: Booking Flow"    "5-step booking modal (date → time → teams/shirts → payment → confirmation), Stripe payment intent"
create_milestone "E06 — Player: My Bookings"     "My Bookings tabs (upcoming/past/cancelled), booking detail, cancel booking, refund flow"
create_milestone "E07 — Reviews"                 "Submit review, edit/delete, manager reply, rating calculation, profanity moderation"
create_milestone "E08 — Player: Profile"         "Profile screen, edit personal info, trust score display, payment methods, notification prefs"
create_milestone "E09 — Manager: Onboarding"     "Company setup wizard (4 steps), Stripe Connect, admin approval flow, awaiting-approval screen"
create_milestone "E10 — Manager: Pitch Mgmt"     "Pitch CRUD, photo upload (Cloudinary), amenities, pricing tiers, shirt inventory, availability schedule"
create_milestone "E11 — Manager: Booking Mgmt"   "Calendar view, booking list, booking detail (manager view), no-show marking, contact player"
create_milestone "E12 — Penalty & Trust"         "Trust score engine, cancellation fee rules, no-show process, dispute form, admin dispute resolution"
create_milestone "E13 — Notifications"           "Push (FCM), email (Resend), SMS (Twilio), all 15 event types, notification prefs"
create_milestone "E14 — Analytics"               "Manager dashboard: revenue chart, occupancy heatmap, pitch performance table, no-show report"
create_milestone "E15 — Admin Panel"             "Companies, users, disputes, flagged reviews, platform config, manual trust score adjustment"

echo ""
echo "✓ Setup complete — labels and milestones created"
echo "  Next: GITHUB_TOKEN=xxx bash scripts/github/run.sh e01"
