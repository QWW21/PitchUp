'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { RegisterManagerSchema } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PasswordStrength } from '@/components/ui/PasswordStrength'
import { TextField } from '@/components/ui/TextField'

/** Dial codes offered in the picker. Romania first, per the spec. */
const DIAL_CODES = [
  { code: '+40', label: 'RO +40' },
  { code: '+44', label: 'UK +44' },
  { code: '+49', label: 'DE +49' },
  { code: '+33', label: 'FR +33' },
  { code: '+39', label: 'IT +39' },
  { code: '+34', label: 'ES +34' },
  { code: '+1', label: 'US +1' },
] as const

type FieldErrors = Partial<Record<'name' | 'email' | 'phone' | 'password' | 'confirm', string>>

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [dialCode, setDialCode] = useState('+40')
  const [localNumber, setLocalNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  /** Strips spaces and a leading zero, which Romanian numbers are usually
   *  written with but E.164 does not allow. */
  function toE164(): string {
    const digits = localNumber.replace(/\D/g, '').replace(/^0+/, '')
    return `${dialCode}${digits}`
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    const phone = toE164()
    const parsed = RegisterManagerSchema.safeParse({ name, email, phone, password })

    const errors: FieldErrors = {}
    if (!parsed.success) {
      // The same schema the API validates against, so the two cannot drift.
      for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (messages?.[0]) errors[field as keyof FieldErrors] = messages[0]
      }
    }
    if (password !== confirm) errors.confirm = 'Passwords do not match'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setLoading(true)

    const response = await fetch('/api/v1/auth/register/manager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password }),
    })
    const body = await response.json().catch(() => null)

    if (!response.ok) {
      if (body?.error?.details?.field === 'phone') {
        setFieldErrors({ phone: body.error.message })
      } else {
        setFormError(body?.error?.message ?? 'Could not create your account. Please try again.')
      }
      setLoading(false)
      return
    }

    // Signing in immediately would fail: the account is unverified, and the
    // backend refuses those by design. So the flow continues at the
    // verification step rather than the onboarding wizard.
    router.push(`/verify-email?email=${encodeURIComponent(email)}`)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
      <TextField
        label="Full name"
        name="name"
        autoComplete="name"
        required
        value={name}
        onChange={e => setName(e.target.value)}
        error={fieldErrors.name}
        disabled={loading}
      />

      <TextField
        label="Email address"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        error={fieldErrors.email}
        disabled={loading}
      />

      <div>
        <label htmlFor="phone-number" className="mb-1.5 block text-sm font-medium text-neutral-900">
          Phone number
        </label>
        <div className="flex gap-2">
          <select
            aria-label="Country dialling code"
            value={dialCode}
            onChange={e => setDialCode(e.target.value)}
            disabled={loading}
            className="h-12 shrink-0 rounded-md border border-neutral-200 bg-white px-3 text-base text-neutral-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600"
          >
            {DIAL_CODES.map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <input
            id="phone-number"
            type="tel"
            name="phone"
            autoComplete="tel-national"
            inputMode="numeric"
            placeholder="712 345 678"
            required
            value={localNumber}
            onChange={e => setLocalNumber(e.target.value)}
            disabled={loading}
            aria-invalid={fieldErrors.phone ? true : undefined}
            aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
            className={`h-12 w-full rounded-md border bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
              fieldErrors.phone
                ? 'border-error-500 focus:ring-error-500'
                : 'border-neutral-200 focus:border-primary-600 focus:ring-primary-600'
            }`}
          />
        </div>
        {fieldErrors.phone && (
          <p id="phone-error" className="mt-1.5 text-sm text-error-500">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      <div>
        <TextField
          label="Password"
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
        label="Confirm password"
        name="confirmPassword"
        autoComplete="new-password"
        revealable
        required
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        error={fieldErrors.confirm}
        disabled={loading}
      />

      {formError && <Alert>{formError}</Alert>}

      <Button type="submit" size="lg" loading={loading} className="!mt-6">
        {loading ? 'Creating account…' : 'Create account & continue →'}
      </Button>
    </form>
  )
}
