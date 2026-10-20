import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Imported for its side effect: validates the environment at startup so a
// missing variable fails here rather than deep inside a request. E01-05.
import '@/lib/env'
import './globals.css'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { maintenanceMessage } from '@/lib/maintenance'
import { Maintenance } from '@/components/Maintenance'
import { INTL_LOCALE } from '@pitchup/shared'
import { getLocale, getT } from '@/i18n/server'
import { LocaleProvider } from '@/i18n/client'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'PitchUp', description: (await getT())('common.metaDescription') }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // E15: in maintenance mode, everyone but admins sees the message.
  const pathname = (await headers()).get('x-pathname') ?? '/'
  const message = await maintenanceMessage(pathname, async () => {
    const session = await auth()
    return session?.user.role === 'ADMIN'
  })
  const locale = await getLocale()
  return (
    <html lang={INTL_LOCALE[locale]}>
      <body>
        <LocaleProvider locale={locale}>
          {message ? <Maintenance message={message} /> : children}
        </LocaleProvider>
      </body>
    </html>
  )
}
