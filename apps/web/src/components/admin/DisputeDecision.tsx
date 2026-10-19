'use client'

/** Decide a no-show dispute — E12-04: a note the player sees, then who was right. */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

export function DisputeDecision({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const decide = async (outcome: 'RESOLVED_PLAYER' | 'RESOLVED_MANAGER') => {
    setBusy(true)
    setError(null)
    try {
      await send(`/api/v1/admin/disputes/${bookingId}/resolve`, 'PUT', { outcome, note })
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }
  const ready = note.trim().length >= 10 && !busy

  return (
    <div className="mt-4 border-t border-neutral-100 pt-4">
      <label htmlFor={`note-${bookingId}`} className="block text-sm font-medium text-neutral-700">
        Decision note{' '}
        <span className="font-normal text-neutral-500">(the player and venue see it)</span>
      </label>
      <textarea
        id={`note-${bookingId}`}
        rows={3}
        maxLength={500}
        value={note}
        onChange={e => setNote(e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-200 p-3 text-sm"
      />
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => void decide('RESOLVED_PLAYER')}
          className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          The player was right
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => void decide('RESOLVED_MANAGER')}
          className="h-10 rounded-md border border-neutral-200 px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
        >
          The venue was right
        </button>
      </div>
    </div>
  )
}
