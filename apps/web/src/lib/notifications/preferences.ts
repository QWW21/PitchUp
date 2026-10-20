/**
 * Notification preferences — E13-07. No row means the defaults: push and
 * email on, nothing muted. (Text messages are not a notification channel;
 * see channels.ts.)
 */
import 'server-only'
import type { NotificationPreferences, NotificationPreferencesInput } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/api/errors'

const DEFAULTS = { pushEnabled: true, emailEnabled: true, disabledTypes: [] }

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const [user, prefs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true } }),
    prisma.notificationPreference.findUnique({ where: { userId } }),
  ])
  if (!user || user.deletedAt) throw notFound('Account not found')
  const p = prefs ?? DEFAULTS
  return {
    pushEnabled: p.pushEnabled,
    emailEnabled: p.emailEnabled,
    disabledTypes: p.disabledTypes,
  }
}

export async function updatePreferences(
  userId: string,
  input: NotificationPreferencesInput
): Promise<NotificationPreferences> {
  // Only the fields sent change.
  const data = {
    ...(input.pushEnabled !== undefined ? { pushEnabled: input.pushEnabled } : {}),
    ...(input.emailEnabled !== undefined ? { emailEnabled: input.emailEnabled } : {}),
    ...(input.disabledTypes !== undefined ? { disabledTypes: input.disabledTypes } : {}),
  }
  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })
  return getPreferences(userId)
}
