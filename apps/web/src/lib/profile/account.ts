/**
 * The player's own account — E08-01 (profile), E08-02 (trust score) and
 * E08-03 (password, deletion).
 *
 * Wrong passwords answer 400 WRONG_PASSWORD, not the ticket's 401: a 401
 * tells the mobile client its session is gone, and it would sign the player
 * out for a typo.
 */
import 'server-only'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import {
  AUTH,
  TRUST_REASON_LABELS,
  TRUST_TIERS,
  TRUST_TIER_COLOURS,
  tierDescription,
  tierRange,
  trustTier,
  type ChangeOwnPasswordInput,
  type DeleteAccountInput,
  type Profile,
  type TrustScoreDetail,
  type UpdateProfileInput,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { getEmailProvider } from '@/lib/notifications'
import { renderPasswordChangedEmail } from '@/lib/emails/password-reset'
import { deleteImage, isCloudinaryConfigured } from '@/lib/cloudinary'
import { cancelBooking } from '@/lib/bookings/cancel'

const profileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  city: true,
  profilePhotoUrl: true,
  role: true,
  emailVerified: true,
  phoneVerified: true,
  trustScore: true,
  createdAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect

type ProfileRow = Prisma.UserGetPayload<{ select: typeof profileSelect }>

const toProfile = (u: ProfileRow): Profile => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  city: u.city,
  avatarUrl: u.profilePhotoUrl,
  role: u.role,
  emailVerified: u.emailVerified,
  phoneVerified: u.phoneVerified,
  trustScore: u.trustScore,
  trustTier: trustTier(u.trustScore).label,
  createdAt: u.createdAt.toISOString(),
})

async function liveUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect })
  if (!user || user.deletedAt) throw notFound('Account not found')
  return user
}

export async function getProfile(userId: string): Promise<Profile> {
  return toProfile(await liveUser(userId))
}

/** A new phone number has to be verified again (PRD §6.5). */
export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile> {
  const current = await liveUser(userId)
  const phoneChanged = input.phone !== undefined && input.phone !== current.phone
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.avatarUrl !== undefined ? { profilePhotoUrl: input.avatarUrl } : {}),
        ...(phoneChanged && input.phone ? { phone: input.phone, phoneVerified: false } : {}),
      },
      select: profileSelect,
    })
    return toProfile(user)
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002') {
      throw new ApiException('CONFLICT', 'That phone number belongs to another account', {
        reason: 'PHONE_TAKEN',
      })
    }
    throw caught
  }
}

export async function getTrustScore(
  userId: string,
  cursor: string | undefined,
  limit = 20
): Promise<TrustScoreDetail> {
  const user = await liveUser(userId)
  const tier = trustTier(user.trustScore)
  const rows = await prisma.trustScoreEvent.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  const page = rows.slice(0, limit)
  return {
    score: user.trustScore,
    tier: tier.label,
    tierDescription: tierDescription(tier),
    canBook: tier.canBook,
    maxActiveBookings: tier.maxActiveBookings,
    requiresCardOnFile: tier.requiresCardOnFile,
    requiresUpfrontDeposit: tier.requiresUpfrontDeposit,
    events: page.map(e => ({
      id: e.id,
      delta: e.delta,
      reason: e.reason,
      label: TRUST_REASON_LABELS[e.reason],
      bookingId: e.relatedBookingId,
      createdAt: e.createdAt.toISOString(),
    })),
    nextCursor: rows.length > limit ? page.at(-1)!.id : null,
    hasMore: rows.length > limit,
    tiers: TRUST_TIERS.map(t => ({
      name: t.label,
      range: tierRange(t),
      description: tierDescription(t),
      colour: TRUST_TIER_COLOURS[t.label],
    })),
  }
}

/** The stored hash, after checking the password against it. */
async function checkPassword(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, deletedAt: true },
  })
  if (!user || user.deletedAt) throw notFound('Account not found')
  // bcrypt.compare does the same work whether or not it matches.
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiException('VALIDATION_ERROR', 'Your password is not correct', {
      reason: 'WRONG_PASSWORD',
    })
  }
}

