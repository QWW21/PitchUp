/** Booking rules. PRD §7 and §15. */
export const BOOKING = {
  /** Default ceiling on how far ahead a pitch can be booked. */
  MAX_ADVANCE_DAYS_DEFAULT: 60,
  MIN_DURATION_HOURS: 1,
  MAX_DURATION_HOURS: 4,
  /** A booking must start and end on the same calendar day. PRD §15. */
  ALLOW_SPANNING_MIDNIGHT: false,
  /** Teams per booking, used by the Teams & Shirts step. UIUX_SPEC §7.3. */
  MIN_TEAM_COUNT: 2,
  MAX_TEAM_COUNT: 3,
  MAX_PLAYERS_PER_TEAM: 15,
  MAX_NOTE_LENGTH: 200,
} as const
