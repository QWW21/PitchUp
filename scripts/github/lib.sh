#!/usr/bin/env bash
# lib.sh — shared helpers for PitchUp GitHub issue creation scripts
# Usage: source this file, then call helpers

set -euo pipefail

REPO="${REPO:-QWW21/PitchUp}"
BASE_URL="https://api.github.com/repos/${REPO}"

# ── Auth check ──────────────────────────────────────────────────────────────

check_token() {
  if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    echo "ERROR: GITHUB_TOKEN not set. Run: GITHUB_TOKEN=your_pat bash scripts/github/run.sh <command>"
    exit 1
  fi
  local status
  status=$(curl -sk -o /dev/null -w "%{http_code}" \
    -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/user")
  if [[ "$status" != "200" ]]; then
    echo "ERROR: GitHub token invalid or API unreachable (HTTP $status)"
    exit 1
  fi
  echo "✓ GitHub token valid"
}

# ── API helpers ─────────────────────────────────────────────────────────────

gh_post() {
  local path="$1"
  local payload="$2"
  curl -sk -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    -H "Content-Type: application/json" \
    "${BASE_URL}${path}" \
    -d "$payload"
}

gh_get() {
  local path="$1"
  curl -sk \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "${BASE_URL}${path}"
}

# ── Labels ───────────────────────────────────────────────────────────────────

create_label() {
  local name="$1"
  local color="$2"   # hex without #
  local description="$3"
  local payload
  payload=$(jq -n \
    --arg name "$name" \
    --arg color "$color" \
    --arg description "$description" \
    '{name:$name, color:$color, description:$description}')
  local result
  result=$(gh_post "/labels" "$payload")
  local label_name
  label_name=$(echo "$result" | jq -r '.name // "error"')
  if [[ "$label_name" == "error" ]]; then
    # 422 = already exists, that's fine
    echo "  ~ label already exists: $name"
  else
    echo "  + label created: $name"
  fi
}

# ── Milestones ───────────────────────────────────────────────────────────────

create_milestone() {
  local title="$1"
  local description="$2"
  local payload
  payload=$(jq -n \
    --arg title "$title" \
    --arg description "$description" \
    '{title:$title, description:$description, state:"open"}')
  local result
  result=$(gh_post "/milestones" "$payload")
  local number
  number=$(echo "$result" | jq -r '.number // "error"')
  if [[ "$number" == "error" ]]; then
    echo "  ~ milestone already exists: $title"
  else
    echo "  + milestone created: $title (#$number)"
  fi
}

get_milestone_number() {
  local title="$1"
  gh_get "/milestones?per_page=100" \
    | jq -r ".[] | select(.title == \"$title\") | .number"
}

# ── Issues ───────────────────────────────────────────────────────────────────

# create_issue TITLE BODY LABELS_JSON MILESTONE_NUMBER
# LABELS_JSON example: '["epic: infrastructure","priority: critical","type: infra"]'
create_issue() {
  local title="$1"
  local body="$2"
  local labels_json="$3"
  local milestone="$4"

  local payload
  payload=$(jq -n \
    --arg title "$title" \
    --arg body "$body" \
    --argjson labels "$labels_json" \
    --argjson milestone "$milestone" \
    '{title:$title, body:$body, labels:$labels, milestone:$milestone}')

  local result
  result=$(gh_post "/issues" "$payload")
  local number
  number=$(echo "$result" | jq -r '.number // "error"')
  if [[ "$number" == "error" ]]; then
    echo "  ✗ failed to create issue: $title"
    echo "$result" | jq -r '.message // .'
  else
    echo "  + issue #$number: $title"
  fi
}
