import { z } from 'zod'
import { BOOKING } from '../constants/booking'
import { REVIEW } from '../constants/review'
import { SHIRT_COLOURS } from '../constants/shirts'
import { idSchema } from './common'

const shirtColourSchema = z.enum(
  SHIRT_COLOURS as unknown as [string, ...string[]]
)

const teamSchema = z.object({
  colour: shirtColourSchema.optional(),
  playerCount: z
    .number()
    .int()
    .min(1)
    .max(BOOKING.MAX_PLAYERS_PER_TEAM)
    .optional(),
  shirts: z
    .array(
      z.object({
        colour: shirtColourSchema,
        quantity: z.number().int().min(1).max(BOOKING.MAX_PLAYERS_PER_TEAM),
      })
    )
    .optional(),
})

export const CreateBookingSchema = z
  .object({
    pitchId: idSchema,
    startTime: z.string().datetime({ message: 'Must be an ISO-8601 UTC timestamp' }),
    endTime: z.string().datetime({ message: 'Must be an ISO-8601 UTC timestamp' }),
    teamCount: z
      .number()
      .int()
      .min(BOOKING.MIN_TEAM_COUNT)
      .max(BOOKING.MAX_TEAM_COUNT),
    teamsData: z.array(teamSchema).min(BOOKING.MIN_TEAM_COUNT).max(BOOKING.MAX_TEAM_COUNT),
    noteToManager: z.string().max(BOOKING.MAX_NOTE_LENGTH).optional(),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
  .refine(
    (data) => {
      const hours =
        (new Date(data.endTime).getTime() - new Date(data.startTime).getTime()) /
        3_600_000
      return hours >= BOOKING.MIN_DURATION_HOURS && hours <= BOOKING.MAX_DURATION_HOURS
    },
    {
      message: `Booking must be between ${BOOKING.MIN_DURATION_HOURS} and ${BOOKING.MAX_DURATION_HOURS} hours`,
      path: ['endTime'],
    }
  )
  .refine(
    (data) => {
      // PRD §15: a booking must start and end on the same calendar day.
      // Checked in UTC; the API re-checks against the venue's local day.
      const start = new Date(data.startTime)
      const end = new Date(data.endTime)
      const sameDay =
        start.getUTCFullYear() === end.getUTCFullYear() &&
        start.getUTCMonth() === end.getUTCMonth() &&
        start.getUTCDate() === end.getUTCDate()
      const endsAtMidnight =
        end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0
      return sameDay || endsAtMidnight
    },
    {
      message: 'A booking cannot span midnight',
      path: ['endTime'],
    }
  )
  .refine((data) => data.teamsData.length === data.teamCount, {
    message: 'teamsData must contain exactly teamCount entries',
    path: ['teamsData'],
  })

export const CancelBookingSchema = z.object({
  reason: z.string().max(300).optional(),
})

export const NoShowSchema = z.object({
  reason: z.string().min(1).max(300),
})

export const DisputeSchema = z.object({
  disputeText: z.string().min(1).max(REVIEW.MAX_DISPUTE_TEXT_LENGTH),
  evidenceUrls: z.array(z.string().url()).max(REVIEW.MAX_PHOTOS).optional(),
})

export const ResolveDisputeSchema = z.object({
  resolution: z.enum(['RESOLVED_PLAYER', 'RESOLVED_MANAGER']),
  adminNote: z.string().max(500).optional(),
})

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>
export type CancelBookingInput = z.infer<typeof CancelBookingSchema>
export type NoShowInput = z.infer<typeof NoShowSchema>
export type DisputeInput = z.infer<typeof DisputeSchema>
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>
export type BookingTeam = z.infer<typeof teamSchema>
