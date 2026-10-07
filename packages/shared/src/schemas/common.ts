import { z } from 'zod'

/** Prisma ids are cuid. */
export const idSchema = z.string().cuid()

/** E.164: + followed by 8-15 digits. PRD §6.1. */
export const phoneSchema = z
  .string()
  .regex(/^\+\d{8,15}$/, 'Phone must include country code, e.g. +40712345678')

export const emailSchema = z.string().email()

/** PRD §6.1: min 8 chars, 1 uppercase, 1 number. */
export const passwordSchema = z
  .string()
  .min(8, 'Must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/\d/, 'Must contain a number')

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export type Pagination = z.infer<typeof paginationSchema>
