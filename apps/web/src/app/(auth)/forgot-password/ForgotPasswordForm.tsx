'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'

export function ForgotPasswordForm() {
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
        setError('Too many requests. Try again in a few minutes.')
        return
      }

      // All other outcomes (known email, unknown email, server error) show the
      // same success state — revealing which addresses are registered would
      // undo the enumeration protection on the register and login endpoints.
      setSent(true)
    } catch {
      setError('Could not connect. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="mt-8 space-y-4 text-center">
        <p className="text-base text-neutral-700">
          If <span className="font-medium text-neutral-900">{email}</span> is registered, a reset
          link is on its way. Check your spam folder if you don&apos;t see it within a minute.
        </p>
        <Link
          href="/login"
          className="inline-block font-medium text-primary-600 hover:text-primary-700"
        >
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
      <TextField
        label="Email"
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
        {loading ? 'Sending…' : 'Send reset link'}
      </Button>

      <p className="text-center text-sm text-neutral-500">
        <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
          ← Back to sign in
        </Link>
      </p>
    </form>
  )
}
