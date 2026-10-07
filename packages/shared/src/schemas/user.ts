import { z } from 'zod'
import { emailSchema, phoneSchema } from './common'

/**
 * Profile edit. PRD §6.5 — changing email or phone triggers re-verification,
 * which the API layer handles; this schema only validates shape.
 */
export const UpdateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    phone: phoneSchema,
    city: z.string().min(1),
    profilePhotoUrl: z.string().url().nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const UserProfileSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  email: emailSchema,
  phone: phoneSchema,
  city: z.string().nullable(),
  profilePhotoUrl: z.string().url().nullable(),
  role: z.enum(['PLAYER', 'MANAGER', 'ADMIN']),
  trustScore: z.number().int().min(0).max(100),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
})

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type UserProfile = z.infer<typeof UserProfileSchema>
