/** Auth and security parameters. PRD §6.1, §6.3, §6.6. */
export const AUTH = {
  /** bcrypt work factor. PRD §6.6 — non-negotiable. */
  BCRYPT_COST: 12,
  PASSWORD_MIN_LENGTH: 8,
  /** Minimum age to register. PRD §6.1. */
  MIN_AGE_YEARS: 16,
  EMAIL_VERIFICATION_EXPIRY_MINUTES: 15,
  PHONE_OTP_EXPIRY_MINUTES: 10,
  PASSWORD_RESET_EXPIRY_MINUTES: 60,
  OTP_LENGTH: 6,
  /** Rate limit on login. PRD §6.6: 5 attempts per 15 min per IP. */
  LOGIN_RATE_LIMIT_ATTEMPTS: 5,
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: 15,
} as const
