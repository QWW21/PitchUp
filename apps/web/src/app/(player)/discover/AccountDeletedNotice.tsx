'use client'

import { useSearchParams } from 'next/navigation'
import { useT } from '@/i18n/client'

/** After deleting an account (E08-08) the player lands here, signed out. */
export function AccountDeletedNotice() {
  const t = useT()
  const params = useSearchParams()
  if (params.get('accountDeleted') !== '1') return null
  return (
    <p role="status" className="mx-auto mt-4 max-w-7xl px-4 text-sm text-neutral-700 lg:px-6">
      <span className="block rounded-md bg-neutral-100 p-3">{t('discover.accountDeleted')}</span>
    </p>
  )
}
