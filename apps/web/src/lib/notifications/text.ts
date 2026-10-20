/** Words notifications and emails share, in the recipient's language. */
import { formatDateLong, fromMinutes, venueClock, type Locale } from '@pitchup/shared'
import { webT } from '@/i18n/catalog'

/** "Thursday, 5 November 2026 at 18:00" in venue time. */
export function slotText(start: Date, locale: Locale): string {
  const at = venueClock(start)
  return webT(locale)('notify.at', {
    date: formatDateLong(at.date, locale),
    time: fromMinutes(at.minutes),
  })
}

/** "The pitch is flooded" → "The pitch is flooded." */
export const sentence = (text: string) =>
  /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`
