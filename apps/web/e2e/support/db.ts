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
