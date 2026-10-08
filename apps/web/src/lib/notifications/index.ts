/**
 * Provider selection — E02-08, with the real email adapter from E02-09.
 *
 * Missing credentials fall back to a console logger rather than failing, so
 * a fresh clone can exercise the whole flow. Setting RESEND_API_KEY switches
 * to real delivery with no code change.
 */
import 'server-only'
import { env } from '@/lib/env'
import { devEmailProvider, devSmsProvider } from './dev-provider'
import { resendEmailProvider } from './resend-provider'
import { twilioSmsProvider } from './twilio-provider'
import type { EmailProvider, SmsProvider } from './types'

export function getEmailProvider(): EmailProvider {
  return env.RESEND_API_KEY ? resendEmailProvider : devEmailProvider
}

export function getSmsProvider(): SmsProvider {
  const configured = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER
  return configured ? twilioSmsProvider : devSmsProvider
}

export { EmailDeliveryError } from './resend-provider'
export { SmsDeliveryError } from './twilio-provider'
export type { EmailMessage, EmailProvider, SmsMessage, SmsProvider } from './types'
