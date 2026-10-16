'use client'

import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

/** Asks for the Stripe onboarding link and goes there (E09-09). */
export function ConnectButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      const { url } = await send<{ url: string }>('/api/v1/onboarding/stripe-connect', 'POST', {})
      window.location.assign(url)
    } catch (caught) {
      setError((caught as Error).message)
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <button
        type="button"
        onClick={() => void go()}
        disabled={busy}
        className="h-12 w-full rounded-md bg-primary-600 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {busy ? 'Opening Stripe…' : label}
      </button>
    </div>
  )
}
