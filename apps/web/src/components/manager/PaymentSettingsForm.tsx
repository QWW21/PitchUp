'use client'

/**
 * How the venue is paid — C-8: online only, online or at the venue, or at
 * the venue only; and the online deposit (0–50%) for paying at the venue.
 */
import { useState } from 'react'
import { VENUE_PAYMENT, type VenuePaymentMode, type VenuePaymentSettings } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'
import { useT } from '@/i18n/client'

const MODES: VenuePaymentMode[] = ['ONLINE', 'ONLINE_OR_VENUE', 'VENUE']

const PERCENTS = Array.from({ length: VENUE_PAYMENT.MAX_DEPOSIT_PERCENT / 5 + 1 }, (_, i) => i * 5)

export function PaymentSettingsForm({ initial }: { initial: VenuePaymentSettings }) {
  const t = useT()
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await send('/api/v1/manager/settings/payments', 'PUT', v)
      setSaved(true)
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  return (
    <form
      onSubmit={save}
      aria-label={t('manager.settings.payments.heading')}
      className="max-w-xl space-y-5 rounded-xl bg-white p-5 shadow-sm"
    >
      <fieldset>
        <legend className="text-lg font-semibold text-neutral-900">
          {t('manager.settings.payments.heading')}
        </legend>
        <div className="mt-3 space-y-2">
          {MODES.map(m => (
            <label
              key={m}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 focus-within:ring-2 focus-within:ring-primary-600 ${
                v.paymentMode === m ? 'border-primary-600 bg-primary-50' : 'border-neutral-200'
              }`}
            >
              <input
                type="radio"
                name="paymentMode"
                className="mt-1 accent-primary-600"
                checked={v.paymentMode === m}
                onChange={() => setV(p => ({ ...p, paymentMode: m }))}
              />
              <span>
                <span className="block text-sm font-medium text-neutral-900">
                  {t(`manager.settings.payments.modes.${m}.label`)}
                </span>
                <span className="block text-sm text-neutral-700">
                  {t(`manager.settings.payments.modes.${m}.hint`)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {v.paymentMode !== 'ONLINE' && (
        <div>
          <label htmlFor="deposit" className="block text-sm font-medium text-neutral-900">
            {t('manager.settings.payments.deposit')}
          </label>
          <select
            id="deposit"
            value={v.depositPercent}
            onChange={e => setV(p => ({ ...p, depositPercent: Number(e.target.value) }))}
            className="mt-1 h-11 w-40 rounded-md border border-neutral-200 bg-white px-3 text-sm"
          >
            {PERCENTS.map(n => (
              <option key={n} value={n}>
                {n === 0 ? t('manager.settings.payments.noDeposit') : `${n}%`}
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-neutral-700">
            {v.depositPercent === 0
              ? t('manager.settings.payments.noDepositHint')
              : t('manager.settings.payments.depositHint')}
          </p>
        </div>
      )}

      {error && <Alert>{error}</Alert>}
      {saved && (
        <p role="status" className="text-sm font-medium text-primary-700">
          {t('manager.settings.saved')}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-11 rounded-md bg-primary-600 px-5 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {busy ? t('manager.settings.saving') : t('manager.settings.save')}
      </button>
    </form>
  )
}
