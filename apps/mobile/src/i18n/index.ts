/**
 * The app's translations: the shared catalog (domain words, trust,
 * payments) plus the app's screens, in the language of localeStore.
 */
import {
  createTranslator,
  sharedEn,
  sharedRo,
  type CatalogShape,
  type Locale,
  type MessageKey,
} from '@pitchup/shared'
import { useLocaleStore } from '../stores/localeStore'
import { mobileEn } from './en'
import { mobileRo } from './ro'

const en = { ...sharedEn, ...mobileEn }
const ro: CatalogShape<typeof en> = { ...sharedRo, ...mobileRo }

export type MobileCatalog = typeof en
export type MobileKey = MessageKey<MobileCatalog>

const translators: Partial<Record<Locale, ReturnType<typeof createTranslator<MobileCatalog>>>> = {}

export function mobileT(locale: Locale) {
  return (translators[locale] ??= createTranslator<MobileCatalog>({ en, ro }, locale))
}

export type MobileT = ReturnType<typeof mobileT>

export const useLocale = (): Locale => useLocaleStore(s => s.locale)

export const useT = (): MobileT => mobileT(useLocale())

/** Outside React (alerts built in callbacks, the API client). */
export const currentT = (): MobileT => mobileT(useLocaleStore.getState().locale)
