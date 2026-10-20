/**
 * The web's full catalog: the shared one (domain words, trust, payments)
 * plus the web's screens. Usable on the server and in the browser.
 */
import {
  createTranslator,
  sharedEn,
  sharedRo,
  type CatalogShape,
  type Locale,
  type MessageKey,
} from '@pitchup/shared'
import { webEn } from './en'
import { webRo } from './ro'

const en = { ...sharedEn, ...webEn }
const ro: CatalogShape<typeof en> = { ...sharedRo, ...webRo }

export type WebCatalog = typeof en
export type WebKey = MessageKey<WebCatalog>

const translators: Partial<Record<Locale, ReturnType<typeof createTranslator<WebCatalog>>>> = {}

export function webT(locale: Locale) {
  return (translators[locale] ??= createTranslator<WebCatalog>({ en, ro }, locale))
}

export type WebT = ReturnType<typeof webT>
