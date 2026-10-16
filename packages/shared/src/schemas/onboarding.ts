import { z } from 'zod'
import { CITY_NAMES } from '../constants/cities'
import { toMinutes } from '../schedule'
import { emailSchema, phoneSchema } from './common'

/**
 * Manager onboarding — E09, PRD §8.1. Four steps: company info, location,
 * contact and hours, payouts (Stripe Connect). The same schemas check the
 * forms on the web and the API.
 */

export const ONBOARDING_STEPS = ['info', 'location', 'contact-hours', 'stripe'] as const
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]
export const ONBOARDING_STEP_LABELS: Record<OnboardingStep, string> = {
  info: 'Company info',
  location: 'Location',
  'contact-hours': 'Contact & hours',
  stripe: 'Payouts',
}

/** Blank strings and null count as "not given". */
const blankToUndefined = (v: unknown) =>
  v === null || (typeof v === 'string' && v.trim() === '') ? undefined : v
const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional())
const optionalUrl = z.preprocess(
  blankToUndefined,
  z.string().trim().url('Enter a full address, starting with https://').max(300).optional()
)

/** Step 1 — PRD §8.1. The logo is optional: a venue may not have one yet. */
export const CompanyInfoSchema = z.object({
  name: z.string().trim().min(2, 'Enter the company name').max(80, 'At most 80 characters'),
  description: optionalText(500),
  logoUrl: z.preprocess(
    blankToUndefined,
    z
      .string()
      .url()
      .refine(u => u.startsWith('https://res.cloudinary.com/'), 'Upload the logo through PitchUp')
      .optional()
  ),
  websiteUrl: optionalUrl,
  facebookUrl: optionalUrl,
  instagramUrl: optionalUrl,
})

/**
 * Step 2. Coordinates come from the map pin (geocoded in the browser, then
 * possibly dragged); without them the server tries to geocode the address.
 */
export const CompanyLocationSchema = z
  .object({
    addressLine1: z
      .string()
      .trim()
      .min(5, 'Enter the street and number')
      .max(100, 'At most 100 characters'),
    addressLine2: optionalText(100),
    city: z.string().refine(c => CITY_NAMES.includes(c), 'Choose a city from the list'),
    county: z.string().trim().min(2, 'Enter the county').max(60),
    postalCode: z.string().trim().min(4, 'Enter the postal code').max(10, 'At most 10 characters'),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine(d => (d.lat === undefined) === (d.lng === undefined), {
    message: 'Send both coordinates or neither',
    path: ['lat'],
  })

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')

/**
 * Step 3. Hours are the same shape the rest of the app reads (Discover's
 * "open now", the booking calendar): one entry per day, 0 = Sunday. A close
 * time earlier than the open time means closing after midnight.
 */
export const OnboardingHoursSchema = z
  .array(
    z.object({
      day: z.number().int().min(0).max(6),
      openTime: time,
      closeTime: time,
      isClosed: z.boolean(),
    })
  )
  .length(7, 'Give hours for all seven days')
  .superRefine((days, ctx) => {
    if (new Set(days.map(d => d.day)).size !== 7) {
      ctx.addIssue({ code: 'custom', message: 'Give hours for all seven days' })
    }
    days.forEach((d, i) => {
      if (!d.isClosed && toMinutes(d.openTime) === toMinutes(d.closeTime)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Closing time must differ from opening time',
          path: [i, 'closeTime'],
        })
      }
    })
    if (days.every(d => d.isClosed)) {
      ctx.addIssue({ code: 'custom', message: 'Open on at least one day' })
    }
  })

export const ContactHoursSchema = z.object({
  phone: phoneSchema,
  email: emailSchema.max(100),
  workingHours: OnboardingHoursSchema,
})

/** What an admin writes when sending a venue back. */
export const RejectCompanySchema = z.object({
  reason: z.string().trim().min(5, 'Say what needs fixing').max(500),
})

export type CompanyInfoInput = z.infer<typeof CompanyInfoSchema>
export type CompanyLocationInput = z.infer<typeof CompanyLocationSchema>
export type ContactHoursInput = z.infer<typeof ContactHoursSchema>
export type OnboardingHours = z.infer<typeof OnboardingHoursSchema>

/** GET /onboarding/status — E09-05. */
export interface OnboardingStatus {
  companyId: string | null
  companyStatus: 'DRAFT' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | null
  completedSteps: OnboardingStep[]
  stripeConnected: boolean
  /** The next step to do, 1–4; null once everything is submitted. */
  currentStep: 1 | 2 | 3 | 4 | null
  /** Set when an admin sent the venue back. */
  rejectionReason: string | null
}

/** Defaults offered in step 3 (E09-08): weekdays 08–23, weekends 08–22. */
export const DEFAULT_ONBOARDING_HOURS: OnboardingHours = [0, 1, 2, 3, 4, 5, 6].map(day => ({
  day,
  openTime: '08:00',
  closeTime: day === 0 || day === 6 ? '22:00' : '23:00',
  isClosed: false,
}))

/** GET /manager/stats/today — E09-10. */
export interface ManagerStats {
  revenueToday: number
  revenueDelta: number | null
  bookingsToday: number
  bookingsDelta: number | null
  /** 0–100, booked hours over open hours across the venue's pitches today. */
  occupancyRate: number
  noShowsThisWeek: number
  upcoming: {
    id: string
    reference: string
    date: string
    startTime: string
    endTime: string
    pitch: string
    player: string
    status: 'PENDING' | 'CONFIRMED'
  }[]
}

/** The admin's list of venues waiting for approval — E09 (E15 grows it). */
export interface PendingCompany {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
  websiteUrl: string | null
  address: string
  city: string
  phone: string | null
  email: string | null
  manager: { name: string; email: string }
  stripeConnected: boolean
  pitchCount: number
  submittedAt: string | null
}
