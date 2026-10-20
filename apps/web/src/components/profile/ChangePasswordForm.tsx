'use client'

import { useState } from 'react'
import { passwordSchema } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { PasswordStrength } from '@/components/ui/PasswordStrength'
import { TextField } from '@/components/ui/TextField'
import { send } from '@/lib/http'
import { useT } from '@/i18n/client'

/**
 * Current password, a new one (with the strength meter) and its
 * confirmation. A wrong current password shows under that field.
 */
export function ChangePasswordForm({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const t = useT()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const found: typeof errors = {}
    if (!current) found.current = t('profile.password.enterCurrent')
    const strong = passwordSchema.safeParse(next)
    if (!strong.success)
      found.next = t.text(strong.error.issues[0]?.message ?? t('profile.password.stronger'))
    else if (next === current) found.next = t('profile.password.different')
    if (confirm !== next) found.confirm = t('profile.password.mismatch')
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      await send('/api/v1/profile/change-password', 'POST', {
        currentPassword: current,
        newPassword: next,
      })
      await signOutAction()
    } catch (caught) {
      const message = (caught as Error).message
      if (/password is not correct/i.test(message)) setErrors({ current: message })
      else setError(message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-5 rounded-xl bg-white p-4 shadow-sm">
      <TextField
        label={t('profile.password.current')}
        revealable
        value={current}
        onChange={e => setCurrent(e.target.value)}
        error={errors.current}
        autoComplete="current-password"
      />
      <div>
        <TextField
          label={t('profile.password.new')}
          revealable
          value={next}
          onChange={e => setNext(e.target.value)}
          error={errors.next}
          autoComplete="new-password"
        />
        <PasswordStrength password={next} />
      </div>
      <TextField
        label={t('profile.password.confirm')}
        revealable
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        error={errors.confirm}
        autoComplete="new-password"
      />
      {error && <Alert>{error}</Alert>}
      <button
        type="submit"
        disabled={busy}
        className="h-12 w-full rounded-md bg-primary-600 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {busy ? t('profile.password.changing') : t('profile.password.change')}
      </button>
    </form>
  )
}
