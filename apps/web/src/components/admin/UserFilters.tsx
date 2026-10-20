'use client'

/** Search and filters for the user list — E15-07, kept in the URL. */
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useT } from '@/i18n/client'

const TIERS = ['Excellent', 'Good', 'Fair', 'Poor', 'Suspended'] as const

export function UserFilters(initial: {
  search: string
  role: string
  tier: string
  status: string
}) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = useState(initial.search)
  const [pending, startTransition] = useTransition()
  const go = (next: Partial<typeof initial>) => {
    const v = { ...initial, search: text, ...next }
    const q = new URLSearchParams()
    if (v.search.trim().length >= 2) q.set('search', v.search.trim())
    if (v.role) q.set('role', v.role)
    if (v.tier) q.set('tier', v.tier)
    if (v.status) q.set('status', v.status)
    startTransition(() => router.replace(`${pathname}${q.size ? `?${q}` : ''}`))
  }
  const select = 'h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm'
  return (
    <form
      role="search"
      aria-label={t('admin.users.filters.label')}
      onSubmit={e => {
        e.preventDefault()
        go({})
      }}
      className="mt-4 flex flex-wrap items-end gap-3"
    >
      <label className="flex flex-col text-xs font-medium text-neutral-700">
        {t('admin.users.filters.search')}
        <input
          type="search"
          value={text}
          onChange={e => setText(e.target.value)}
          className="h-10 w-56 max-w-full rounded-md border border-neutral-200 px-3 text-sm"
        />
      </label>
      <label className="flex flex-col text-xs font-medium text-neutral-700">
        {t('admin.users.filters.role')}
        <select
          value={initial.role}
          disabled={pending}
          onChange={e => go({ role: e.target.value })}
          className={select}
        >
          <option value="">{t('admin.users.filters.anyone')}</option>
          <option value="PLAYER">{t('admin.users.filters.players')}</option>
          <option value="MANAGER">{t('admin.users.filters.managers')}</option>
          <option value="ADMIN">{t('admin.users.filters.admins')}</option>
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium text-neutral-700">
        {t('admin.users.filters.tier')}
        <select
          value={initial.tier}
          disabled={pending}
          onChange={e => go({ tier: e.target.value })}
          className={select}
        >
          <option value="">{t('admin.users.filters.anyTier')}</option>
          {TIERS.map(tier => (
            <option key={tier} value={tier}>
              {t(`trust.tier.${tier}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium text-neutral-700">
        {t('admin.users.filters.status')}
        <select
          value={initial.status}
          disabled={pending}
          onChange={e => go({ status: e.target.value })}
          className={select}
        >
          <option value="">{t('admin.users.filters.any')}</option>
          <option value="active">{t('admin.users.active')}</option>
          <option value="suspended">{t('admin.users.suspended')}</option>
          <option value="deleted">{t('admin.users.deleted')}</option>
        </select>
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
