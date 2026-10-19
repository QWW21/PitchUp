'use client'

/**
 * What an admin can do to an account — E15-07: adjust the trust score with a
 * reason; suspend (with a reason) or reinstate; delete a player's account
 * after typing their email.
 */
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

interface Props {
  user: {
    id: string
    name: string
    email: string
    role: string
    suspended: boolean
    trustScore: number
  }
  isSelf: boolean
}

const input = 'mt-1 w-full rounded-md border border-neutral-200 px-3 text-sm'

export function UserAdminActions({ user, isSelf }: Props) {
  const router = useRouter()
  const suspendDialog = useRef<HTMLDialogElement>(null)
  const deleteDialog = useRef<HTMLDialogElement>(null)
  const [delta, setDelta] = useState('')
  const [why, setWhy] = useState('')
  const [suspendWhy, setSuspendWhy] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [deleteWhy, setDeleteWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      await fn()
      suspendDialog.current?.close()
      deleteDialog.current?.close()
      setDone(message)
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  const points = Number(delta)
  const validDelta =
    delta !== '' && Number.isInteger(points) && points !== 0 && Math.abs(points) <= 100
  const url = `/api/v1/admin/users/${user.id}`

  return (
    <>
      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}
      {done && (
        <p role="status" className="mt-6 rounded-md bg-primary-50 p-3 text-sm text-primary-700">
          {done}
        </p>
      )}
      <section aria-labelledby="adjust" className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 id="adjust" className="text-lg font-semibold text-neutral-900">
          Adjust the trust score
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          The change is kept to 0–100, shows in their history, and they&rsquo;re told why.
        </p>
        <form
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end"
          onSubmit={e => {
            e.preventDefault()
            void run(
              () => send(url, 'PUT', { trustScoreAdjust: points, trustAdjustReason: why.trim() }),
              'Trust score adjusted.'
            ).then(() => {
              setDelta('')
              setWhy('')
            })
          }}
        >
          <label className="text-sm font-medium text-neutral-700">
            Points (−100 to +100)
            <input
              type="number"
              inputMode="numeric"
              min={-100}
              max={100}
              value={delta}
              onChange={e => setDelta(e.target.value)}
              className={`${input} h-10`}
            />
          </label>
          <label className="text-sm font-medium text-neutral-700">
            Reason
            <input
              type="text"
              maxLength={200}
              value={why}
              onChange={e => setWhy(e.target.value)}
              className={`${input} h-10`}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !validDelta || why.trim().length < 5}
            className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            Apply
          </button>
        </form>
      </section>

      <section aria-labelledby="account" className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 id="account" className="text-lg font-semibold text-neutral-900">
          Account
        </h2>
        {isSelf ? (
          <p className="mt-2 text-sm text-neutral-700">This is your account.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {user.suspended ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() => send(url, 'PUT', { suspended: false }), 'Account reinstated.')
                }
                className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                Reinstate account
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => suspendDialog.current?.showModal()}
                className="h-10 rounded-md border border-error-500 px-4 text-sm font-semibold text-error-600 hover:bg-error-50 disabled:opacity-60"
              >
                Suspend account…
              </button>
            )}
            {user.role === 'PLAYER' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => deleteDialog.current?.showModal()}
                className="h-10 rounded-md border border-neutral-200 px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
              >
                Delete account…
              </button>
            )}
          </div>
        )}
      </section>

      <dialog
        ref={suspendDialog}
        aria-labelledby="suspend-title"
        className="w-[min(28rem,calc(100%-2rem))] rounded-xl p-6 shadow-xl backdrop:bg-black/40"
        onClick={e => e.target === suspendDialog.current && suspendDialog.current?.close()}
      >
        <h2 id="suspend-title" className="text-lg font-semibold text-neutral-900">
          Suspend {user.name}?
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          They&rsquo;re signed out everywhere and can&rsquo;t sign in until reinstated. Bookings
          already made stay.
        </p>
        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Reason (for the record)
          <textarea
            rows={3}
            maxLength={300}
            value={suspendWhy}
            onChange={e => setSuspendWhy(e.target.value)}
            className={`${input} p-3`}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => suspendDialog.current?.close()}
            className="h-10 rounded-md px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || suspendWhy.trim().length < 5}
            onClick={() =>
              void run(
                () => send(url, 'PUT', { suspended: true, suspensionReason: suspendWhy.trim() }),
                'Account suspended.'
              )
            }
            className="h-10 rounded-md bg-error-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            Suspend
          </button>
        </div>
      </dialog>

      <dialog
        ref={deleteDialog}
        aria-labelledby="delete-title"
        className="w-[min(28rem,calc(100%-2rem))] rounded-xl p-6 shadow-xl backdrop:bg-black/40"
        onClick={e => e.target === deleteDialog.current && deleteDialog.current?.close()}
      >
        <h2 id="delete-title" className="text-lg font-semibold text-neutral-900">
          Delete {user.name}&rsquo;s account?
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          Upcoming bookings are cancelled and refunded, and their details are wiped. This
          can&rsquo;t be undone.
        </p>
        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Reason
          <input
            type="text"
            maxLength={300}
            value={deleteWhy}
            onChange={e => setDeleteWhy(e.target.value)}
            className={`${input} h-10`}
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-neutral-700">
          Type their email to confirm
          <input
            type="email"
            value={confirmEmail}
            onChange={e => setConfirmEmail(e.target.value)}
            className={`${input} h-10`}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => deleteDialog.current?.close()}
            className="h-10 rounded-md px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              busy ||
              deleteWhy.trim().length < 5 ||
              confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()
            }
            onClick={() =>
              void run(() => send(url, 'DELETE', { reason: deleteWhy.trim() }), 'Account deleted.')
            }
            className="h-10 rounded-md bg-error-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            Delete for good
          </button>
        </div>
      </dialog>
    </>
  )
}
