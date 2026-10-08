/**
 * Development providers that log instead of sending — E02-08.
 *
 * Lets the whole verification flow be exercised before Resend and Twilio
 * accounts exist. Selected automatically when credentials are absent.
 */
import 'server-only'
import type { EmailMessage, EmailProvider, SmsMessage, SmsProvider } from './types'

function banner(kind: string, to: string, body: string): void {
  // console.warn, not log: the lint config allows warn and error, and this
  // genuinely is a warning — nothing was actually delivered.
  console.warn(
    `\n┌─ ${kind} (not sent — no provider configured)\n` +
      `│  to: ${to}\n` +
      body
        .trim()
        .split('\n')
        .map(line => `│  ${line}`)
        .join('\n') +
      `\n└─\n`
  )
}

export const devEmailProvider: EmailProvider = {
  name: 'dev-console',
  async send(message: EmailMessage) {
    banner('EMAIL', message.to, `${message.subject}\n\n${message.body}`)
  },
}

export const devSmsProvider: SmsProvider = {
  name: 'dev-console',
  async send(message: SmsMessage) {
    banner('SMS', message.to, message.body)
  },
}
