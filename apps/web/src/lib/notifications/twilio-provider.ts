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
