/**
 * Telling people things — E13-01. One way in for every notification:
 *
 * 1. `notify(db, payload)` writes the in-app notification, inside the
 *    caller's transaction, so it exists exactly when the change it describes
 *    does. A type the person muted (E13-07) writes nothing.
 * 2. After the transaction commits, `deliverSoon(userIds)` sends the email,
 *    SMS and push for those rows, after the response has gone out.
 * 3. The hourly job (E13-04) sweeps anything not yet delivered: an outbox. A
 *    row is claimed (`deliveredAt` set) before anything is sent, so the
 *    request and the sweep can never both send it.
 *
 * Channels fail independently; a failure is logged and the others still go.
 */
import 'server-only'
import { after } from 'next/server'
import type { NotificationType, Prisma, PrismaClient } from '@prisma/client'
import type { Locale } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { webT, type WebT } from '@/i18n/catalog'
import { userLocale } from '@/i18n/server'
import { sendChannels } from './channels'

type Db = Prisma.TransactionClient | PrismaClient

/**
 * Notification text is written in the recipient's language, which only
 * notify() knows: so it is given as a function of the translator.
 */
export type NotificationText = (t: WebT, locale: Locale) => string

export interface NotificationPayload {
  userId: string
  type: NotificationType
  title: NotificationText
  body: NotificationText
  /**
   * What it is about (bookingId, reviewId…), for the app's deep links. `link`
   * is the web page the email button opens when the type alone can't say
   * (a venue's view of a booking rather than the player's).
   */
  data?: Record<string, string>
}

/** Writes the in-app notification; null when the person muted this type. */
export async function notify(db: Db, payload: NotificationPayload): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { locale: true, notificationPreference: { select: { disabledTypes: true } } },
  })
  if (user?.notificationPreference?.disabledTypes.includes(payload.type)) return null
  const locale = userLocale(user ?? {})
  const t = webT(locale)
  const row = await db.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      title: payload.title(t, locale),
      body: payload.body(t, locale),
      data: payload.data ?? {},
    },
    select: { id: true },
  })
  return row.id
}

/** Only rows this recent are swept: older ones predate the outbox or are stale. */
const SWEEP_WINDOW_MS = 2 * 3_600_000

/**
 * Sends email, SMS and push for undelivered notifications — of these people,
 * or everyone's when no scope is given (the hourly sweep).
 */
export async function deliverPending(
  scope: { userIds?: string[] } = {},
  now: Date = new Date()
): Promise<{ delivered: number }> {
  const rows = await prisma.notification.findMany({
    where: {
      deliveredAt: null,
      createdAt: { gte: new Date(now.getTime() - SWEEP_WINDOW_MS) },
      ...(scope.userIds ? { userId: { in: scope.userIds } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  let delivered = 0
  for (const row of rows) {
    // Claim it first: whoever sets deliveredAt sends it, once.
    const claim = await prisma.notification.updateMany({
      where: { id: row.id, deliveredAt: null },
      data: { deliveredAt: now },
    })
    if (claim.count !== 1) continue
    const sent = await sendChannels(row).catch(caught => {
      console.error(
        `[notifications] ${row.id} failed:`,
        caught instanceof Error ? caught.message : 'unknown error'
      )
      return null
    })
    if (sent) {
      await prisma.notification.update({ where: { id: row.id }, data: sent })
      delivered++
    }
  }
  return { delivered }
}

/**
 * Delivers these people's new notifications once the response has gone out
 * (Next's `after`), or straight away outside a request (scripts, tests).
 */
export function deliverSoon(userIds: (string | null | undefined)[]): void {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))]
  if (!ids.length) return
  const run = () =>
    deliverPending({ userIds: ids }).then(
      () => undefined,
      caught =>
        console.error(
          '[notifications] delivery failed:',
          caught instanceof Error ? caught.message : 'unknown error'
        )
    )
  try {
    after(run)
  } catch {
    void run()
  }
}
