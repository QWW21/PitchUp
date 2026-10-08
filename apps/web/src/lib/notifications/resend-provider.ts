/**
 * Resend email adapter — ticket E02-09.
 *
 * Selected automatically once RESEND_API_KEY is set; until then the dev
 * provider logs to the console instead.
 */
import 'server-only'
import { Resend } from 'resend'
import { env } from '@/lib/env'
import type { EmailMessage, EmailProvider } from './types'

/**
 * Thrown when Resend rejects a send. Carries no provider detail outward —
 * callers map it to a generic error so Resend's wording never reaches a
 * client.
 */
export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailDeliveryError'
  }
}

let client: Resend | null = null

function getClient(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new EmailDeliveryError('Resend is not configured')
  }
  client ??= new Resend(env.RESEND_API_KEY)
  return client
}

export const resendEmailProvider: EmailProvider = {
  name: 'resend',

  async send(message: EmailMessage): Promise<void> {
    const { error } = await getClient().emails.send({
      from: env.EMAIL_FROM ?? 'PitchUp <noreply@pitchup.ro>',
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    })

    if (error) {
      // Logged in full server-side; the thrown message stays generic.
      console.error('[email] Resend rejected a message:', error)
      throw new EmailDeliveryError('Email could not be sent')
    }
  },
}
