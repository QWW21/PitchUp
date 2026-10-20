/** Phone verification SMS — plain text only, in the recipient's language. */
import type { Locale } from '@pitchup/shared'
import { webT } from '@/i18n/catalog'

export function renderPhoneOtpSms(code: string, expiryMinutes: number, locale: Locale): string {
  // Kept under 160 characters (and plain letters) so it is billed as one segment.
  return webT(locale)('email.sms.phoneCode', { code, minutes: expiryMinutes })
}
