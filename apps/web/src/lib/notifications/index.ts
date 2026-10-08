/**
 * Provider selection — E02-08.
 *
 * Real adapters replace the dev ones in E02-09 (Resend) and E02-10 (Twilio).
 * Until then, missing credentials mean messages are logged rather than the
 * flow failing outright.
 */
import 'server-only'
import { env } from '@/lib/env'
import { devEmailProvider, devSmsProvider } from './dev-provider'
import type { EmailProvider, SmsProvider } from './types'

export function getEmailProvider(): EmailProvider {
  if (!env.RESEND_API_KEY) return devEmailProvider
  return devEmailProvider // Resend adapter lands in E02-09.
}

export function getSmsProvider(): SmsProvider {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return devSmsProvider
  return devSmsProvider // Twilio adapter lands in E02-10.
}

export type { EmailMessage, EmailProvider, SmsMessage, SmsProvider } from './types'
