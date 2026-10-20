import Link from 'next/link'
import { Wrench } from 'lucide-react'
import { getT } from '@/i18n/server'

/** What everyone but admins sees while maintenance mode is on (E15-05). */
export async function Maintenance({ message }: { message: string }) {
  const t = await getT()
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 text-center">
      <Wrench className="h-12 w-12 text-primary-600" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-neutral-900">{t('auth.maintenance.heading')}</h1>
      <p className="mt-2 max-w-md text-neutral-700">{message}</p>
      <Link href="/login" className="mt-6 text-sm text-neutral-500 underline">
        {t('auth.maintenance.staff')}
      </Link>
    </main>
  )
}
