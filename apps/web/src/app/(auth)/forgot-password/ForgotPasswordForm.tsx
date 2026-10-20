'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { MARK, withMarkup } from '@/i18n/rich'
import { useT } from '@/i18n/client'

export function ForgotPasswordForm() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      if (res.status === 429) {
        setError(t('auth.forgot.tooMany'))
        return
      }

      // All other outcomes (known email, unknown email, server error) show the
      // same success state — revealing which addresses are registered would
      // undo the enumeration protection on the register and login endpoints.
      setSent(true)
    } catch {
      setError(t('common.connectionError'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="mt-8 space-y-4 text-center">
        <p className="text-base text-neutral-700">
          {withMarkup(
            t('auth.forgot.sent', { email: MARK }),
            <span className="font-medium text-neutral-900">{email}</span>
          )}
        </p>
        <Link
          href="/login"
          className="inline-block font-medium text-primary-600 hover:text-primary-700"
        >
          {t('auth.forgot.back')}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
      <TextField
        label={t('auth.login.email')}
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        disabled={loading}
      />

      {error && <Alert>{error}</Alert>}

      <Button type="submit" size="lg" loading={loading}>
        {loading ? t('auth.forgot.sending') : t('auth.forgot.send')}
      </Button>

      <p className="text-center text-sm text-neutral-500">
        <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
          {t('auth.forgot.back')}
        </Link>
      </p>
    </form>
  )
}
