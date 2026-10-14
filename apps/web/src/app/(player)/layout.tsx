import type { ReactNode } from 'react'
import { QueryProvider } from '@/components/QueryProvider'
import { TopNav } from '@/components/player/TopNav'

/** Player-facing pages: top navigation, no manager sidebar. E03-08. */
export default function PlayerLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <TopNav />
      {children}
    </QueryProvider>
  )
}
