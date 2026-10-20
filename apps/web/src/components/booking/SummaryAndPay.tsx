'use client'

/**
 * Step 4: summary and payment — E05-10 (UIUX_SPEC §7.4). Named SummaryAndPay
 * since E15: as SummaryStep.tsx, webpack gave it module id 0, which Next leaves
 * out of the client manifest, and the page failed.
 *
 * Pay creates the booking (PENDING, holding the slot), then completes the
 * payment: with Stripe Elements when Stripe is set up, or with the built-in
 * test payment otherwise. A declined card leaves the player here to try
 * again; the next attempt replaces the unpaid booking.
 *
 * Paying at the venue (C-8): where the venue allows it and the player's trust
 * score is 70+, they choose how to pay; only the deposit is charged here,
 * and with no deposit nothing is.
 */
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { CalendarDays, Clock, Info, MapPin, NotebookPen, Shirt, Users } from 'lucide-react'
import {
  INTL_LOCALE,
  bookingPrice,
  describePayment,
  paymentMethodLabel,
  paymentSplit,
  formatDateLong,
  formatDuration,
  freeCancellationUntil,
  partialRefundUntil,
  describeRefundPolicy,
  DEFAULT_REFUND_POLICY,
  shirtSetsFor,
  venueTimeToUtc,
  toMinutes,
  type BookingConfirmation,
  type BookingPaymentMethod,
  type Locale,
  type CreateBookingResult,
  type PaymentOptions,
  type PaymentConfig,
  type SavedCard,
} from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { useLocale, useT } from '@/i18n/client'
import type { WebT } from '@/i18n/catalog'
import { stepPath, useBooking, type BookingDraft } from './draft'

interface ApiError {
  code: string
  message: string
  details?: { reason?: string }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body || body.error) {
    throw (body?.error as ApiError) ?? { code: 'NETWORK', message: '' }
  }
  return body.data as T
}

const KNOWN_REASONS = [
  'SLOT_CONFLICT',
  'TRUST_SCORE_TOO_LOW',
  'SHIRTS_UNAVAILABLE',
  'PAYMENT_METHOD_UNAVAILABLE',
  'ACTIVE_BOOKING_LIMIT',
] as const
type KnownReason = (typeof KNOWN_REASONS)[number]
/** Our own words for the refusals we know; the server's message otherwise. */
const describe = (t: WebT, e: ApiError) => {
  const reason = e.details?.reason
  if (reason && (KNOWN_REASONS as readonly string[]).includes(reason)) {
    return t(`booking.summary.error.${reason as KnownReason}`)
  }
  return e.message || t('booking.summary.error.generic')
}
/** Refusals that come from the player's trust score link to the trust page. */
const TRUST_REASONS = ['TRUST_SCORE_TOO_LOW', 'TRUST_TIER_INSUFFICIENT', 'ACTIVE_BOOKING_LIMIT']

const atVenue = (locale: Locale) =>
  new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  })

function bookingBody(
  pitchId: string,
  d: BookingDraft,
  method: BookingPaymentMethod,
  paymentMethodId?: string
) {
  return {
    paymentMethod: method,
    pitchId,
    date: d.date,
    startTime: d.startTime,
    endTime: d.endTime,
    teamCount: d.teamCount,
    teamsData: Array.from({ length: d.teamCount }, (_, t) => ({
      playerCount: d.players[t],
      ...(d.wantsShirts && d.colours[t] ? { colour: d.colours[t] } : {}),
    })),
    wantsShirts: d.wantsShirts,
    ...(d.note.trim() ? { noteToManager: d.note.trim() } : {}),
    ...(paymentMethodId ? { paymentMethodId } : {}),
  }
}

