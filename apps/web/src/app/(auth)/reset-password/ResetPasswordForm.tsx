'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { passwordSchema } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PasswordStrength } from '@/components/ui/PasswordStrength'
import { TextField } from '@/components/ui/TextField'

/** The emailed token: randomBytes(32) as hex. Checked here so a mangled link fails fast. */
const TOKEN_PATTERN = /^[a-f0-9]{64}$/

type FieldErrors = Partial<Record<'password' | 'confirm', string>>

export function ResetPasswordForm() {
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
    if (!parsed.success) errors.password = parsed.error.issues[0]?.message ?? 'Invalid password'
    if (password !== confirm) errors.confirm = 'Passwords do not match'
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
        setError('Too many attempts. Try again in a few minutes.')
        return
      }
      if (body?.error?.details?.reason) {
        // TOKEN_EXPIRED or TOKEN_INVALID (already used, or never issued).
        setError(body.error.message)
        setLinkDead(true)
        return
      }
      setError(body?.error?.message ?? 'Could not change your password. Please try again.')
    } catch {
      setError('Could not connect. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="mt-8 space-y-6">
        <Alert tone="success">
          Your password has been changed. Sign in with your new password.
        </Alert>
        <Link
          href="/login"
          className="flex h-12 w-full items-center justify-center rounded-md bg-primary-600 text-base font-semibold text-white hover:bg-primary-700"
        >
          Sign in
        </Link>
      </div>
    )
  }

  if (linkDead) {
    return (
      <div className="mt-8 space-y-6">
        <Alert>
          {error ?? 'This reset link is not valid. It may be incomplete or already used.'}
        </Alert>
        <Link
          href="/forgot-password"
          className="flex h-12 w-full items-center justify-center rounded-md bg-primary-600 text-base font-semibold text-white hover:bg-primary-700"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
      <div>
        <TextField
          label="New password"
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
        label="Confirm new password"
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
        {loading ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  )
}
