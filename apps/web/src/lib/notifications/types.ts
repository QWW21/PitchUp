/**
 * Provider-agnostic messaging interfaces — E02-08.
 *
 * Routes depend on these, never on Resend or Twilio directly, so the real
 * providers can be swapped in by configuration once credentials exist
 * (E02-09, E02-10) without touching any route.
 */
import 'server-only'

export interface EmailMessage {
  to: string
  subject: string
  /** Plain text. HTML templates arrive with the real provider in E02-09. */
  body: string
}

export interface SmsMessage {
  /** E.164, e.g. +40712345678. */
  to: string
  body: string
}

export interface EmailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<void>
}

export interface SmsProvider {
  readonly name: string
  send(message: SmsMessage): Promise<void>
}
