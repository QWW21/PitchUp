/**
 * Platform fee and no-show penalties. PRD §8 (payments) and §9.3.
 *
 * Amounts are in RON. Values are platform defaults; the admin Config panel
 * (PRD §12) can override them per environment.
 */

/** Platform commission on booking value. PRD §8: "8% of booking value". */
export const PLATFORM_FEE_PERCENT = 8

/** Flat fee charged to a player on a confirmed no-show. PRD §9.3. */
export const NO_SHOW_FLAT_FEE_RON = 10

/** Additional penalty, as a percentage of booking value. PRD §9.3. */
export const NO_SHOW_PENALTY_PERCENT = 20

/** Minutes after booking start before a manager may mark a no-show. PRD §9.3. */
export const NO_SHOW_MARK_AFTER_MINUTES = 30

/** Hours a player has to dispute a no-show. PRD §9.4. */
export const NO_SHOW_DISPUTE_WINDOW_HOURS = 24
