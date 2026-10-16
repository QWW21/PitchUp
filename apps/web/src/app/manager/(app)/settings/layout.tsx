import type { ReactNode } from 'react'
import { SettingsTabs } from '@/components/manager/SettingsTabs'

/** Settings — C-8, C-10, C-13: the venue's rules, its details, and the manager's account. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
      <SettingsTabs />
      <div className="mt-6 space-y-6">{children}</div>
    </>
  )
}
