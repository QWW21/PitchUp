'use client'

/**
 * How the venue takes bookings — C-10 and C-13: confirm every booking at once
 * or each by hand, and the refund policy players get when they cancel. Both
 * apply to bookings made from now on.
 */
import { useState } from 'react'
import {
  BOOKING_APPROVAL,
  RefundPolicySchema,
  describeRefundPolicy,
  type VenueBookingSettings,
} from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

const PERCENTS = Array.from({ length: 21 }, (_, i) => i * 5)

export function BookingSettingsForm({ initial }: { initial: VenueBookingSettings }) {
  const [auto, setAuto] = useState(initial.autoApproveBookings)
  const [policy, setPolicy] = useState(initial.refundPolicy)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const checked = RefundPolicySchema.safeParse(policy)
  const problem = checked.success ? null : (checked.error.issues[0]?.message ?? 'Check the policy')
  const hours =
    (key: 'fullRefundHours' | 'partialRefundHours') => (e: { target: { value: string } }) =>
      setPolicy(p => ({ ...p, [key]: e.target.value === '' ? 0 : Number(e.target.value) }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (problem) return
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await send('/api/v1/manager/settings/bookings', 'PUT', {
        autoApproveBookings: auto,
        refundPolicy: policy,
      })
      setSaved(true)
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  return (
    <form
      onSubmit={save}
      aria-label="Bookings and refunds"
      className="max-w-xl space-y-5 rounded-xl bg-white p-5 shadow-sm"
    >
      <fieldset>
        <legend className="text-lg font-semibold text-neutral-900">New bookings</legend>
        <div className="mt-3 space-y-2">
          {[
            {
              value: true,
              label: 'Confirm every booking automatically',
              hint: 'Players are booked as soon as they pay. You can still cancel a booking, with a full refund.',
            },
            {
              value: false,
              label: 'I confirm each booking',
              hint: `Players pay, and the slot is held until you accept or decline. Without an answer it is declined ${BOOKING_APPROVAL.ANSWER_WITHIN_HOURS} hours after booking, or ${BOOKING_APPROVAL.CUTOFF_HOURS_BEFORE_START} hours before kick-off, and refunded.`,
            },
          ].map(o => (
            <label
              key={String(o.value)}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 focus-within:ring-2 focus-within:ring-primary-600 ${
                auto === o.value ? 'border-primary-600 bg-primary-50' : 'border-neutral-200'
              }`}
            >
              <input
                type="radio"
                name="autoApprove"
                className="mt-1 accent-primary-600"
                checked={auto === o.value}
                onChange={() => setAuto(o.value)}
              />
              <span>
                <span className="block text-sm font-medium text-neutral-900">{o.label}</span>
                <span className="block text-sm text-neutral-700">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold text-neutral-900">Refund policy</legend>
        <p className="mt-1 text-sm text-neutral-700">
          What players get back when they cancel. Bookings keep the policy they were made under.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="full-hours" className="block text-sm font-medium text-neutral-900">
              Full refund up to (hours before)
            </label>
            <input
              id="full-hours"
              type="number"
              inputMode="numeric"
              min={0}
              max={168}
              value={policy.fullRefundHours}
              onChange={hours('fullRefundHours')}
              className="mt-1 h-11 w-full rounded-md border border-neutral-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="partial-percent" className="block text-sm font-medium text-neutral-900">
              Then refund
            </label>
            <select
              id="partial-percent"
              value={policy.partialRefundPercent}
              onChange={e =>
                setPolicy(p => ({ ...p, partialRefundPercent: Number(e.target.value) }))
              }
              className="mt-1 h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
            >
              {PERCENTS.map(n => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="partial-hours" className="block text-sm font-medium text-neutral-900">
              Up to (hours before)
            </label>
            <input
              id="partial-hours"
              type="number"
              inputMode="numeric"
              min={0}
              max={168}
              value={policy.partialRefundHours}
              onChange={hours('partialRefundHours')}
              disabled={policy.partialRefundPercent === 0}
              className="mt-1 h-11 w-full rounded-md border border-neutral-200 px-3 text-sm disabled:bg-neutral-100"
            />
          </div>
        </div>
        <p
          className="mt-3 rounded-md bg-neutral-100 p-3 text-sm text-neutral-900"
          aria-live="polite"
        >
          {problem ?? `Players see: ${describeRefundPolicy(policy)}`}
        </p>
      </fieldset>

      {error && <Alert>{error}</Alert>}
      {saved && (
        <p role="status" className="text-sm font-medium text-primary-700">
          Saved.
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !!problem}
        className="h-11 rounded-md bg-primary-600 px-5 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