/**
 * Like a reset (E02): every session ends. `passwordChangedAt` ends web
 * sessions, including the one making this request; refresh tokens are
 * revoked for the app. The player signs in again with the new password.
 */
export async function changePassword(userId: string, input: ChangeOwnPasswordInput): Promise<void> {
  await checkPassword(userId, input.currentPassword)
  const passwordHash = await bcrypt.hash(input.newPassword, AUTH.BCRYPT_COST)
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
      select: { email: true },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])
  // Best-effort, as after a reset: how someone learns their password changed.
  try {
    await getEmailProvider().send({ to: user.email, ...renderPasswordChangedEmail() })
  } catch (caught) {
    console.error('[profile] Could not send the password-changed notice:', caught)
  }
}

/** Cloudinary's public id from a delivery URL: after /upload/ and the version. */
export function cloudinaryPublicId(url: string): string | null {
  const match = /\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url)
  return match?.[1] ?? null
}

/**
 * Deleting an account (E08-03), decided with the owner: anonymise, don't
 * erase. The person goes (name, email, phone, photo, date of birth, card
 * customer, sessions) and can never sign in again. Their upcoming bookings
 * are cancelled with everything refunded. Past bookings and reviews stay
 * for the venues' records and payouts; reviews show "Former player".
 *
 * Managers and admins cannot delete themselves: a company or the platform
 * hangs off the account, so that goes through support.
 */
export async function deleteAccount(
  user: { id: string; role: string },
  input: DeleteAccountInput,
  now: Date = new Date()
): Promise<void> {
  if (user.role !== 'PLAYER') {
    throw new ApiException(
      'VALIDATION_ERROR',
      'Venue and admin accounts are closed through support',
      { reason: 'NOT_A_PLAYER' }
    )
  }
  await checkPassword(user.id, input.password)
  await closePlayerAccount(user, input.reason ?? null, now)
}

/**
 * Closes a player's account (the part of deleting it after the password
 * check), also used by an admin (E15-03): upcoming bookings cancelled with
 * everything refunded, personal details wiped, every session ended.
 */
export async function closePlayerAccount(
  user: { id: string; role: string },
  reason: string | null,
  now: Date = new Date()
): Promise<void> {
  // Cancel first: if a refund fails, the account is untouched and the
  // player can try again (bookings already cancelled stay cancelled).
  const upcoming = await prisma.booking.findMany({
    where: {
      playerId: user.id,
      status: { in: ['PENDING', 'AWAITING_APPROVAL', 'CONFIRMED'] },
      startTime: { gt: now },
    },
    select: { id: true },
  })
  for (const b of upcoming) {
    await cancelBooking(b.id, user, now, { refundAll: true, reason: 'Account deleted' })
  }

  const before = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { profilePhotoUrl: true },
  })
  // A random hash: no password can ever match it.
  const unusable = await bcrypt.hash(randomBytes(32).toString('hex'), AUTH.BCRYPT_COST)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        deletedAt: now,
        deletionReason: reason,
        name: 'Former player',
        email: `deleted_${user.id}@pitchup.deleted`,
        phone: `deleted_${user.id}`,
        profilePhotoUrl: null,
        city: null,
        dateOfBirth: null,
        stripeCustomerId: null,
        emailVerified: false,
        phoneVerified: false,
        passwordHash: unusable,
        passwordChangedAt: now,
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.deviceToken.deleteMany({ where: { userId: user.id } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
  ])

  // Best-effort: the account is already gone either way.
  const publicId = before.profilePhotoUrl && cloudinaryPublicId(before.profilePhotoUrl)
  if (publicId && isCloudinaryConfigured()) {
    await deleteImage(publicId).catch(caught =>
      console.error('[profile] Could not delete the avatar:', caught)
    )
  }
}
