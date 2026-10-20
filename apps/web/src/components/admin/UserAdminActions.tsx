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
import { useT } from '@/i18n/client'

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
  const t = useT()
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
          {t('admin.actions.adjust')}
        </h2>
        <p className="mt-1 text-sm text-neutral-700">{t('admin.actions.adjustHint')}</p>
        <form
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end"
          onSubmit={e => {
            e.preventDefault()
            void run(
              () => send(url, 'PUT', { trustScoreAdjust: points, trustAdjustReason: why.trim() }),
              t('admin.actions.adjusted')
            ).then(() => {
              setDelta('')
              setWhy('')
            })
          }}
        >
          <label className="text-sm font-medium text-neutral-700">
            {t('admin.actions.points')}
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
            {t('admin.actions.reason')}
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
            {t('admin.actions.apply')}
          </button>
        </form>
      </section>

      <section aria-labelledby="account" className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 id="account" className="text-lg font-semibold text-neutral-900">
          {t('admin.actions.account')}
        </h2>
        {isSelf ? (
          <p className="mt-2 text-sm text-neutral-700">{t('admin.actions.yours')}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {user.suspended ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => send(url, 'PUT', { suspended: false }),
                    t('admin.actions.reinstated')
                  )
                }
                className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {t('admin.actions.reinstate')}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => suspendDialog.current?.showModal()}
                className="h-10 rounded-md border border-error-500 px-4 text-sm font-semibold text-error-600 hover:bg-error-50 disabled:opacity-60"
              >
                {t('admin.actions.suspendDots')}
              </button>
            )}
            {user.role === 'PLAYER' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => deleteDialog.current?.showModal()}
                className="h-10 rounded-md border border-neutral-200 px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
              >
                {t('admin.actions.deleteDots')}
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
          {t('admin.actions.suspendTitle', { name: user.name })}
        </h2>
        <p className="mt-1 text-sm text-neutral-700">{t('admin.actions.suspendHint')}</p>
        <label className="mt-4 block text-sm font-medium text-neutral-700">
          {t('admin.actions.forRecord')}
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
            {t('admin.cancel')}
          </button>
          <button
            type="button"
            disabled={busy || suspendWhy.trim().length < 5}
            onClick={() =>
              void run(
                () => send(url, 'PUT', { suspended: true, suspensionReason: suspendWhy.trim() }),
                t('admin.actions.suspended')
              )
            }
            className="h-10 rounded-md bg-error-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {t('admin.actions.suspend')}
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
          {t('admin.actions.deleteTitle', { name: user.name })}
        </h2>
        <p className="mt-1 text-sm text-neutral-700">{t('admin.actions.deleteHint')}</p>
        <label className="mt-4 block text-sm font-medium text-neutral-700">
          {t('admin.actions.reason')}
          <input
            type="text"
            maxLength={300}
            value={deleteWhy}
            onChange={e => setDeleteWhy(e.target.value)}
            className={`${input} h-10`}
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-neutral-700">
          {t('admin.actions.typeEmail')}
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
            {t('admin.cancel')}
          </button>
          <button
            type="button"
            disabled={
              busy ||
              deleteWhy.trim().length < 5 ||
              confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()
            }
            onClick={() =>
              void run(
                () => send(url, 'DELETE', { reason: deleteWhy.trim() }),
                t('admin.actions.deleted')
              )
            }
            className="h-10 rounded-md bg-error-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {t('admin.actions.deleteForGood')}
          </button>
        </div>
      </dialog>
    </>
  )
}
