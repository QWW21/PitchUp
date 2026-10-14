/**
 * Is a venue open at a given instant — E03-01. The implementation moved to
 * @pitchup/shared (schedule.ts) in E04 so the clients' "Open · Closes at"
 * line uses the same rules; this re-export keeps the existing import path.
 */
export { isOpenAt } from '@pitchup/shared'
