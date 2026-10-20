import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireActiveManager } from '@/lib/manager/access'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('manager.settings.account.title') }
}

const LINKS = [
  ['/profile/settings', 'edit'],
  ['/profile/change-password', 'password'],
  ['/profile/notifications', 'notifications'],
] as const

/** The manager's own account — C-13. The forms are the profile pages every user has. */
export default async function AccountSettingsPage() {
  const { session } = await requireActiveManager()
  const t = await getT()
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true },
  })
  return (
    <section aria-labelledby="account" className="max-w-xl rounded-xl bg-white p-5 shadow-sm">
      <h2 id="account" className="text-lg font-semibold text-neutral-900">
        {me.name}
      </h2>
      <p className="text-sm text-neutral-700">
        {me.email} · {me.phone}
      </p>
      <p className="mt-2 text-sm text-neutral-500">{t('manager.settings.account.own')}</p>
      <ul className="mt-4 divide-y divide-neutral-100">
        {LINKS.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-12 items-center justify-between text-sm font-medium text-neutral-900 hover:text-primary-700"
            >
              {t(`manager.settings.account.${label}`)}
              <ChevronRight className="h-4 w-4 text-neutral-500" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
