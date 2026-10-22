'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { safeCallbackPath } from '@/lib/auth/callback'
import { useT } from '@/i18n/client'

export function LoginForm({ google }: { google: boolean }) {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [throttled, setThrottled] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setThrottled(false)
    setLoading(true)

    let result
    try {
      result = await signIn('credentials', { email, password, redirect: false })

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
      setError(t('common.connectionError'))
      setLoading(false)
      return
    }

    // One message for every failure. The API deliberately does not
    // distinguish a wrong password from an unknown address, or an
    // unverified account — telling them apart here would reinstate the
    // enumeration oracle the backend closes. An unverified account is sent
    // a fresh code server-side, so the hint below is actionable either way.
    // The one exception is too many failures for the address (#188), said
    // the same way for every address, so it reveals nothing.
    if (result?.code === 'rate_limited') {
      setThrottled(true)
      setError(t('auth.login.tooMany'))
    } else {
      setError(t('auth.login.wrong'))
    }
    setLoading(false)
    // The password is left in place: making someone retype it after a typo
    // in the email field is a poor trade for no security gain.
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
      {searchParams.get('error') === 'GoogleNoAccount' && (
        <Alert>{t('auth.login.googleNoAccount')}</Alert>
      )}
      {searchParams.get('notice') === 'password-changed' && (
        <p role="status" className="rounded-md bg-primary-50 p-3 text-sm text-primary-700">
          {t('auth.login.passwordChanged')}
        </p>
      )}
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

      <TextField
        label={t('auth.login.password')}
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
          {t('auth.login.forgot')}
        </Link>
      </div>

      {error && (
        <div>
          <Alert>{error}</Alert>
          {!throttled && (
            <p className="mt-1.5 text-sm text-neutral-500">{t('auth.login.notVerified')}</p>
          )}
        </div>
      )}

      <Button type="submit" size="lg" loading={loading}>
        {loading ? t('auth.login.signingIn') : t('auth.login.signIn')}
      </Button>

      {google && (
        <>
          <p className="text-center text-sm text-neutral-500">{t('auth.login.or')}</p>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={loading}
            onClick={() =>
              void signIn('google', {
                redirectTo: safeCallbackPath(
                  searchParams.get('callbackUrl'),
                  window.location.origin
                ),
              })
            }
          >
            {t('auth.login.google')}
          </Button>
        </>
      )}
    </form>
  )
}
