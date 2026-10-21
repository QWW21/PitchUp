import type { Metadata } from 'next'
import { platformConfig } from '@/lib/admin/config'
import { PlatformConfigForm } from '@/components/admin/PlatformConfigForm'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('admin.config.title') }
}

export const dynamic = 'force-dynamic'

/** Platform settings — E15-09: the subscription prices (C-15) and maintenance mode. */
export default async function AdminConfigPage() {
  const t = await getT()
  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">{t('admin.config.heading')}</h1>
      <PlatformConfigForm initial={await platformConfig()} />
    </>
  )
}
