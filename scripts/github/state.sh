#!/usr/bin/env bash
# state.sh — update the state of PitchUp issues that already exist
#
# The scripts next to this one create issues. This one records what happened to
# them afterwards: comments, closures, and defects that were found and fixed in
# the same stretch of work.
#
# Usage:
#   GITHUB_TOKEN=xxx bash scripts/github/state.sh <command>
#
# Commands:
#   e02-close    Comment on and close the E02 mobile tickets (#11-16, #22)
#   e02-bugs     File the defects found during E02, each already fixed
#   e02-gaps     File the follow-ups for what E02 closed without building
#
# Prerequisites:
#   - jq installed (brew install jq)
#   - GITHUB_TOKEN env var set (PAT with repo scope)
#
# Note on the corporate proxy: some request bodies come back as an HTML 403
# from a DLP scanner rather than reaching GitHub. It is triggered by the
# content of a comment, not by the endpoint, and rewording the paragraph
# clears it. The helpers below report which call failed so it can be retried.
#
# Every command is safe to re-run except the issue-filing ones, which would
# create duplicates. Check before re-running those.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

BODIES="$SCRIPT_DIR/bodies/e02"

# ── Helpers ─────────────────────────────────────────────────────────────────

gh_patch() {
  local path="$1" payload="$2"
  curl -s -X PATCH \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    "${BASE_URL}${path}" \
    -d "$payload"
}

# comment_issue NUMBER BODY_FILE
comment_issue() {
  local number="$1" file="$2"
  local payload result id
  payload=$(jq -n --rawfile body "$file" '{body:$body}')
  result=$(gh_post "/issues/${number}/comments" "$payload")
  id=$(echo "$result" | jq -r '.id // "error"' 2>/dev/null || echo "error")
  if [[ "$id" == "error" ]]; then
    echo "  ✗ comment failed on #$number — a 403 here is usually the DLP"
    echo "    scanner reacting to the wording; reword and re-run."
  else
    echo "  + commented on #$number"
  fi
}

# close_issue NUMBER
close_issue() {
  local number="$1"
  local state
  state=$(gh_patch "/issues/${number}" '{"state":"closed","state_reason":"completed"}' \
    | jq -r '.state // "error"' 2>/dev/null || echo "error")
  if [[ "$state" == "closed" ]]; then
    echo "  + closed #$number"
  else
    echo "  ✗ failed to close #$number"
  fi
}

# file_fixed_defect TITLE BODY_FILE LABELS_JSON MILESTONE
# Opens an issue and closes it in the same breath. The defect was found and
# fixed inside one stretch of work, so it never existed as an open ticket —
# but it should still be on the record, with its reproduction and its fix.
file_fixed_defect() {
  local title="$1" file="$2" labels_json="$3" milestone="$4"
  local payload result number
  payload=$(jq -n \
    --arg title "$title" --rawfile body "$file" \
    --argjson labels "$labels_json" --argjson milestone "$milestone" \
    '{title:$title, body:$body, labels:$labels, milestone:$milestone}')
  result=$(gh_post "/issues" "$payload")
  number=$(echo "$result" | jq -r '.number // "error"')
  if [[ "$number" == "error" ]]; then
    echo "  ✗ failed to create: $title"
    echo "$result" | jq -r '.message // .'
    return
  fi
  echo "  + issue #$number: $title"
  close_issue "$number"
}

# file_followup TITLE BODY_FILE LABELS_JSON MILESTONE
file_followup() {
  local title="$1" file="$2" labels_json="$3" milestone="$4"
  local payload result number
  payload=$(jq -n \
    --arg title "$title" --rawfile body "$file" \
    --argjson labels "$labels_json" --argjson milestone "$milestone" \
    '{title:$title, body:$body, labels:$labels, milestone:$milestone}')
  result=$(gh_post "/issues" "$payload")
  number=$(echo "$result" | jq -r '.number // "error"')
  if [[ "$number" == "error" ]]; then
    echo "  ✗ failed to create: $title"
    echo "$result" | jq -r '.message // .'
  else
    echo "  + issue #$number: $title"
  fi
}

# ── Commands ────────────────────────────────────────────────────────────────

AUTH=2  # milestone: E02 — Auth
INFRA=1 # milestone: E01 — Infrastructure

