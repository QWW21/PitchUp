'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { safeCallbackPath } from '@/lib/auth/callback'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signIn('credentials', { email, password, redirect: false })

      // `ok` alone is not success: Auth.js answers a rejected sign-in with
      // HTTP 200 and the reason in the redirect URL, so next-auth/react
      // returns { ok: true, error: 'CredentialsSignin' }. Treating that as
      // success sent the user to /dashboard, the middleware bounced them
      // back here, and the form stayed stuck on "Signing in…".
      if (result?.ok && !result.error) {
        // Honour where the middleware was taking them before the redirect.
        router.push(safeCallbackPath(searchParams.get('callbackUrl'), window.location.origin))
        router.refresh()
        return
      }
    } catch {
      // signIn only throws when the request itself fails (no connection, or
      // a non-JSON server error); a wrong password comes back as a result.
      setError('Could not connect. Check your connection and try again.')
      setLoading(false)
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
