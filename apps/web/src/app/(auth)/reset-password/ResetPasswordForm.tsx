'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { passwordSchema } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PasswordStrength } from '@/components/ui/PasswordStrength'
import { TextField } from '@/components/ui/TextField'
import { useT } from '@/i18n/client'

/** The emailed token: randomBytes(32) as hex. Checked here so a mangled link fails fast. */
const TOKEN_PATTERN = /^[a-f0-9]{64}$/

type FieldErrors = Partial<Record<'password' | 'confirm', string>>

export function ResetPasswordForm() {
  const t = useT()
  const token = useSearchParams().get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  /** The link itself is dead (expired, used, invalid): only a new one helps. */
  const [linkDead, setLinkDead] = useState(!TOKEN_PATTERN.test(token))
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const errors: FieldErrors = {}
    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success)
      errors.password = t.text(parsed.error.issues[0]?.message ?? t('auth.reset.invalidPassword'))
    if (password !== confirm) errors.confirm = t('auth.register.mismatch')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const body = await response.json().catch(() => null)

      if (response.ok) {
        setDone(true)
        return
      }
      if (response.status === 429) {
        setError(t('auth.reset.tooMany'))
        return
      }
      if (body?.error?.details?.reason) {
        // TOKEN_EXPIRED or TOKEN_INVALID (already used, or never issued).
        setError(body.error.message)
        setLinkDead(true)
        return
      }
      setError(body?.error?.message ?? t('auth.reset.failed'))
    } catch {
      setError(t('common.connectionError'))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="mt-8 space-y-6">
        <Alert tone="success">{t('auth.reset.done')}</Alert>
        <Link
          href="/login"
          className="flex h-12 w-full items-center justify-center rounded-md bg-primary-600 text-base font-semibold text-white hover:bg-primary-700"
        >
          {t('auth.reset.signIn')}
        </Link>
      </div>
    )
  }

  if (linkDead) {
    return (
      <div className="mt-8 space-y-6">
        <Alert>{error ?? t('auth.reset.deadLink')}</Alert>
        <Link
          href="/forgot-password"
          className="flex h-12 w-full items-center justify-center rounded-md bg-primary-600 text-base font-semibold text-white hover:bg-primary-700"
        >
          {t('auth.reset.newLink')}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
      <div>
        <TextField
          label={t('auth.reset.newPassword')}
          name="password"
          autoComplete="new-password"
          revealable
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={fieldErrors.password}
          disabled={loading}
        />
        <PasswordStrength password={password} />
      </div>

      <TextField
        label={t('auth.reset.confirm')}
        name="confirmPassword"
        autoComplete="new-password"
        revealable
        required
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        error={fieldErrors.confirm}
        disabled={loading}
      />

      {error && <Alert>{error}</Alert>}

      <Button type="submit" size="lg" loading={loading}>
        {loading ? t('auth.reset.saving') : t('auth.reset.change')}
      </Button>
    </form>
  )
}
