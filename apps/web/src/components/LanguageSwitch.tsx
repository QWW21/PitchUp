'use client'

/**
 * RO | EN. The choice is kept in a cookie for the browser and, when someone
 * is signed in, on their account so emails and pushes follow it. The page
 * re-renders on the server in the new language.
 */
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from '@pitchup/shared'
import { useLocale, useT } from '@/i18n/client'

export function LanguageSwitch({ signedIn = false }: { signedIn?: boolean }) {
  const router = useRouter()
  const locale = useLocale()
  const t = useT()
  const [pending, start] = useTransition()

  const choose = (next: Locale) => {
    if (next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    start(async () => {
      if (signedIn) {
        // Best effort: the page switches either way.
        await fetch('/api/v1/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: next }),
        }).catch(() => undefined)
      }
      router.refresh()
    })
  }

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className={`inline-flex rounded-md border border-neutral-200 bg-white text-xs font-semibold ${pending ? 'opacity-60' : ''}`}
    >
      {LOCALES.map(l => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => choose(l)}
          aria-pressed={l === locale}
          aria-label={LOCALE_NAMES[l]}
          className={`px-2 py-1 first:rounded-l-md last:rounded-r-md ${
            l === locale ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
