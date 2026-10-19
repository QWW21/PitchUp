/**
 * The in-app notification list — E08-09 — and push device tokens (E08-10).
 * Everything is the signed-in user's own: anyone else's id is a 404.
 *
 * Deleting is a real delete. A notification is the user's own message,
 * nothing else refers to it, and a soft delete would keep rows nobody reads.
 */
import 'server-only'
import type { NotificationItem, NotificationPage, NotificationType } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/api/errors'

const asStrings = (data: unknown): Record<string, string> =>
  data && typeof data === 'object'
    ? Object.fromEntries(
        Object.entries(data as Record<string, unknown>).filter(
          (e): e is [string, string] => typeof e[1] === 'string'
        )
      )
    : {}

export async function listNotifications(
  userId: string,
  cursor: string | undefined,
  limit: number,
  unreadOnly = false
): Promise<NotificationPage> {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ])
  const page = rows.slice(0, limit)
  return {
    items: page.map((n): NotificationItem => ({
      id: n.id,
      type: n.type as NotificationType,
      title: n.title,
      body: n.body,
      data: asStrings(n.data),
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    nextCursor: rows.length > limit ? page.at(-1)!.id : null,
    hasMore: rows.length > limit,
    unread,
  }
}

export async function markRead(userId: string, id: string): Promise<void> {
  const { count } = await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  })
  if (!count) throw notFound('Notification not found')
}

export async function markAllRead(userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
  return count
}

export async function deleteNotification(userId: string, id: string): Promise<void> {
  const { count } = await prisma.notification.deleteMany({ where: { id, userId } })
  if (!count) throw notFound('Notification not found')
}

/** The token now belongs to whoever registered it last (a shared phone). */
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android'
): Promise<void> {
  await prisma.deviceToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform },
  })
}

/** GET /notifications/count — the badge, cheaply (E13-06). */
export const unreadCount = (userId: string) =>
  prisma.notification.count({ where: { userId, isRead: false } })
