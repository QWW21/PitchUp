'use client'

/**
 * Settings → Subscription — C-15. PitchUp takes no commission: the venue
 * pays monthly or yearly, and is live only while it does. The first time,
 * a free month comes first. With Stripe the card is saved through its card
 * form; in test mode nothing is asked, and two buttons make the next bill
 * pay or fail.
 */
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import {
  formatDateLong,
  type BillingInterval,
  type ManagerBilling,
  type PaymentConfig,
  type SubscriptionBill,
} from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'
import { useLocale, useT } from '@/i18n/client'

const INTERVALS: BillingInterval[] = ['MONTHLY', 'YEARLY']

export function SubscriptionPanel({ initial }: { initial: ManagerBilling }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [b, setB] = useState(initial)
  const [interval, setInterval] = useState<BillingInterval>(initial.interval ?? 'MONTHLY')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const config = useQuery({
    queryKey: ['payments-config'],
    queryFn: () =>
      fetch('/api/v1/payments/config')
        .then(r => r.json())
        .then(j => j.data as PaymentConfig),
    enabled: b.provider === 'stripe',
  })
  const stripePromise = useMemo(
    () => (config.data?.publishableKey ? loadStripe(config.data.publishableKey) : null),
    [config.data?.publishableKey]
  )

  const date = (iso: string | null) => (iso ? formatDateLong(iso.slice(0, 10), locale) : '')
  const amount = (bill: SubscriptionBill, i: BillingInterval) =>
    t(i === 'YEARLY' ? 'manager.billing.perYear' : 'manager.billing.perMonth', {
      amount: bill.total,
    })
  const live = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLING'].includes(b.status)
  const noCard = b.status === 'TRIALING' && !b.interval
  const canStart = !live || noCard

  const act = async (
    fn: () => Promise<ManagerBilling | { billing: ManagerBilling; clientSecret: string | null }>
  ) => {
    setBusy(true)
    setError(null)
    try {
      const result = await fn()
      if ('billing' in result) {
        setB(result.billing)
        setClientSecret(result.clientSecret)
      } else {
        setB(result)
      }
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  const statusLine = () => {
    if (noCard) return t('manager.billing.line.trialNoCard', { date: date(b.trialEndsAt) })
    switch (b.status) {
      case 'TRIALING':
        return t('manager.billing.line.TRIALING', { date: date(b.trialEndsAt) })
      case 'ACTIVE':
        return t('manager.billing.line.ACTIVE', {
          date: date(b.periodEnd),
          amount: b.nextBill?.total ?? 0,
        })
      case 'PAST_DUE':
        return t('manager.billing.line.PAST_DUE', { date: date(b.pauseOn) })
      case 'CANCELLING':
        return t('manager.billing.line.CANCELLING', { date: date(b.periodEnd) })
      default:
        return t(`manager.billing.line.${b.status}`)
    }
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="sub-status" className="rounded-xl bg-white p-5 shadow-sm">
        <h2 id="sub-status" className="text-base font-semibold text-neutral-900">
          {t('manager.billing.heading')}
        </h2>
        <p className="mt-1 text-sm text-neutral-700">{t('manager.billing.intro')}</p>
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              live && b.status !== 'PAST_DUE'
                ? 'bg-primary-50 text-primary-700'
                : 'bg-warning-50 text-neutral-900'
            }`}
          >
            {t(`manager.billing.status.${b.status}`)}
          </span>
          <span className="text-neutral-900">{statusLine()}</span>
        </p>
        {b.nextBill && b.interval && !noCard && (
          <p className="mt-2 text-sm text-neutral-700">
            {t('manager.billing.nextBill', {
              price: amount(b.nextBill, b.interval),
              interval: t(`manager.billing.interval.${b.interval}`).toLowerCase(),
            })}
          </p>
        )}
      </section>

      {!b.provider ? (
        <Alert>{t('manager.billing.unavailable')}</Alert>
      ) : (
        <section aria-labelledby="sub-plan" className="rounded-xl bg-white p-5 shadow-sm">
          <h2 id="sub-plan" className="text-base font-semibold text-neutral-900">
            {t('manager.billing.choose')}
          </h2>
          <fieldset className="mt-3">
            <legend className="sr-only">{t('manager.billing.choose')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {INTERVALS.map(i => {
                const bill = b.prices[i]
                const on = interval === i
                return (
                  <label
                    key={i}
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 ${
                      on ? 'border-primary-600 ring-1 ring-primary-600' : 'border-neutral-200'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <input
                        type="radio"
                        name="interval"
                        checked={on}
                        onChange={() => setInterval(i)}
                        className="accent-primary-600"
                      />
                      {t(`manager.billing.interval.${i}`)}
                      {b.interval === i && live && !noCard && (
                        <span className="text-xs font-normal text-neutral-500">
                          {t('manager.billing.current')}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-xl font-bold text-neutral-900">
                      {amount(bill, i)}
                    </span>
                    {bill.extraPitches > 0 && (
                      <span className="text-xs text-neutral-700">
                        {t('manager.billing.breakdown', {
                          base: bill.base,
                          count: bill.extraPitches,
                          each: bill.extraEach,
                        })}
                      </span>
                    )}
                    {bill.discounted && (
                      <span className="text-xs text-primary-700">
                        {t('manager.billing.discount')}
                      </span>
                    )}
                    {i === 'YEARLY' && (
                      <span className="text-xs text-neutral-500">
                        {t('manager.billing.yearly')}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>
          <p className="mt-2 text-xs text-neutral-500">
            {t('manager.billing.pitches', { count: b.activePitches })}
          </p>

          {error && (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {canStart && !clientSecret && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(() => send('/api/v1/manager/billing/subscribe', 'POST', { interval }))
                }
                className="h-11 rounded-md bg-primary-600 px-5 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {noCard
                  ? t('manager.billing.addCard')
                  : b.trialAvailable
                    ? t('manager.billing.startTrial', { days: b.trialDays })
                    : t('manager.billing.subscribe', { amount: b.prices[interval].total })}
              </button>
            )}
            {live && !noCard && b.status !== 'CANCELLING' && interval !== b.interval && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(() => send('/api/v1/manager/billing/interval', 'PUT', { interval }))
                }
                className="h-11 rounded-md border border-primary-600 px-4 font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-60"
              >
                {t('manager.billing.switch', {
                  interval: t(`manager.billing.interval.${interval}`).toLowerCase(),
                })}
              </button>
            )}
            {b.status === 'CANCELLING' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void act(() => send('/api/v1/manager/billing/resume', 'POST'))}
                className="h-11 rounded-md bg-primary-600 px-5 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {t('manager.billing.resume')}
              </button>
            )}
            {['TRIALING', 'ACTIVE', 'PAST_DUE'].includes(b.status) && !noCard && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t('manager.billing.confirmCancel'))) {
                    void act(() => send('/api/v1/manager/billing/cancel', 'POST'))
                  }
                }}
                className="h-11 rounded-md px-4 text-sm font-semibold text-error-600 hover:bg-error-50 disabled:opacity-60"
              >
                {t('manager.billing.cancel')}
              </button>
            )}
          </div>
          {canStart && b.trialAvailable && (
            <p className="mt-2 text-xs text-neutral-500">
              {t('manager.billing.trialNote', {
                days: b.trialDays,
                price: amount(b.prices[interval], interval),
              })}
            </p>
          )}

          {clientSecret && stripePromise && (
            <Elements stripe={stripePromise}>
              <CardForm
                clientSecret={clientSecret}
                onDone={() => {
                  setClientSecret(null)
                  void act(() => send('/api/v1/manager/billing', 'GET'))
                }}
              />
            </Elements>
          )}

          {b.provider === 'test' && b.interval && live && (
            <div className="mt-4 rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">
              <p>{t('manager.billing.testMode')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['paid', 'failed'] as const).map(outcome => (
                  <button
                    key={outcome}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        send('/api/v1/payments/test/subscription', 'POST', { outcome })
                      )
                    }
                    className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-900 hover:bg-neutral-100 disabled:opacity-60"
                  >
                    {t(`manager.billing.test.${outcome}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="sub-invoices" className="rounded-xl bg-white p-5 shadow-sm">
        <h2 id="sub-invoices" className="text-base font-semibold text-neutral-900">
          {t('manager.billing.invoices')}
        </h2>
        {b.invoices.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">{t('manager.billing.noInvoices')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100 text-sm">
            {b.invoices.map(i => (
              <li key={i.id} className="flex justify-between py-2">
                <span className="text-neutral-900">{date(i.paidAt)}</span>
                <span className="text-neutral-700">
                  {i.amount} lei · {t(`manager.billing.interval.${i.interval}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** Stripe's card form: a SetupIntent for a free month, else the first invoice's payment. */
function CardForm({ clientSecret, onDone }: { clientSecret: string; onDone: () => void }) {
  const t = useT()
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!stripe || !elements) return
    setBusy(true)
    setError(null)
    const card = elements.getElement(CardElement)!
    const s = stripe as Stripe
    const result = clientSecret.startsWith('seti_')
      ? await s.confirmCardSetup(clientSecret, { payment_method: { card } })
      : await s.confirmCardPayment(clientSecret, { payment_method: { card } })
    if (result.error) setError(result.error.message ?? t('manager.billing.cardFailed'))
    else onDone()
    setBusy(false)
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-medium text-neutral-900">{t('manager.billing.card')}</p>
      <div className="rounded-md border border-neutral-200 p-3">
        <CardElement options={{ hidePostalCode: true, style: { base: { fontSize: '16px' } } }} />
      </div>
      {error && <Alert>{error}</Alert>}
      <button
        type="button"
        disabled={busy || !stripe}
        onClick={() => void save()}
        className="h-11 rounded-md bg-primary-600 px-5 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {t('manager.billing.saveCard')}
      </button>
    </div>
  )
}