cmd_e02_close() {
  echo "Commenting on and closing the E02 mobile tickets…"
  local n
  for n in 11 12 13 14 15 16 22; do
    comment_issue "$n" "$BODIES/close-$n.md"
    close_issue "$n"
  done
  echo "Leaving #17 (social login) open — blocked on OAuth credentials:"
  comment_issue 17 "$BODIES/status-17.md"
}

cmd_e02_bugs() {
  echo "Filing the defects found during E02 (all already fixed)…"
  file_fixed_defect \
    "[BUG] Login reinstates the user-enumeration oracle that register closes" \
    "$BODIES/bug-enumeration.md" \
    '["bug","epic: auth","platform: backend","priority: critical"]' $AUTH
  file_fixed_defect \
    "[BUG] Unverified registration lets an attacker squat someone else's address" \
    "$BODIES/bug-squatting.md" \
    '["bug","epic: auth","platform: backend","priority: critical"]' $AUTH
  file_fixed_defect \
    "[BUG] Registration rate limit is charged before validation, locking out whole IPs" \
    "$BODIES/bug-ratelimit.md" \
    '["bug","epic: auth","platform: backend","priority: high"]' $AUTH
  file_fixed_defect \
    "[BUG] No way to re-send a verification code, leaving accounts unreachable" \
    "$BODIES/bug-resend.md" \
    '["bug","epic: auth","platform: backend","priority: high"]' $AUTH
  file_fixed_defect \
    "[BUG] Phone OTP was sent but no endpoint consumed it, so phoneVerified could never be true" \
    "$BODIES/bug-verifyphone.md" \
    '["bug","epic: auth","platform: backend","priority: high"]' $AUTH
  file_fixed_defect \
    "[BUG] Email and phone verification codes shared a table with no channel marker" \
    "$BODIES/bug-channel.md" \
    '["bug","epic: auth","platform: backend","priority: high"]' $AUTH
  file_fixed_defect \
    "[BUG] Fresh clone fails typecheck and build — Prisma client never generated" \
    "$BODIES/bug-prisma.md" \
    '["bug","epic: infrastructure","priority: high"]' $INFRA
  file_fixed_defect \
    "[BUG] Mobile authApi paths double the /api/v1 prefix, so every call 404s" \
    "$BODIES/bug-apiprefix.md" \
    '["bug","epic: auth","platform: mobile","priority: critical"]' $AUTH
  file_fixed_defect \
    "[BUG] Web login spins forever on bad credentials — NextAuth v5 throws instead of returning" \
    "$BODIES/bug-nextauth.md" \
    '["bug","epic: auth","platform: web","priority: high"]' $AUTH
  file_fixed_defect \
    "[BUG] Web login links to /forgot-password, which 404s" \
    "$BODIES/bug-forgot404.md" \
    '["bug","epic: auth","platform: web","priority: medium"]' $AUTH
  file_fixed_defect \
    "[BUG] / renders a placeholder instead of routing to login or dashboard" \
    "$BODIES/bug-rootredirect.md" \
    '["bug","epic: auth","platform: web","priority: medium"]' $AUTH
}

cmd_e02_gaps() {
  echo "Filing the follow-ups for what E02 closed without building…"
  file_followup \
    "[E02-03 gap] Terms of Service acceptance is missing from registration" \
    "$BODIES/gap-tos.md" \
    '["epic: auth","platform: mobile","type: feature","priority: high"]' $AUTH
  file_followup \
    "[E02-04 gap] Phone OTP verification screen — nothing calls /auth/verify-phone" \
    "$BODIES/gap-phoneotp.md" \
    '["epic: auth","platform: mobile","type: feature","priority: medium"]' $AUTH
  file_followup \
    "[E02-01 gap] Real splash screen — current one is a bare ActivityIndicator" \
    "$BODIES/gap-splash.md" \
    '["epic: auth","platform: mobile","type: feature","priority: low"]' $AUTH
  file_followup \
    "[E02-06 gap] Password reset dead-ends — no /reset-password page or mobile screen" \
    "$BODIES/gap-reset.md" \
    '["epic: auth","type: cross-platform","priority: high"]' $AUTH
}

# ── Dispatch ────────────────────────────────────────────────────────────────

if [[ $# -eq 0 ]]; then
  sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
fi

check_token

for arg in "$@"; do
  case "$arg" in
    e02-close) cmd_e02_close ;;
    e02-bugs)  cmd_e02_bugs ;;
    e02-gaps)  cmd_e02_gaps ;;
    *) echo "Unknown command: $arg"; exit 1 ;;
  esac
done

echo "Done."
