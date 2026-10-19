/**
 * Notification preferences — E13-07. No row means the defaults: push and
 * email on, SMS off, nothing muted. SMS can only be switched on with a phone
 * number on the account.
 */
import 'server-only'
import type { NotificationPreferences, NotificationPreferencesInput } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { notFound, validationError } from '@/lib/api/errors'

const DEFAULTS = { pushEnabled: true, emailEnabled: true, smsEnabled: false, disabledTypes: [] }

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const [user, prefs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { phone: true, deletedAt: true } }),
    prisma.notificationPreference.findUnique({ where: { userId } }),
  ])
  if (!user || user.deletedAt) throw notFound('Account not found')
  const p = prefs ?? DEFAULTS
  return {
    pushEnabled: p.pushEnabled,
    emailEnabled: p.emailEnabled,
    smsEnabled: p.smsEnabled,
    disabledTypes: p.disabledTypes,
    hasPhone: !!user.phone,
  }
}

export async function updatePreferences(
  userId: string,
  input: NotificationPreferencesInput
): Promise<NotificationPreferences> {
  if (input.smsEnabled) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } })
    if (!user?.phone) {
      throw validationError('Add a phone number to get text messages', { reason: 'PHONE_REQUIRED' })
    }
  }
  // Only the fields sent change.
  const data = {
    ...(input.pushEnabled !== undefined ? { pushEnabled: input.pushEnabled } : {}),
    ...(input.emailEnabled !== undefined ? { emailEnabled: input.emailEnabled } : {}),
    ...(input.smsEnabled !== undefined ? { smsEnabled: input.smsEnabled } : {}),
    ...(input.disabledTypes !== undefined ? { disabledTypes: input.disabledTypes } : {}),
  }
  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })
  return getPreferences(userId)
}
