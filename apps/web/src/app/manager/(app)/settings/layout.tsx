import type { ReactNode } from 'react'
import { SettingsTabs } from '@/components/manager/SettingsTabs'
import { getT } from '@/i18n/server'

/** Settings — C-8, C-10, C-13: the venue's rules, its details, and the manager's account. */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getT()
  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">{t('manager.settings.heading')}</h1>
      <SettingsTabs />
      <div className="mt-6 space-y-6">{children}</div>
    </>
  )
}
