'use client'

/** Status and search for the venue list — E15-06, kept in the URL. */
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { COMPANY_STATUSES } from '@pitchup/shared'
import { useT } from '@/i18n/client'

export function VenueFilters({ status, search }: { status: string; search: string }) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = useState(search)
  const [pending, startTransition] = useTransition()
  const go = (next: { status?: string; search?: string }) => {
    const q = new URLSearchParams()
    const s = next.status ?? status
    const term = (next.search ?? text).trim()
    if (s) q.set('status', s)
    if (term.length >= 2) q.set('search', term)
    startTransition(() => router.replace(`${pathname}${q.size ? `?${q}` : ''}`))
  }
  return (
    <form
      role="search"
      aria-label={t('admin.companies.filters.label')}
      onSubmit={e => {
        e.preventDefault()
        go({})
      }}
      className="mt-3 flex flex-wrap items-end gap-3"
    >
      <label className="flex flex-col text-xs font-medium text-neutral-700">
        {t('admin.companies.filters.status')}
        <select
          value={status}
          disabled={pending}
          onChange={e => go({ status: e.target.value })}
          className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm"
        >
          <option value="">{t('admin.companies.filters.any')}</option>
          {COMPANY_STATUSES.map(s => (
            <option key={s} value={s}>
              {t(`companyStatus.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium text-neutral-700">
        {t('admin.companies.filters.search')}
        <input
          type="search"
          value={text}
          onChange={e => setText(e.target.value)}
          className="h-10 w-64 max-w-full rounded-md border border-neutral-200 px-3 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {pending ? t('admin.searching') : t('admin.search')}
      </button>
    </form>
  )
}
