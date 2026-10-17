'use client'

/** Re-renders the page from the server every so often (the admin overview, E15-09). */
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(timer)
  }, [router, seconds])
  return null
}
