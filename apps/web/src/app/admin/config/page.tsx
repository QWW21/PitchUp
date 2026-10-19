import type { Metadata } from 'next'
import { platformConfig } from '@/lib/admin/config'
import { PlatformConfigForm } from '@/components/admin/PlatformConfigForm'

export const metadata: Metadata = { title: 'Settings | PitchUp admin' }

export const dynamic = 'force-dynamic'

/** Platform settings — E15-09: the commission and maintenance mode. */
export default async function AdminConfigPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">Platform settings</h1>
      <PlatformConfigForm initial={await platformConfig()} />
    </>
  )
}
