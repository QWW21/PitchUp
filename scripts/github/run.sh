#!/usr/bin/env bash
# run.sh — PitchUp GitHub issue creation runner
#
# Usage:
#   GITHUB_TOKEN=xxx bash scripts/github/run.sh setup        # create labels + milestones (run once)
#   GITHUB_TOKEN=xxx bash scripts/github/run.sh e01          # create E01 infrastructure issues
#   GITHUB_TOKEN=xxx bash scripts/github/run.sh setup e01    # both at once
#
# Prerequisites:
#   - jq installed (brew install jq)
#   - GITHUB_TOKEN env var set (PAT with repo scope)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

if [[ $# -eq 0 ]]; then
  echo "Usage: GITHUB_TOKEN=xxx bash scripts/github/run.sh <command> [command...]"
  echo ""
  echo "Commands:"
  echo "  setup   Create all labels and milestones (run once)"
  echo "  e01     Create E01 — Infrastructure issues"
  echo "  e02     Create E02 — Auth issues"
  echo "  e03     Create E03 — Player: Discover issues"
  echo "  e04     Create E04 — Player: Pitch Detail issues"
  echo "  e05     Create E05 — Player: Booking Flow issues"
  echo "  e06     Create E06 — Player: My Bookings issues"
  echo "  e07     Create E07 — Player: Profile & Trust issues"
  echo "  e08     Create E08 — Player: Profile issues"
  echo "  e09     Create E09 — Manager: Onboarding issues"
  echo "  e10     Create E10 — Manager: Pitch Mgmt issues"
  echo "  e11     Create E11 — Manager: Booking Mgmt issues"
  echo "  e12     Create E12 — Penalty & Trust issues"
  echo "  e13     Create E13 — Notifications issues"
  echo "  e14     Create E14 — Analytics issues"
  echo "  e15     Create E15 — Admin Panel issues"
  echo ""
  exit 1
fi

check_token

for cmd in "$@"; do
  case "$cmd" in
    setup)
      echo ""
      echo "▶ Running setup (labels + milestones)..."
      bash "$SCRIPT_DIR/setup.sh"
      ;;
    e01)
      echo ""
      echo "▶ Creating E01 — Infrastructure issues..."
      source "$SCRIPT_DIR/epics/e01.sh"
      ;;
    e02)
      echo ""
      echo "▶ Creating E02 — Auth issues..."
      source "$SCRIPT_DIR/epics/e02.sh"
      ;;
    e03)
      echo ""
      echo "▶ Creating E03 — Player: Discover issues..."
      source "$SCRIPT_DIR/epics/e03.sh"
      ;;
    e04)
      echo ""
      echo "▶ Creating E04 — Player: Pitch Detail issues..."
      source "$SCRIPT_DIR/epics/e04.sh"
      ;;
    e05)
      echo ""
      echo "▶ Creating E05 — Player: Booking Flow issues..."
      source "$SCRIPT_DIR/epics/e05.sh"
      ;;
    e06)
      echo ""
      echo "▶ Creating E06 — Player: My Bookings issues..."
      source "$SCRIPT_DIR/epics/e06.sh"
      ;;
    e07)
      echo ""
      echo "▶ Creating E07 — Player: Profile & Trust issues..."
      source "$SCRIPT_DIR/epics/e07.sh"
      ;;
    e08)
      echo ""
      echo "▶ Creating E08 — Player: Profile issues..."
      source "$SCRIPT_DIR/epics/e08.sh"
      ;;
    e09)
      echo ""
      echo "▶ Creating E09 — Manager: Onboarding issues..."
      source "$SCRIPT_DIR/epics/e09.sh"
      ;;
    e10)
      echo ""
      echo "▶ Creating E10 — Manager: Pitch Mgmt issues..."
      source "$SCRIPT_DIR/epics/e10.sh"
      ;;
    e11)
      echo ""
      echo "▶ Creating E11 — Manager: Booking Mgmt issues..."
      source "$SCRIPT_DIR/epics/e11.sh"
      ;;
    e12)
      echo ""
      echo "▶ Creating E12 — Penalty & Trust issues..."
      source "$SCRIPT_DIR/epics/e12.sh"
      ;;
    e13)
      echo ""
      echo "▶ Creating E13 — Notifications issues..."
      source "$SCRIPT_DIR/epics/e13.sh"
      ;;
    e14)
      echo ""
      echo "▶ Creating E14 — Analytics issues..."
      source "$SCRIPT_DIR/epics/e14.sh"
      ;;
    e15)
      echo ""
      echo "▶ Creating E15 — Admin Panel issues..."
      source "$SCRIPT_DIR/epics/e15.sh"
      ;;
    *)
      echo "Unknown command: $cmd"
      exit 1
      ;;
  esac
done

echo ""
echo "═══════════════════════════════════════════════"
echo "  Done. View issues: https://github.com/$REPO/issues"
echo "═══════════════════════════════════════════════"