export function SummaryStep() {
  const t = useT()
  const locale = useLocale()
  const { pitch, draft, ready } = useBooking()
  const router = useRouter()
  const config = useQuery({
    queryKey: ['payment-config'],
    queryFn: () => api<PaymentConfig>('/api/v1/payments/config'),
  })
  const options = useQuery({
    queryKey: ['payment-options', pitch.id],
    queryFn: () => api<PaymentOptions>(`/api/v1/pitches/${pitch.id}/payment-options`),
  })
  const [chosen, setChosen] = useState<BookingPaymentMethod | null>(null)
  const methods = options.data?.methods ?? []
  const method = chosen && methods.includes(chosen) ? chosen : (methods[0] ?? null)

  useEffect(() => {
    if (ready && !draft.teamsDone)
      router.replace(stepPath(pitch.id, draft.startTime ? 'teams' : 'date'))
  }, [ready, draft.teamsDone, draft.startTime, pitch.id, router])

  const stripePromise = useMemo(
    () => (config.data?.publishableKey ? loadStripe(config.data.publishableKey) : null),
    [config.data?.publishableKey]
  )

  if (!draft.teamsDone || !draft.date || !draft.startTime || !draft.endTime || !draft.minutes) {
    return null
  }

  const price = bookingPrice(pitch.hourlyRate, draft.minutes)
  const split = method ? paymentSplit(price.total, method, options.data!.depositPercent) : null
  const sets = shirtSetsFor(draft.teamCount, draft.wantsShirts)
  const start = venueTimeToUtc(draft.date, toMinutes(draft.startTime))
  // C-10: the venue's own policy, which the booking keeps.
  const policy = options.data?.refundPolicy ?? DEFAULT_REFUND_POLICY
  const freeUntil = freeCancellationUntil(start, policy)
  const partUntil = partialRefundUntil(start, policy)
  const now = Date.now()
  const players = draft.players.slice(0, draft.teamCount).reduce((a, b) => a + b, 0)
  const done = (booking: BookingConfirmation | CreateBookingResult) =>
    router.push(
      `${stepPath(pitch.id, 'confirmation')}?booking=${'bookingId' in booking ? booking.bookingId : booking.id}`
    )

  return (
    <section aria-labelledby="summary-heading" className="space-y-4">
      <h1 id="summary-heading" className="text-xl font-semibold text-neutral-900">
        {t('booking.summary.heading')}
      </h1>

      <ul className="space-y-3 rounded-xl bg-neutral-100 p-4 text-sm text-neutral-900">
        <Row icon={<CalendarDays />}>{formatDateLong(draft.date, locale)}</Row>
        <Row icon={<Clock />}>
          {draft.startTime}–{draft.endTime} ({formatDuration(draft.minutes)})
        </Row>
        <Row icon={<MapPin />}>
          {pitch.name} · {pitch.companyName}
        </Row>
        <Row icon={<Users />}>
          {t('booking.summary.teamsPlayers', { teams: draft.teamCount, players })}
        </Row>
        {sets > 0 && <Row icon={<Shirt />}>{t('booking.summary.freeShirts', { count: sets })}</Row>}
        {draft.note.trim() && (
          <Row icon={<NotebookPen />}>
            <span className="line-clamp-1">{draft.note.trim()}</span>
          </Row>
        )}
      </ul>

      <section aria-labelledby="price-heading" className="rounded-xl bg-white p-4 shadow-sm">
        <h2 id="price-heading" className="text-base font-semibold text-neutral-900">
          {t('booking.summary.price')}
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between text-neutral-700">
            <dt>
              {t('booking.teams.pitchLine', {
                duration: formatDuration(draft.minutes),
                rate: pitch.hourlyRate,
              })}
            </dt>
            <dd>{price.total} RON</dd>
          </div>
          {sets > 0 && (
            <div className="flex justify-between text-neutral-700">
              <dt>{t('booking.summary.shirts')}</dt>
              <dd>{t('booking.teams.free')}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold text-neutral-900">
            <dt>{t('booking.teams.total')}</dt>
            <dd className="font-mono">{price.total} RON</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-neutral-500">{t('booking.summary.noFee')}</p>
      </section>

      {methods.length > 1 && (
        <fieldset className="rounded-xl bg-white p-4 shadow-sm">
          <legend className="text-base font-semibold text-neutral-900">
            {t('booking.summary.howToPay')}
          </legend>
          <div className="mt-3 space-y-2">
            {methods.map(m => {
              const s = paymentSplit(price.total, m, options.data!.depositPercent)
              return (
                <label
                  key={m}
                  className={`flex cursor-pointer gap-3 rounded-lg border p-3 focus-within:ring-2 focus-within:ring-primary-600 ${
                    m === method ? 'border-primary-600 bg-primary-50' : 'border-neutral-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    className="mt-1 accent-primary-600"
                    checked={m === method}
                    onChange={() => setChosen(m)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-neutral-900">
                      {s.payNow === 0 && m !== 'ONLINE'
                        ? t('booking.summary.payAtVenue')
                        : paymentMethodLabel(m, locale)}
                    </span>
                    <span className="block text-sm text-neutral-700">
                      {describePayment(s, locale)}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      )}
      {methods.length === 1 && split && split.method !== 'ONLINE' && (
        <p className="rounded-xl bg-white p-4 text-sm font-medium text-neutral-900 shadow-sm">
          {describePayment(split, locale)}
        </p>
      )}

      <div className="rounded-r-md border-l-[3px] border-info-500 bg-info-50 p-3 text-sm text-neutral-700">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info-500" aria-hidden="true" />
          <span>
            {freeUntil.getTime() > now
              ? t('booking.summary.freeUntil', { when: atVenue(locale).format(freeUntil) })
              : partUntil.getTime() > now && policy.partialRefundPercent > 0
                ? t('booking.summary.partialNow', {
                    percent: policy.partialRefundPercent,
                    when: atVenue(locale).format(partUntil),
                  })
                : t('booking.summary.noRefundSoon')}{' '}
            {describeRefundPolicy(policy, locale)}
            {options.data?.autoApproveBookings === false && t('booking.summary.confirmsByHand')}
          </span>
        </p>
      </div>

      {(config.isLoading || options.isLoading) && (
        <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
      )}
      {options.isSuccess && !method && <Alert>{t('booking.summary.venueOnly')}</Alert>}
      {split && split.payNow === 0 && <NoPayment method={split.method} onDone={done} />}
      {split && split.payNow > 0 && config.data?.provider === 'test' && (
        <TestPayment
          amount={split.payNow}
          deposit={!!split.deposit}
          method={split.method}
          onDone={done}
        />
      )}
      {split && split.payNow > 0 && config.data?.provider === 'stripe' && stripePromise && (
        <Elements stripe={stripePromise}>
          <StripePayment
            amount={split.payNow}
            deposit={!!split.deposit}
            method={split.method}
            onDone={done}
          />
        </Elements>
      )}
      {(config.isError || (config.isSuccess && !config.data.provider)) && (
        <Alert>{t('booking.summary.unavailable')}</Alert>
      )}
    </section>
  )
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="text-neutral-500 [&>svg]:h-5 [&>svg]:w-5" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  )
}

function PayButton({
  amount,
  deposit,
  busy,
  onClick,
}: {
  amount: number
  deposit: boolean
  busy: boolean
  onClick: () => void
}) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy || undefined}
      className="flex h-14 w-full items-center justify-center rounded-md bg-accent-600 text-base font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
    >
      {busy
        ? t('booking.summary.processing')
        : t(deposit ? 'booking.summary.payDeposit' : 'booking.summary.pay', { amount })}
    </button>
  )
}

interface PayProps {
  amount: number
  deposit: boolean
  method: BookingPaymentMethod
}

/** Nothing to pay online (a venue with no deposit): the booking is confirmed at once. */
function NoPayment({
  method,
  onDone,
}: {
  method: BookingPaymentMethod
  onDone: (b: CreateBookingResult) => void
}) {
  const t = useT()
  const { pitch, draft } = useBooking()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trustRefusal, setTrustRefusal] = useState(false)

  const book = async () => {
    setBusy(true)
    setError(null)
    try {
      return onDone(
        await api<CreateBookingResult>('/api/v1/bookings', {
          method: 'POST',
          body: JSON.stringify(bookingBody(pitch.id, draft, method)),
        })
      )
    } catch (caught) {
      setError(describe(t, caught as ApiError))
      setTrustRefusal(TRUST_REASONS.includes((caught as ApiError).details?.reason ?? ''))
    }
    setBusy(false)
  }

  return (
    <section aria-label={t('booking.summary.payment')} className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {error && trustRefusal && (
        <a
          href="/profile/trust-score"
          className="block text-sm font-medium text-primary-700 underline"
        >
          {t('booking.summary.viewTrust')}
        </a>
      )}
      <button
        type="button"
        onClick={book}
        disabled={busy}
        aria-busy={busy || undefined}
        className="flex h-14 w-full items-center justify-center rounded-md bg-accent-600 text-base font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
      >
        {busy ? t('booking.summary.booking') : t('booking.summary.confirm')}
      </button>
    </section>
  )
}

/** Test mode: no card, a choice of outcome. Shown only without Stripe keys. */
function TestPayment({
  amount,
  deposit,
  method,
  onDone,
}: PayProps & { onDone: (b: BookingConfirmation) => void }) {
  const t = useT()
  const { pitch, draft } = useBooking()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trustRefusal, setTrustRefusal] = useState(false)

  const pay = async (outcome: 'succeed' | 'decline') => {
    setBusy(true)
    setError(null)
    try {
      const created = await api<CreateBookingResult>('/api/v1/bookings', {
        method: 'POST',
        body: JSON.stringify(bookingBody(pitch.id, draft, method)),
      })
      const result = await api<BookingConfirmation>('/api/v1/payments/test/confirm', {
        method: 'POST',
        body: JSON.stringify({ bookingId: created.bookingId, outcome }),
      })
      if (result.status === 'CONFIRMED' || result.status === 'AWAITING_APPROVAL') {
        return onDone(result)
      }
      setError(t('booking.summary.declined'))
    } catch (caught) {
      setError(describe(t, caught as ApiError))
      setTrustRefusal(TRUST_REASONS.includes((caught as ApiError).details?.reason ?? ''))
    }
    setBusy(false)
  }

  return (
    <section
      aria-labelledby="payment-heading"
      className="space-y-3 rounded-xl bg-white p-4 shadow-sm"
    >
      <h2 id="payment-heading" className="text-base font-semibold text-neutral-900">
        {t('booking.summary.payment')}
      </h2>
      <p className="rounded-md bg-warning-50 p-3 text-sm text-neutral-700">
        <strong>{t('booking.summary.testMode')}</strong>
        {t('booking.summary.testModeBody')}
      </p>
      {error && <Alert>{error}</Alert>}
      {error && trustRefusal && (
        <a
          href="/profile/trust-score"
          className="block text-sm font-medium text-primary-700 underline"
        >
          {t('booking.summary.viewTrust')}
        </a>
      )}
      <PayButton amount={amount} deposit={deposit} busy={busy} onClick={() => pay('succeed')} />
      <button
        type="button"
        disabled={busy}
        onClick={() => pay('decline')}
        className="h-10 w-full text-sm font-medium text-neutral-700 underline-offset-2 hover:underline"
      >
        {t('booking.summary.simulateDecline')}
      </button>
    </section>
  )
}

/** Stripe: a saved card or a new one, confirmed in the browser. */
function StripePayment({
  amount,
  deposit,
  method: payWith,
  onDone,
}: PayProps & { onDone: (b: CreateBookingResult) => void }) {
  const t = useT()
  const { pitch, draft } = useBooking()
  const stripe = useStripe()
  const elements = useElements()
  const cards = useQuery({
    queryKey: ['saved-cards'],
    queryFn: () => api<SavedCard[]>('/api/v1/payments/methods'),
  })
  const [method, setMethod] = useState<string>('new')
  const [save, setSave] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trustRefusal, setTrustRefusal] = useState(false)

  useEffect(() => {
    if (cards.data?.[0]) setMethod(m => (m === 'new' ? cards.data![0]!.id : m))
  }, [cards.data])

  const pay = async () => {
    if (!stripe || !elements) return
    setBusy(true)
    setError(null)
    try {
      const saved = method !== 'new' ? method : undefined
      const created = await api<CreateBookingResult>('/api/v1/bookings', {
        method: 'POST',
        body: JSON.stringify(bookingBody(pitch.id, draft, payWith, saved)),
      })
      if (created.payment.provider !== 'stripe')
        throw { code: 'X', message: t('booking.summary.unexpected') }
      const card = elements.getElement(CardElement)
      const result = await (stripe as Stripe).confirmCardPayment(created.payment.clientSecret, {
        payment_method: saved ?? { card: card! },
        ...(saved ? {} : save ? { setup_future_usage: 'off_session' as const } : {}),
      })
      if (result.error) {
        // Stripe's own words for a decline are the clearest ones.
        setError(result.error.message ?? t('booking.summary.stripeFailed'))
      } else {
        return onDone(created)
      }
    } catch (caught) {
      setError(describe(t, caught as ApiError))
      setTrustRefusal(TRUST_REASONS.includes((caught as ApiError).details?.reason ?? ''))
    }
    setBusy(false)
  }

  return (
    <section
      aria-labelledby="payment-heading"
      className="space-y-3 rounded-xl bg-white p-4 shadow-sm"
    >
      <h2 id="payment-heading" className="text-base font-semibold text-neutral-900">
        {t('booking.summary.payment')}
      </h2>
      <fieldset className="space-y-2">
        <legend className="sr-only">{t('booking.summary.paymentMethod')}</legend>
        {cards.data?.map(c => (
          <label
            key={c.id}
            className="flex h-11 cursor-pointer items-center gap-3 text-sm text-neutral-900"
          >
            <input
              type="radio"
              name="card"
              checked={method === c.id}
              onChange={() => setMethod(c.id)}
            />
            <span className="capitalize">{c.brand}</span> ···· {c.last4}
            <span className="text-neutral-500">
              {String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}
            </span>
          </label>
        ))}
        {!!cards.data?.length && (
          <label className="flex h-11 cursor-pointer items-center gap-3 text-sm text-neutral-900">
            <input
              type="radio"
              name="card"
              checked={method === 'new'}
              onChange={() => setMethod('new')}
            />
            {t('booking.summary.newCard')}
          </label>
        )}
      </fieldset>
      {method === 'new' && (
        <>
          <div className="rounded-md border border-neutral-200 p-3">
            <CardElement
              options={{
                hidePostalCode: true,
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#111827',
                    '::placeholder': { color: '#6B7280' },
                  },
                  invalid: { color: '#B91C1C' },
                },
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={save} onChange={e => setSave(e.target.checked)} />
            {t('booking.summary.saveCard')}
          </label>
        </>
      )}
      {error && <Alert>{error}</Alert>}
      {error && trustRefusal && (
        <a
          href="/profile/trust-score"
          className="block text-sm font-medium text-primary-700 underline"
        >
          {t('booking.summary.viewTrust')}
        </a>
      )}
      <PayButton amount={amount} deposit={deposit} busy={busy || !stripe} onClick={pay} />
    </section>
  )
}
