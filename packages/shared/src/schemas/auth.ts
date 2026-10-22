import { z } from 'zod'
import { AUTH } from '../constants/auth'
import { emailSchema, passwordSchema, phoneSchema } from './common'

/**
 * Age check against a calendar date string (YYYY-MM-DD).
 *
 * Counts whole years rather than dividing by 365.25, so a player whose 16th
 * birthday is today passes and one whose birthday is tomorrow does not.
 */
function isAtLeastMinAge(dateOfBirth: string): boolean {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`)
  if (Number.isNaN(dob.getTime())) return false

  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const birthdayAtMinAge = Date.UTC(
    dob.getUTCFullYear() + AUTH.MIN_AGE_YEARS,
    dob.getUTCMonth(),
    dob.getUTCDate()
  )
  return birthdayAtMinAge <= todayUtc
}

const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'v.dateFormat')
  .refine(value => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), {
    message: 'v.validDate',
  })
  .refine(value => new Date(`${value}T00:00:00Z`) <= new Date(), {
    message: 'v.dobFuture',
  })
  .refine(isAtLeastMinAge, {
    message: 'v.minAge',
  })

/** Shown under the name field on web and mobile, so it is worded for people. */
const nameSchema = z.string().trim().min(2, 'v.fullName').max(100, 'v.nameTooLong')

export const RegisterPlayerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  city: z.string().min(1),
  dateOfBirth: dateOfBirthSchema,
})

export const RegisterManagerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
})

export const LoginSchema = z.object({
  /** Trimmed, so ' a@x.ro' signs in, and counts against, the same address (#188). */
  email: z.string().trim().email(),
  /** Not passwordSchema: never reveal policy details on the login form. */
  password: z.string().min(1, 'v.passwordRequired'),
})

export const ForgotPasswordSchema = z.object({
  email: emailSchema,
})

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'v.passwordsMismatch',
    path: ['confirmPassword'],
  })

export const VerifyOtpSchema = z.object({
  code: z.string().regex(new RegExp(`^\\d{${AUTH.OTP_LENGTH}}$`), 'v.otpDigits'),
})

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'v.passwordsMismatch',
    path: ['confirmPassword'],
  })

/**
 * Google sign-in from the app. The first attempt sends only the ID token; an
 * address with no PitchUp account answers PROFILE_NEEDED, and the app asks
 * for what Google does not know (phone, city, date of birth) and sends the
 * token again with `profile`.
 */
export const GoogleSignInSchema = z.object({
  idToken: z.string().min(20).max(4096),
  profile: RegisterPlayerSchema.pick({ phone: true, city: true, dateOfBirth: true }).optional(),
})

export type RegisterPlayerInput = z.infer<typeof RegisterPlayerSchema>
export type RegisterManagerInput = z.infer<typeof RegisterManagerSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>
export type GoogleSignInInput = z.infer<typeof GoogleSignInSchema>
