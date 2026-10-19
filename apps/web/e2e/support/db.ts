/**
 * Direct access to the E2E database, for what a test cannot get through the
 * UI: a verification code (only its hash is stored), a reset token, a seeded
 * id, or a state to set up and tear down.
 */
import { createHash, randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { E2E_DATABASE_URL } from './env'

export const db = new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } })

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/**
 * Gives a user a known email (or phone) code, superseding any outstanding
 * one — the same thing sendEmailVerification does, but with a code the test
 * knows.
 */
export async function setVerificationCode(
  email: string,
  code: string,
  channel: 'EMAIL' | 'PHONE' = 'EMAIL'
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { email } })
  await db.verificationCode.updateMany({
    where: { userId: user.id, channel, usedAt: null },
    data: { usedAt: new Date() },
  })
  await db.verificationCode.create({
    data: {
      userId: user.id,
      channel,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  })
}

/** Issues a password-reset token for a user and returns the plaintext the email would carry. */
export async function createResetToken(email: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { email } })
  const token = randomBytes(32).toString('hex')
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 60 * 60_000),
    },
  })
  return token
}

/** A seeded Discover venue and its pitches, by slug (see prisma/seed.ts DEMO_VENUES). */
export async function venue(slug: string) {
  return db.company.findFirstOrThrow({
    where: { owner: { email: `venue-${slug}@demo.ro` } },
    include: { pitches: { orderBy: { name: 'asc' } } },
  })
}

/** A unique address per test run, so registrations never collide. */
export const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`

/** A unique, valid E.164 Romanian mobile number. */
export const uniquePhone = () => `+4079${String(Date.now()).slice(-7)}`

/** A verified player made directly in the database, for tests that need a second account. */
export async function createPlayer(email: string, password = 'Testing123'): Promise<void> {
  await db.user.create({
    data: {
      email,
      phone: uniquePhone(),
      passwordHash: await bcrypt.hash(password, 4),
      name: 'Second Player',
      role: 'PLAYER',
      city: 'Cluj-Napoca',
      emailVerified: true,
    },
  })
}

/** A verified venue manager with no company yet: where onboarding starts (E09). */
export async function createManager(email: string, password = 'Testing123'): Promise<string> {
  const user = await db.user.create({
    data: {
      email,
      phone: uniquePhone(),
      passwordHash: await bcrypt.hash(password, 4),
      name: 'New Manager',
      role: 'MANAGER',
      emailVerified: true,
    },
    select: { id: true },
  })
  return user.id
}

/**
 * A venue manager with an approved company and no pitches (E10): open
 * 08:00–23:00, closed on Sundays.
 */
export async function createVenue(email: string, name: string) {
  const userId = await createManager(email)
  const company = await db.company.create({
    data: {
      ownerId: userId,
      name,
      status: 'ACTIVE',
      phone: '+40712000444',
      email,
      addressLine1: 'Str. Testului 1',
      city: 'Cluj-Napoca',
      county: 'Cluj',
      postalCode: '400001',
      workingHours: [0, 1, 2, 3, 4, 5, 6].map(day => ({
        day,
        openTime: '08:00',
        closeTime: '23:00',
        isClosed: day === 0,
      })),
    },
    select: { id: true },
  })
  return { userId, companyId: company.id }
}

/**
 * A booking written directly, `startsIn` hours from now and two hours long,
 * for states the API cannot produce on demand (finished, a no-show, soon).
 * Paid with a test payment unless it is PENDING or `paid: false`.
 */
export async function seedBooking(opts: {
  pitchId: string
  playerId: string
  startsIn: number
  status: 'PENDING' | 'AWAITING_APPROVAL' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  paid?: boolean
  createdAgo?: number
  rate?: number
  /** C-10: the refund policy the booking was made under; none means the default. */
  refundPolicy?: {
    fullRefundHours: number
    partialRefundHours: number
    partialRefundPercent: number
  }
  /** C-13: when a booking waiting for the venue is declined. */
  approvalDeadline?: Date
}) {
  const HOUR = 3_600_000
  const start = new Date(Date.now() + opts.startsIn * HOUR)
  const paid = opts.paid ?? opts.status !== 'PENDING'
  const total = (opts.rate ?? 180) * 2
  return db.booking.create({
    data: {
      pitchId: opts.pitchId,
      playerId: opts.playerId,
      startTime: start,
      endTime: new Date(start.getTime() + 2 * HOUR),
      teamCount: 2,
      teamsData: [{ playerCount: 7, colour: 'RED' }, { playerCount: 6 }],
      status: opts.status,
      pitchRateSnapshot: opts.rate ?? 180,
      platformFee: total * 0.08,
      totalAmount: total,
      paymentProvider: 'test',
      stripePaymentIntentId: `test_pi_seed_${Math.random().toString(36).slice(2)}`,
      ...(paid ? { paidAt: new Date(Date.now() - 50 * HOUR) } : {}),
      ...(opts.status === 'CANCELLED'
        ? {
            cancelledAt: new Date(),
            cancelledBy: 'PLAYER' as const,
            ...(paid ? { refundAmount: total } : {}),
          }
        : {}),
      createdAt: new Date(Date.now() - (opts.createdAgo ?? 60) * HOUR),
      ...(opts.refundPolicy ? { refundPolicy: opts.refundPolicy } : {}),
      ...(opts.approvalDeadline ? { approvalDeadline: opts.approvalDeadline } : {}),
    },
  })
}
