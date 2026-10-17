'use client'

/**
 * Platform settings — E15-09. Only what changed is saved; turning maintenance
 * on asks first, since everyone but admins loses the site.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { PlatformConfigView } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

export function PlatformConfigForm({ initial }: { initial: PlatformConfigView }) {
  const router = useRouter()
  const [saved, setSaved] = useState(initial)
  const [fee, setFee] = useState(String(initial.platformFeePercent))
  const [maintenance, setMaintenance] = useState(initial.maintenanceMode)
  const [message, setMessage] = useState(initial.maintenanceMessage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const feeNumber = Number(fee)
  const feeValid = fee !== '' && Number.isInteger(feeNumber) && feeNumber >= 0 && feeNumber <= 20
  const changes = {
    ...(feeValid && feeNumber !== saved.platformFeePercent
      ? { platformFeePercent: feeNumber }
      : {}),
    ...(maintenance !== saved.maintenanceMode ? { maintenanceMode: maintenance } : {}),
    ...(message.trim() !== saved.maintenanceMessage ? { maintenanceMessage: message.trim() } : {}),
  }
  const dirty = Object.keys(changes).length > 0
  const messageValid = message.trim().length >= 10 && message.trim().length <= 500

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      changes.maintenanceMode === true &&
      !window.confirm(
        'Turn maintenance mode on? Everyone except admins will see the maintenance message.'
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      const next = await send<PlatformConfigView>('/api/v1/admin/config', 'PUT', changes)
      setSaved(next)
      setDone(true)
      router.refresh()
    } catch (caught) {
      // The form keeps what was typed, so it can be sent again.
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  return (
    <form onSubmit={save} className="mt-6 max-w-xl space-y-6 rounded-xl bg-white p-5 shadow-sm">
      <div>
        <label htmlFor="fee" className="block text-sm font-medium text-neutral-900">
          PitchUp commission (%)
        </label>
        <input
          id="fee"
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          value={fee}
          onChange={e => setFee(e.target.value)}
          aria-describedby="fee-hint"
          className="mt-1 h-11 w-32 rounded-md border border-neutral-200 px-3 text-sm"
        />
        <p id="fee-hint" className="mt-1 text-sm text-neutral-700">
          0–20%, taken from what venues receive. Applies to new bookings; earlier ones keep theirs.
          Now: {saved.platformFeePercent}%.
        </p>
        {!feeValid && <p className="mt-1 text-sm text-error-600">A whole number from 0 to 20.</p>}
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-neutral-900">Maintenance mode</legend>
        <label className="mt-2 flex items-center gap-3 text-sm text-neutral-900">
          <input
            type="checkbox"
            role="switch"
            checked={maintenance}
            onChange={e => setMaintenance(e.target.checked)}
            className="h-5 w-5 accent-primary-600"
          />
          {maintenance ? 'On: everyone but admins sees the message' : 'Off'}
        </label>
        <label htmlFor="message" className="mt-4 block text-sm font-medium text-neutral-900">
          Maintenance message
        </label>
        <textarea
          id="message"
          rows={3}
          maxLength={500}
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-200 p-3 text-sm"
        />
        {!messageValid && (
          <p className="mt-1 text-sm text-error-600">Between 10 and 500 characters.</p>
        )}
      </fieldset>

      {error && <Alert>{error}</Alert>}
      {done && !dirty && (
        <p role="status" className="text-sm font-medium text-primary-700">
          Settings saved.
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !dirty || !feeValid || !messageValid}
        className="h-11 rounded-md bg-primary-600 px-5 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
}
