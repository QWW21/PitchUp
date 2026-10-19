/**
 * The three outside channels for one notification — E13-02 … E13-04 — each
 * following the person's preferences:
 *
 * - email (on by default): the booking and venue emails keep their own
 *   templates; everything else gets the standard layout with a button to the
 *   right page;
 * - SMS (off by default, needs a phone): only what matters on the day;
 * - push (on by default): every registered phone; tokens the phone has
 *   dropped are deleted.
 */
import 'server-only'
import type { Notification } from '@prisma/client'
import { notificationWebPath } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { loadConfirmation } from '@/lib/bookings/read'
import { renderBookingConfirmedEmail } from '@/lib/emails/booking-confirmed'
import { renderCompanyApprovedEmail, renderCompanyRejectedEmail } from '@/lib/emails/company'
import {
  renderButton,
  renderEmailLayout,
  renderMutedParagraph,
  renderParagraph,
} from '@/lib/emails/layout'
import { getEmailProvider, getSmsProvider } from './index'
import { sendPush } from './push'

/** Texts cost money: only what matters on the day. */
const SMS_TYPES = new Set([
  'BOOKING_REMINDER_24H',
  'BOOKING_REMINDER_2H',
  'BOOKING_CANCELLED_MANAGER',
  'NO_SHOW_REPORTED',
])

const appUrl = () => env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')

async function emailFor(n: Notification, data: Record<string, string>) {
  if (n.type === 'BOOKING_CONFIRMED' && data.bookingId) {
    const booking = await loadConfirmation(data.bookingId)
    if (booking) return renderBookingConfirmedEmail(booking)
  }
  if (n.type === 'COMPANY_APPROVED' && data.companyName) {
    return renderCompanyApprovedEmail(data.companyName, `${appUrl()}/manager/overview`)
  }
  if (n.type === 'COMPANY_REJECTED' && data.companyName) {
    return renderCompanyRejectedEmail(data.companyName, data.reason ?? '', `${appUrl()}/onboarding`)
  }
  const url = `${appUrl()}${notificationWebPath(n.type, data)}`
  return {
    subject: n.title,
    html: renderEmailLayout({
      heading: n.title,
      bodyHtml:
        renderParagraph(n.body) +
        renderButton('Open PitchUp', url) +
        renderMutedParagraph(
          `Choose which emails you get in your notification settings: ${appUrl()}/profile/notifications`
        ),
      footerNote: 'You are receiving this because you use PitchUp.',
    }),
    text: `${n.title}\n\n${n.body}\n\n${url}\n\nChoose which emails you get: ${appUrl()}/profile/notifications`,
  }
}

export interface Sent {
  sentEmail: boolean
  sentSms: boolean
  sentPush: boolean
}

export async function sendChannels(n: Notification): Promise<Sent> {
  const [user, prefs, tokens] = await Promise.all([
    prisma.user.findUnique({
      where: { id: n.userId },
      select: { email: true, phone: true, deletedAt: true },
    }),
    prisma.notificationPreference.findUnique({ where: { userId: n.userId } }),
    prisma.deviceToken.findMany({ where: { userId: n.userId }, select: { id: true, token: true } }),
  ])
  const sent: Sent = { sentEmail: false, sentSms: false, sentPush: false }
  if (!user || user.deletedAt) return sent
  const data = (n.data ?? {}) as Record<string, string>
  const failed = (channel: string) => (caught: unknown) =>
    console.error(
      `[notifications] ${channel} for ${n.id} failed:`,
      caught instanceof Error ? caught.message : 'unknown error'
    )

  await Promise.all([
    (async () => {
      if (!(prefs?.emailEnabled ?? true) || !user.email) return
      const email = await emailFor(n, data)
      await getEmailProvider().send({ to: user.email, ...email })
      sent.sentEmail = true
    })().catch(failed('email')),
    (async () => {
      if (!prefs?.smsEnabled || !user.phone || !SMS_TYPES.has(n.type)) return
      const body = `PitchUp: ${n.title}. ${n.body}`
      await getSmsProvider().send({ to: user.phone, body: body.slice(0, 160) })
      sent.sentSms = true
    })().catch(failed('sms')),
    (async () => {
      if (!(prefs?.pushEnabled ?? true) || !tokens.length) return
      const result = await sendPush(tokens, {
        title: n.title,
        body: n.body,
        data: { ...data, type: n.type, notificationId: n.id },
      })
      if (result.stale.length) {
        await prisma.deviceToken.deleteMany({ where: { id: { in: result.stale } } })
      }
      sent.sentPush = result.sent > 0
    })().catch(failed('push')),
  ])
  return sent
}
