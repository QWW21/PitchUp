import { z } from 'zod'
import { CITY_NAMES } from '../constants/cities'
import type { TrustScoreReason, TrustTierLabel, UserRole } from '../types'
import { passwordSchema, phoneSchema } from './common'

/** Where profile photos may live: only our Cloudinary account's delivery host. */
export const AVATAR_URL_PREFIX = 'https://res.cloudinary.com/'

/**
 * PUT /profile — E08-01. Every field optional; email and role are not here,
 * so they cannot be changed this way. `avatarUrl: null` removes the photo.
 */
export const UpdateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Enter your full name')
      .max(100, 'Name must be 100 characters or fewer'),
    phone: phoneSchema,
    city: z.string().refine(c => CITY_NAMES.includes(c), 'Choose a city from the list'),
    avatarUrl: z
      .string()
      .url()
      .refine(u => u.startsWith(AVATAR_URL_PREFIX), 'Upload the photo through PitchUp')
      .nullable(),
  })
  .partial()
  .refine(data => Object.keys(data).length > 0, {
    message: 'Change at least one field',
  })

/** POST /profile/change-password — E08-03. */
export const ChangeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
  })
  .refine(d => d.newPassword !== d.currentPassword, {
    message: 'Choose a password different from the current one',
    path: ['newPassword'],
  })

/** DELETE /profile — E08-03. */
export const DeleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password'),
  reason: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(300).optional()
  ),
})

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
export type ChangeOwnPasswordInput = z.infer<typeof ChangeOwnPasswordSchema>
export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>

/** GET /profile — E08-01. No password hash, Stripe id or tokens, ever. */
export interface Profile {
  id: string
  name: string
  email: string
  phone: string
  city: string | null
  avatarUrl: string | null
  role: UserRole
  emailVerified: boolean
  phoneVerified: boolean
  trustScore: number
  trustTier: TrustTierLabel
  createdAt: string
}

/** One line of the score history. */
export interface TrustEvent {
  id: string
  delta: number
  reason: TrustScoreReason
  label: string
  bookingId: string | null
  createdAt: string
}

/** GET /profile/trust-score?cursor= — E08-02. */
export interface TrustScoreDetail {
  score: number
  tier: TrustTierLabel
  tierDescription: string
  canBook: boolean
  maxActiveBookings: number | null
  requiresCardOnFile: boolean
  requiresUpfrontDeposit: boolean
  events: TrustEvent[]
  nextCursor: string | null
  hasMore: boolean
  tiers: { name: TrustTierLabel; range: string; description: string; colour: string }[]
}
