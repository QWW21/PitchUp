import { z } from 'zod'
import { emailSchema, phoneSchema } from './common'

/** One opening interval. Times are local "HH:MM" wall clock for the venue. */
const workingHoursEntrySchema = z.object({
  /** 0 = Sunday … 6 = Saturday. */
  day: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM'),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM'),
  isClosed: z.boolean().default(false),
})

export const WorkingHoursSchema = z.array(workingHoursEntrySchema).max(7)

export const CreateCompanySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(500).optional(),
  phone: phoneSchema,
  email: emailSchema,
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1),
  country: z.string().length(2).default('RO'),
  postalCode: z.string().max(20).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  websiteUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  workingHours: WorkingHoursSchema.optional(),
})

export const UpdateCompanySchema = CreateCompanySchema.partial().refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
)

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>
export type WorkingHours = z.infer<typeof WorkingHoursSchema>
