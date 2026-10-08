'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn('credentials', { email, password, redirect: false })

    if (result?.ok) {
      // Honour where the middleware was taking them before the redirect.
      const callbackUrl = searchParams.get('callbackUrl')
      router.push(callbackUrl && callbackUrl.startsWith('/') ? callbackUrl : '/dashboard')
      router.refresh()
      return
    }

    // One message for every failure. The API deliberately does not
    // distinguish a wrong password from an unknown address, or an
    // unverified account — telling them apart here would reinstate the
    // enumeration oracle the backend closes. An unverified account is sent
    // a fresh code server-side, so the hint below is actionable either way.
    setError('Incorrect email or password.')
    setLoading(false)
    // The password is left in place: making someone retype it after a typo
    // in the email field is a poor trade for no security gain.
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

      <TextField
        label="Password"
        name="password"
        autoComplete="current-password"
        revealable
        required
        value={password}
        onChange={e => setPassword(e.target.value)}
        disabled={loading}
      />

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Forgot password?
        </Link>
      </div>

      {error && (
        <div>
          <Alert>{error}</Alert>
          <p className="mt-1.5 text-sm text-neutral-500">
            Not verified yet? Check your inbox — we have sent a new code.
          </p>
        </div>
      )}

      <Button type="submit" size="lg" loading={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
