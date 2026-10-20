/**
 * Twilio SMS adapter — ticket E02-10.
 *
 * Option B from the ticket: PitchUp generates, stores and checks the code
 * (E02-08 already does this, hashed and attempt-limited); Twilio only
 * carries the message. Twilio Verify would hand all of that to Twilio, but
 * it would discard working code, add a vendor dependency to a core auth
 * path, and make phone verification impossible to test without a live
 * account.
 *
 * Inactive until TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set; until
 * then the dev provider logs to the console and no message is sent.
 *
 * Twilio Verify, below, is the exception that came later (2026-10-20): a
 * trial account may only send Twilio's own templates, so with
 * TWILIO_VERIFY_SERVICE_SID set, Twilio makes, sends and checks the phone
 * code. Without it, and in every test, the code stays ours as above.
 */
import 'server-only'
import twilio from 'twilio'
import { env } from '@/lib/env'
import type { SmsMessage, SmsProvider } from './types'

/** Carries no Twilio detail outward — callers map it to a generic error. */
export class SmsDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SmsDeliveryError'
  }
}

type TwilioClient = ReturnType<typeof twilio>
let client: TwilioClient | null = null

function getClient(): TwilioClient {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new SmsDeliveryError('Twilio is not configured')
  }
  client ??= twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  return client
}

/** Whether phone codes go through Twilio Verify. */
export function isTwilioVerifyConfigured(): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID)
}

export type VerifyCheck = 'APPROVED' | 'WRONG_CODE' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS'

const errorCode = (caught: unknown) =>
  typeof caught === 'object' && caught !== null && 'code' in caught
    ? (caught as { code: unknown }).code
    : undefined

export const twilioVerify = {
  /** Texts a fresh code to the number; Twilio replaces any pending one. */
  async start(to: string): Promise<void> {
    try {
      await getClient()
        .verify.v2.services(env.TWILIO_VERIFY_SERVICE_SID!)
        .verifications.create({ to, channel: 'sms' })
    } catch (caught) {
      console.error('[sms] Twilio Verify could not start:', caught)
      throw new SmsDeliveryError('SMS could not be sent')
    }
  },

  /** Checks a code against the pending verification for the number. */
  async check(to: string, code: string): Promise<VerifyCheck> {
    try {
      const result = await getClient()
        .verify.v2.services(env.TWILIO_VERIFY_SERVICE_SID!)
        .verificationChecks.create({ to, code })
      return result.status === 'approved' ? 'APPROVED' : 'WRONG_CODE'
    } catch (caught) {
      // 20404: no pending verification (expired, used, or never sent).
      // 60202: the code's attempts are used up.
      const code = errorCode(caught)
      if (code === 20404) return 'EXPIRED'
      if (code === 60202) return 'TOO_MANY_ATTEMPTS'
      console.error('[sms] Twilio Verify could not check a code:', caught)
      throw new SmsDeliveryError('The code could not be checked')
    }
  },
}

export const twilioSmsProvider: SmsProvider = {
  name: 'twilio',

  async send(message: SmsMessage): Promise<void> {
    if (!env.TWILIO_PHONE_NUMBER) {
      throw new SmsDeliveryError('No sender number configured')
    }

    try {
      await getClient().messages.create({
        body: message.body,
        from: env.TWILIO_PHONE_NUMBER,
        to: message.to,
      })
    } catch (caught) {
      // Twilio's errors name the recipient and the account; logged here,
      // never returned. A blocked or invalid number must not be
      // distinguishable to a caller probing numbers.
      console.error('[sms] Twilio rejected a message:', caught)
      throw new SmsDeliveryError('SMS could not be sent')
    }
  },
}
