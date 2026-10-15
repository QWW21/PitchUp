'use client'

/**
 * Saved cards — E08-08. Remove asks first. "Add new card" opens a dialog
 * with Stripe's card field and saves through a SetupIntent (no charge).
 * Card numbers only ever go to Stripe, never to our server.
 */
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { CreditCard, Plus } from 'lucide-react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import type { SavedCard } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

const brand = (b: string) => b.charAt(0).toUpperCase() + b.slice(1)

export function PaymentMethods({
  cards,
  publishableKey,
}: {
  cards: SavedCard[]
  publishableKey: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey]
  )

  const remove = async (card: SavedCard) => {
    if (!window.confirm(`Remove the ${brand(card.brand)} ending ${card.last4}?`)) return
    setRemoving(card.id)
    setError(null)
    try {
      await send(`/api/v1/payments/methods/${card.id}`, 'DELETE')
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setRemoving(null)
  }

  return (
    <div className="mt-4 space-y-4">
      {!publishableKey && (
        <p className="rounded-md bg-neutral-100 p-3 text-sm text-neutral-700">
          Saving cards needs Stripe, which isn&rsquo;t set up here yet. Bookings use test payments
          for now.
        </p>
      )}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <CreditCard className="h-12 w-12 text-neutral-300" aria-hidden="true" />
            <p className="mt-3 font-semibold text-neutral-900">No saved cards</p>
            <p className="mt-1 text-sm text-neutral-700">Add a card to book faster.</p>
          </div>
        ) : (
          <ul>
            {cards.map(c => (
              <li
                key={c.id}
                className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0"
              >
                <CreditCard className="h-5 w-5 text-neutral-500" aria-hidden="true" />
                <span className="flex-1 text-sm text-neutral-900">
                  {brand(c.brand)} ···· {c.last4}
                  <span className="ml-2 text-neutral-500">
                    {String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void remove(c)}
                  disabled={removing === c.id}
                  aria-label={`Remove ${brand(c.brand)} ending ${c.last4}`}
                  className="text-sm font-medium text-error-600 hover:underline disabled:opacity-60"
                >
                  {removing === c.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {publishableKey && (
          <button
            type="button"
            onClick={() => dialog.current?.showModal()}
            className="flex w-full items-center gap-2 border-t border-neutral-100 px-4 py-3 text-sm font-semibold text-primary-700 hover:bg-neutral-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add new card
          </button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}

      {stripePromise && (
        <dialog
          ref={dialog}
          aria-labelledby="add-card-title"
          className="w-[min(28rem,calc(100%-2rem))] rounded-xl p-6 shadow-xl backdrop:bg-black/40"
          onClick={e => e.target === dialog.current && dialog.current?.close()}
        >
          <h2 id="add-card-title" className="text-lg font-semibold text-neutral-900">
            Add a card
          </h2>
          <Elements stripe={stripePromise}>
            <AddCard
              onDone={() => {
                dialog.current?.close()
                router.refresh()
              }}
              onCancel={() => dialog.current?.close()}
            />
          </Elements>
        </dialog>
      )}
    </div>
  )
}

function AddCard({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const card = elements?.getElement(CardElement)
    if (!stripe || !card) return
    setBusy(true)
    setError(null)
    try {
      const { clientSecret } = await send<{ clientSecret: string }>(
        '/api/v1/payments/setup-intent',
        'POST',
        {}
      )
      const result = await (stripe as Stripe).confirmCardSetup(clientSecret, {
        payment_method: { card },
      })
      if (result.error) throw new Error(result.error.message ?? 'The card could not be saved')
      onDone()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-md border border-neutral-200 p-3">
        <CardElement options={{ hidePostalCode: true, style: { base: { fontSize: '16px' } } }} />
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-md px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !stripe}
          className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save card'}
        </button>
      </div>
    </div>
  )
}
