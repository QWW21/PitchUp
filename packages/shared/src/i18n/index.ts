/**
 * Translations shared by web, mobile and the server. Each app merges this
 * catalog with its own screen text (see the app's src/i18n).
 */
import { createTranslator, type Locale } from './core'
import { en } from './en'
import { ro } from './ro'

export * from './core'
export { en as sharedEn } from './en'
export { ro as sharedRo } from './ro'

export const sharedCatalogs = { en, ro }
export type SharedCatalog = typeof en

const cache: Partial<Record<Locale, ReturnType<typeof createTranslator<SharedCatalog>>>> = {}

/** The shared translator for a language (cached: catalogs never change at runtime). */
export function sharedT(locale: Locale) {
  return (cache[locale] ??= createTranslator<SharedCatalog>(sharedCatalogs, locale))
}

/** First letter up: Romanian weekdays and months are lower-case mid-sentence. */
export const capitalise = (text: string): string =>
  text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text

/** The day of the week, 0 = Sunday, for a YYYY-MM-DD calendar date. */
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay()

/** "Thursday, 5 November 2026" · "Joi, 5 noiembrie 2026". By hand, not Intl (Hermes). */
export function formatDateLong(date: string, locale: Locale): string {
  const t = sharedT(locale)
  return capitalise(
    t('date.long', {
      weekday: t(`weekday.long.${weekdayOf(date)}` as 'weekday.long.0'),
      day: Number(date.slice(8, 10)),
      month: t(`month.long.${Number(date.slice(5, 7))}` as 'month.long.1'),
      year: date.slice(0, 4),
    })
  )
}

/** "October 2026" · "Octombrie 2026", from any YYYY-MM-DD in that month. */
export function formatMonth(date: string, locale: Locale): string {
  const t = sharedT(locale)
  return capitalise(
    t('date.monthYear', {
      month: t(`month.long.${Number(date.slice(5, 7))}` as 'month.long.1'),
      year: date.slice(0, 4),
    })
  )
}

/** Short weekday name, 0 = Sunday. */
export const weekdayShort = (day: number, locale: Locale) =>
  sharedT(locale)(`weekday.short.${day}` as 'weekday.short.0')

/** Long weekday name, capitalised, 0 = Sunday. */
export const weekdayLong = (day: number, locale: Locale) =>
  capitalise(sharedT(locale)(`weekday.long.${day}` as 'weekday.long.0'))

/** Short month name, 1 = January. */
export const monthShort = (month: number, locale: Locale) =>
  sharedT(locale)(`month.short.${month}` as 'month.short.1')

/** "1 hour", "3 ore", "20 de ore". */
export const hoursText = (hours: number, locale: Locale) =>
  sharedT(locale)('duration.hours', { count: hours })
