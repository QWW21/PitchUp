'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

/** One client per browser session; created in state so a re-render keeps the cache. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 2 * 60 * 1000, refetchOnWindowFocus: false } },
      })
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
