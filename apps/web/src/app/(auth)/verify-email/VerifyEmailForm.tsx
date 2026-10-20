'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AUTH } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useT } from '@/i18n/client'

export function VerifyEmailForm({ email }: { email: string }) {
  const t = useT()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    let response: Response
    try {
      response = await fetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
    } catch {
      // A dropped connection rejects; without this the button spins for good.
      setError(t('common.connectionError'))
      setLoading(false)
      return
    }
    const body = await response.json().catch(() => null)

    if (response.ok) {
      router.push(`/registration-confirmed?email=${encodeURIComponent(email)}`)
      return
    }

    const remaining = body?.error?.details?.attemptsRemaining
    setError(
      typeof remaining === 'number' && remaining > 0
        ? t('auth.verify.attemptsLeft', { message: body.error.message, count: remaining })
        : (body?.error?.message ?? t('auth.verify.failed'))
    )
    setLoading(false)
  }

  async function handleResend() {
    setError(null)
    setResending(true)
    try {
      await fetch('/api/v1/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, channel: 'EMAIL' }),
      })
      // The endpoint answers identically whether or not the address exists,
      // so this message cannot confirm one either.
      setNotice(t('auth.verify.resent'))
    } catch {
      setError(t('common.connectionError'))
    } finally {
      setResending(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        <TextField
          label={t('auth.verify.code')}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={AUTH.OTP_LENGTH}
          placeholder="000000"
          required
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          disabled={loading}
          className="[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.5em]"
        />

        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <Button type="submit" size="lg" loading={loading} disabled={code.length < AUTH.OTP_LENGTH}>
          {loading ? t('auth.verify.verifying') : t('auth.verify.verify')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        {t('auth.verify.noCode')}{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="font-medium text-primary-600 hover:text-primary-700 disabled:opacity-60"
        >
          {t('auth.verify.sendNew')}
        </button>
      </p>
    </>
  )
}
