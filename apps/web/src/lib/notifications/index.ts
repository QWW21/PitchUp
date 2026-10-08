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
import type { EmailProvider, SmsProvider } from './types'

export function getEmailProvider(): EmailProvider {
  return env.RESEND_API_KEY ? resendEmailProvider : devEmailProvider
}

export function getSmsProvider(): SmsProvider {
  // Twilio adapter lands in E02-10.
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return devSmsProvider
  return devSmsProvider
}

export { EmailDeliveryError } from './resend-provider'
export type { EmailMessage, EmailProvider, SmsMessage, SmsProvider } from './types'
