'use client'

import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { TextField } from '@/components/ui/TextField'
import { send } from '@/lib/http'
import { useT } from '@/i18n/client'

/**
 * What deleting does, the password, an optional reason, and a final "are you
 * sure". Afterwards the player is signed out and lands on Discover.
 */
export function DeleteAccountForm({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const t = useT()
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!password) {
      setFieldError(t('profile.delete.enterPassword'))
      return
    }
    setFieldError(undefined)
    if (!window.confirm(t('profile.delete.sure'))) return
    setBusy(true)
    try {
      await send('/api/v1/profile', 'DELETE', { password, reason })
      await signOutAction()
    } catch (caught) {
      const message = (caught as Error).message
      if (/password is not correct/i.test(message)) setFieldError(message)
      else setError(message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-5">
      <section
        aria-labelledby="delete-warning"
        className="rounded-r-md border-l-[3px] border-error-500 bg-error-50 p-4"
      >
        <h2 id="delete-warning" className="font-semibold text-neutral-900">
          {t('profile.delete.warning')}
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-900">
          {([0, 1, 2, 3] as const).map(i => (
            <li key={i}>{t(`profile.delete.points.${i}`)}</li>
          ))}
        </ul>
      </section>
      <div className="space-y-5 rounded-xl bg-white p-4 shadow-sm">
        <TextField
          label={t('profile.delete.password')}
          revealable
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={fieldError}
          autoComplete="current-password"
        />
        <div>
          <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-neutral-900">
            {t('profile.delete.reason')}
          </label>
          <textarea
            id="reason"
            rows={3}
            maxLength={300}
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full rounded-md border border-neutral-200 p-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-600"
          />
        </div>
        {error && <Alert>{error}</Alert>}
        <button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-md bg-error-600 font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? t('profile.delete.deleting') : t('profile.delete.submit')}
        </button>
      </div>
    </form>
  )
}
