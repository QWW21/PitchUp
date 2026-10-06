import { z } from 'zod'

export const registerPlayerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
  city: z.string().min(1),
  dateOfBirth: z.string().date(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const createBookingSchema = z.object({
  pitchId: z.string().cuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  teamCount: z.literal(2).or(z.literal(3)),
  teamsData: z.array(
    z.object({
      colour: z.string().optional(),
      playerCount: z.number().int().min(1).max(15).optional(),
      shirts: z
        .array(
          z.object({
            colour: z.string(),
            quantity: z.number().int().min(1),
          })
        )
        .optional(),
    })
  ),
  noteToManager: z.string().max(200).optional(),
})

export type RegisterPlayerInput = z.infer<typeof registerPlayerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateBookingInput = z.infer<typeof createBookingSchema>
