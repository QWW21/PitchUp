import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Imported for its side effect: validates the environment at startup so a
// missing variable fails here rather than deep inside a request. E01-05.
import '@/lib/env'

export const metadata: Metadata = {
  title: 'PitchUp',
  description: 'Book a football pitch near you',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
