'use client'

/** Takes back the venue changes waiting for an admin — C-13. */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { send } from '@/lib/http'

export function WithdrawChanges() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await send('/api/v1/manager/venue', 'DELETE')
            router.refresh()
          } catch (caught) {
            setError((caught as Error).message)
          }
          setBusy(false)
        }}
        className="mt-3 h-10 rounded-md border border-amber-800 px-4 text-sm font-semibold text-amber-900 hover:bg-white disabled:opacity-60"
      >
        {busy ? 'Withdrawing…' : 'Withdraw these changes'}
      </button>
      {error && <p className="mt-2 text-error-700">{error}</p>}
    </>
  )
}
