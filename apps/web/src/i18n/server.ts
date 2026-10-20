/**
 * The language on the server. Pages read the visitor's cookie; API routes
 * also accept the app's x-locale header; emails and pushes use the account's
 * own choice. Without any of these: DEFAULT_LOCALE (Romanian unless the
 * environment says otherwise, as the tests do).
 */
import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import { isLocale, LOCALE_COOKIE, LOCALE_HEADER, resolveLocale, type Locale } from '@pitchup/shared'
import { env } from '@/lib/env'
import { webT } from './catalog'

export const defaultLocale = (): Locale => resolveLocale(env.DEFAULT_LOCALE)

/**
 * The language of the current request: the web's cookie, else the app's
 * header. Works in pages, routes and server actions alike, so library code
 * can ask for it without being handed it. Outside a request (a script, the
 * cron's background work) there is no request to ask: the default.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const [jar, head] = await Promise.all([cookies(), headers()])
    return resolveLocale(jar.get(LOCALE_COOKIE)?.value, head.get(LOCALE_HEADER), defaultLocale())
  } catch {
    return defaultLocale()
  }
})

/** The translator for the page being rendered. */
export async function getT() {
  return webT(await getLocale())
}

/** The language an API request asks for: the web's cookie, or the app's header. */
export function requestLocale(request: Pick<NextRequest, 'cookies' | 'headers'>): Locale {
  return resolveLocale(
    request.cookies.get(LOCALE_COOKIE)?.value,
    request.headers.get(LOCALE_HEADER),
    defaultLocale()
  )
}

/**
 * The language a request explicitly chose (cookie or app header), or null.
 * Stored on a new account; null leaves it to the platform default.
 */
export function chosenLocale(request: Pick<NextRequest, 'cookies' | 'headers'>): Locale | null {
  const value = request.cookies.get(LOCALE_COOKIE)?.value ?? request.headers.get(LOCALE_HEADER)
  return isLocale(value) ? value : null
}

/** The language to write to someone in when they aren't on a page: their own choice. */
export const userLocale = (user: { locale?: string | null }): Locale =>
  resolveLocale(user.locale, defaultLocale())
