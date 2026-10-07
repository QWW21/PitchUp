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
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format')
  .refine(value => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), {
    message: 'Must be a valid date',
  })
  .refine(value => new Date(`${value}T00:00:00Z`) <= new Date(), {
    message: 'Date of birth cannot be in the future',
  })
  .refine(isAtLeastMinAge, {
    message: `Must be at least ${AUTH.MIN_AGE_YEARS} years old`,
  })

export const RegisterPlayerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  city: z.string().min(1),
  dateOfBirth: dateOfBirthSchema,
})

export const RegisterManagerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
})

export const LoginSchema = z.object({
  email: emailSchema,
  /** Not passwordSchema: never reveal policy details on the login form. */
  password: z.string().min(1, 'Password is required'),
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
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const VerifyOtpSchema = z.object({
  code: z
    .string()
    .regex(new RegExp(`^\\d{${AUTH.OTP_LENGTH}}$`), `Code must be ${AUTH.OTP_LENGTH} digits`),
})

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegisterPlayerInput = z.infer<typeof RegisterPlayerSchema>
export type RegisterManagerInput = z.infer<typeof RegisterManagerSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>
