/**
 * Translation core — Romanian by default, English as the alternative.
 *
 * One small translator for web, mobile and the server, so the three agree on
 * keys, plurals and interpolation without a library each:
 *
 * - a catalog is a nested object of strings; `t('booking.status.CONFIRMED')`
 *   walks it, and the key is type-checked against the English catalog;
 * - `{name}` in a string is replaced from the params;
 * - a plural is `{ one, few, other }` chosen by `params.count`. Romanian has
 *   three forms (1 meci · 2 meciuri · 20 de meciuri); English uses one/other.
 *
 * The Romanian catalog must have exactly the English one's shape, so a
 * missing translation is a type error, not a blank on screen.
 */

export const LOCALES = ['ro', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ro'

/** The web remembers the choice in this cookie; the app sends it in LOCALE_HEADER. */
export const LOCALE_COOKIE = 'pitchup-locale'
export const LOCALE_HEADER = 'x-locale'

export const LOCALE_NAMES: Record<Locale, string> = { ro: 'Română', en: 'English' }

/** For Intl and <html lang>. */
export const INTL_LOCALE: Record<Locale, string> = { ro: 'ro-RO', en: 'en-GB' }

export function isLocale(value: unknown): value is Locale {
  return value === 'ro' || value === 'en'
}

export interface Plural {
  one: string
  /** Romanian only: 0 and 2–19 (and 102–119…). Falls back to `other`. */
  few?: string
  other: string
}

export interface Catalog {
  [key: string]: string | Plural | Catalog
}

/** The same shape with every string widened, for the other language to satisfy. */
export type CatalogShape<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends Plural ? Plural : CatalogShape<T[K]>
}

/** Every key that leads to a string or a plural, as `a.b.c`. */
export type MessageKey<T> = {
  [K in keyof T & (string | number)]: T[K] extends string | Plural
    ? `${K}`
    : T[K] extends object
      ? `${K}.${MessageKey<T[K]>}`
      : never
}[keyof T & (string | number)]

export type Params = Record<string, string | number>

/** CLDR plural categories for the two languages. */
export function pluralCategory(locale: Locale, n: number): 'one' | 'few' | 'other' {
  if (locale === 'en') return n === 1 ? 'one' : 'other'
  if (n === 1) return 'one'
  const mod100 = Math.abs(n) % 100
  if (n === 0 || !Number.isInteger(n) || (mod100 >= 1 && mod100 <= 19)) return 'few'
  return 'other'
}

function isPlural(value: unknown): value is Plural {
  return typeof value === 'object' && value !== null && 'one' in value && 'other' in value
}

function lookup(catalog: Catalog, key: string): string | Plural | undefined {
  let node: unknown = catalog
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' || isPlural(node) ? node : undefined
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  )
}

export type Translate<T> = (key: MessageKey<T>, params?: Params) => string

/** What createTranslator returns: t(key), plus the helpers below. */
export type Translator<T> = Translate<T> & {
  /** Whether the catalog has this key. */
  has: (key: string) => boolean
  /**
   * A message that may be a catalog key (a validation message from the
   * schemas, an API error): translated when it is one, as it is otherwise.
   */
  text: (message: string, params?: Params) => string
  locale: Locale
}

/**
 * A translator for one language. An unknown key (only possible through a
 * cast or a server message that predates the catalogs) comes back as the key
 * itself, so it shows up in review instead of as a blank.
 */
export function createTranslator<T extends Catalog>(
  catalogs: Record<Locale, CatalogShape<T>>,
  locale: Locale
): Translator<T> {
  const catalog = catalogs[locale] as Catalog
  const t = ((key: string, params?: Params) => {
    const entry = lookup(catalog, key)
    if (entry === undefined) return key
    if (typeof entry === 'string') return interpolate(entry, params)
    const count = typeof params?.count === 'number' ? params.count : 0
    const form = pluralCategory(locale, count)
    return interpolate(
      (form === 'few' ? entry.few : form === 'one' ? entry.one : undefined) ?? entry.other,
      params
    )
  }) as unknown as Translator<T>
  t.has = key => lookup(catalog, key) !== undefined
  t.text = (message, params) => (t.has(message) ? t(message as MessageKey<T>, params) : message)
  t.locale = locale
  return t
}

/**
 * Picks the language: an explicit choice (cookie, app header, account) when
 * there is one, otherwise the platform default.
 */
export function resolveLocale(...candidates: unknown[]): Locale {
  for (const c of candidates) if (isLocale(c)) return c
  return DEFAULT_LOCALE
}
