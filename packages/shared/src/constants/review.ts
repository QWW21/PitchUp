/** Review rules. PRD §11. */
export const REVIEW = {
  MIN_RATING: 1,
  MAX_RATING: 5,
  /** Review text is optional (PRD §15: "Rating with no text" is allowed). */
  MAX_TEXT_LENGTH: 500,
  MAX_PHOTOS: 3,
  /** Review window opens at booking end and closes this many days later. PRD §11.1. */
  SUBMIT_WINDOW_DAYS: 14,
  /** Reviews below this count are not shown publicly. PRD §11.2. */
  MIN_FOR_PUBLIC_RATING: 3,
  MAX_MANAGER_REPLY_LENGTH: 500,
  /** Free-text length for a no-show dispute. PRD §9.4. */
  MAX_DISPUTE_TEXT_LENGTH: 300,
} as const
