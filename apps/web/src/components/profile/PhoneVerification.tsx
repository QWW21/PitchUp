'use client'

/**
 * Verifying the phone on the account — #163. A code is texted only when the
 * person asks for one, then typed in here. It sits inside the settings form,
 * so its buttons never submit that form and Enter in the code field verifies.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { send } from '@/lib/http'
import { useT } from '@/i18n/client'

export function PhoneVerification({ phone }: { phone: string }) {
  const t = useT()
  const router = useRouter()
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendCode = async () => {
    setBusy(true)
    setError(null)
    try {
      await send('/api/v1/profile/phone/code', 'POST', {})
      setSent(true)
      setCode('')
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  const verify = async () => {
    if (code.length !== 6) {
      setError(t('profile.phone.enterCode'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await send('/api/v1/profile/phone/verify', 'POST', { code })
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 rounded-md bg-neutral-50 p-3 text-sm">
      {!sent ? (
        <p className="text-neutral-700">
          {t('profile.phone.notVerified')}{' '}
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={busy}
            className="font-medium text-primary-700 underline disabled:opacity-60"
          >
            {busy ? t('profile.phone.sending') : t('profile.phone.textMe')}
          </button>
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-neutral-700" role="status">
            {t('profile.phone.texted', { phone })}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block font-medium text-neutral-900">
                {t('profile.phone.code')}
              </span>
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void verify()
                  }
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="h-10 w-32 rounded-md border border-neutral-200 bg-white px-3 tracking-widest"
              />
            </label>
            <button
              type="button"
              onClick={() => void verify()}
              disabled={busy}
              className="h-10 rounded-md bg-primary-600 px-4 font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? t('profile.phone.checking') : t('profile.phone.verify')}
            </button>
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={busy}
              className="h-10 px-2 font-medium text-primary-700 underline disabled:opacity-60"
            >
              {t('profile.phone.sendNew')}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="mt-2 text-error-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
