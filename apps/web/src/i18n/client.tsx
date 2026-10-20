'use client'

/**
 * The language in the browser. The root layout decides it on the server and
 * hands it down; client components read it with useLocale / useT. Both
 * catalogs are bundled, so switching needs no extra download.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULT_LOCALE, type Locale } from '@pitchup/shared'
import { webT } from './catalog'

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export const useLocale = (): Locale => useContext(LocaleContext)

export const useT = () => webT(useLocale())
