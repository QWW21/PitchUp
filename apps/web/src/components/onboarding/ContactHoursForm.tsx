'use client'

/**
 * Onboarding step 3 — E09-08. Public phone and email, and a week of
 * opening hours (Monday first on screen, stored Sunday = 0 like everywhere
 * else). Half-hour choices; a closing time earlier than the opening time
 * means after midnight, which some venues do.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ContactHoursSchema, fromMinutes, toMinutes, type OnboardingHours } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { TextField } from '@/components/ui/TextField'
import { send } from '@/lib/http'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** Monday first, as people read a week. */
const ORDER = [1, 2, 3, 4, 5, 6, 0]
const TIMES = Array.from({ length: 48 }, (_, i) => fromMinutes(i * 30))

/** In Settings (`inSettings`, C-13) it proposes a change for an admin to approve. */
export function ContactHoursForm({
  existing,
  inSettings = false,
}: {
  existing: { phone: string; email: string; hours: OnboardingHours }
  inSettings?: boolean
}) {
  const router = useRouter()
  const [sent, setSent] = useState(false)
  const [phone, setPhone] = useState(existing.phone)
  const [email, setEmail] = useState(existing.email)
  const [hours, setHours] = useState<OnboardingHours>(existing.hours)
  const [errors, setErrors] = useState<{ phone?: string; email?: string; hours?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const update = (day: number, change: Partial<OnboardingHours[number]>) =>
    setHours(h => h.map(d => (d.day === day ? { ...d, ...change } : d)))
  const monday = hours.find(d => d.day === 1)!
  const copyMonday = () =>
    setHours(h =>
      h.map(d =>
        d.isClosed ? d : { ...d, openTime: monday.openTime, closeTime: monday.closeTime }
      )
    )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = ContactHoursSchema.safeParse({
      phone: phone.trim(),
      email: email.trim(),
      workingHours: hours,
    })
    if (!parsed.success) {
      const found: typeof errors = {}
      for (const issue of parsed.error.issues) {
        const key =
          issue.path[0] === 'workingHours' ? 'hours' : (issue.path[0] as 'phone' | 'email')
        if (!found[key]) found[key] = issue.message
      }
      setErrors(found)
      return
    }
    setErrors({})
    setBusy(true)
    try {
      if (inSettings) {
        await send('/api/v1/manager/venue/contact-hours', 'PUT', parsed.data)
        setSent(true)
        setBusy(false)
        router.refresh()
        return
      }
      await send('/api/v1/onboarding/contact-hours', 'PUT', parsed.data)
      router.push('/onboarding/step/4')
    } catch (caught) {
      setError((caught as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <TextField
            label="Phone"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+40712345678"
            error={errors.phone}
            autoComplete="tel"
          />
          {!errors.phone && (
            <p className="mt-1 text-xs text-neutral-500">With the country code, e.g. +40</p>
          )}
        </div>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-neutral-900">Opening hours</legend>
        <p className="mt-1 text-xs text-neutral-500">
          A closing time before the opening time means you close after midnight.
        </p>
        <ul className="mt-3 divide-y divide-neutral-100 rounded-xl bg-white shadow-sm">
          {ORDER.map(day => {
            const d = hours.find(x => x.day === day)!
            const same = !d.isClosed && toMinutes(d.openTime) === toMinutes(d.closeTime)
            const name = DAY_NAMES[day]!
            return (
              <li key={day} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-24 text-sm font-medium text-neutral-700">{name}</span>
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={d.isClosed}
                    onChange={e => update(day, { isClosed: e.target.checked })}
                    className="h-4 w-4 accent-primary-600"
                  />
                  Closed
                </label>
                {!d.isClosed && (
                  <span className="flex items-center gap-2">
                    <select
                      aria-label={`${name} opens`}
                      value={d.openTime}
                      onChange={e => update(day, { openTime: e.target.value })}
                      className="h-10 rounded-md border border-neutral-200 bg-white px-2 text-sm"
                    >
                      {TIMES.map(t => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <span aria-hidden="true">–</span>
                    <select
                      aria-label={`${name} closes`}
                      aria-invalid={same || undefined}
                      value={d.closeTime}
                      onChange={e => update(day, { closeTime: e.target.value })}
                      className={`h-10 rounded-md border bg-white px-2 text-sm ${same ? 'border-error-500' : 'border-neutral-200'}`}
                    >
                      {TIMES.map(t => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </span>
                )}
                {same && (
                  <p className="w-full text-sm text-error-600">
                    Closing time must differ from opening time
                  </p>
                )}
                {day === 1 && !d.isClosed && (
                  <button
                    type="button"
                    onClick={copyMonday}
                    className="ml-auto text-sm font-medium text-primary-700 hover:underline"
                  >
                    Copy Monday&rsquo;s hours to all open days
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {errors.hours && (
          <p role="alert" className="mt-2 text-sm text-error-600">
            {errors.hours}
          </p>
        )}
      </fieldset>

      {error && <Alert>{error}</Alert>}
      {sent && (
        <p role="status" className="rounded-md bg-primary-50 p-3 text-sm text-primary-700">
          Sent to PitchUp for approval. Your page shows the current details until then.
        </p>
      )}
      <div className="flex gap-3">
        {!inSettings && (
          <button
            type="button"
            onClick={() => router.push('/onboarding/step/2')}
            className="h-12 rounded-md border border-neutral-200 px-5 font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="h-12 flex-1 rounded-md bg-primary-600 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {busy ? 'Saving…' : inSettings ? 'Send for approval' : 'Next: payouts'}
        </button>
      </div>
    </form>
  )
}
