'use client'

/**
 * Notification settings — E13-10. Each switch saves at once; a failed save
 * puts it back and says why. Muting a kind of notification stops it
 * everywhere, the inbox included.
 */
import { useState } from 'react'
import {
  preferenceGroupsFor,
  type NotificationPreferences,
  type NotificationType,
} from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

type Channel = 'pushEnabled' | 'emailEnabled'

const CHANNELS: { key: Channel; label: string; hint: string }[] = [
  { key: 'emailEnabled', label: 'Email', hint: 'To the address on your account' },
  { key: 'pushEnabled', label: 'Push', hint: 'On phones where you use the PitchUp app' },
]

export function NotificationSettings({
  initial,
  role,
}: {
  initial: NotificationPreferences
  role: string
}) {
  const [prefs, setPrefs] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (patch: Partial<NotificationPreferences>) => {
    const previous = prefs
    setPrefs(p => ({ ...p, ...patch }))
    setError(null)
    setBusy(true)
    try {
      setPrefs(
        await send<NotificationPreferences>('/api/v1/notifications/preferences', 'PUT', patch)
      )
    } catch (caught) {
      setPrefs(previous)
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  const muted = (types: readonly NotificationType[]) =>
    types.every(t => prefs.disabledTypes.includes(t))
  const toggleGroup = (types: readonly NotificationType[]) =>
    void save({
      disabledTypes: muted(types)
        ? prefs.disabledTypes.filter(t => !types.includes(t))
        : [...new Set([...prefs.disabledTypes, ...types])],
    })

  return (
    <div className="mt-4 space-y-6">
      {error && <Alert>{error}</Alert>}
      <section aria-labelledby="channels-h" className="rounded-xl bg-white p-5 shadow-sm">
        <h2 id="channels-h" className="text-base font-semibold text-neutral-900">
          How we tell you
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          Everything also appears in the bell at the top of the page.
        </p>
        <ul className="mt-3 divide-y divide-neutral-100">
          {CHANNELS.map(c => (
            <li key={c.key} className="flex items-center justify-between gap-4 py-3">
              <span>
                <span id={`ch-${c.key}`} className="block text-sm font-medium text-neutral-900">
                  {c.label}
                </span>
                <span className="block text-xs text-neutral-500">{c.hint}</span>
              </span>
              <Switch
                labelledBy={`ch-${c.key}`}
                on={prefs[c.key]}
                disabled={busy}
                onChange={() => void save({ [c.key]: !prefs[c.key] })}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="types-h" className="rounded-xl bg-white p-5 shadow-sm">
        <h2 id="types-h" className="text-base font-semibold text-neutral-900">
          What we tell you about
        </h2>
        <ul className="mt-3 divide-y divide-neutral-100">
          {preferenceGroupsFor(role).map(g => (
            <li key={g.key} className="flex items-center justify-between gap-4 py-3">
              <span>
                <span id={`t-${g.key}`} className="block text-sm font-medium text-neutral-900">
                  {g.label}
                </span>
                <span className="block text-xs text-neutral-500">{g.description}</span>
              </span>
              <Switch
                labelledBy={`t-${g.key}`}
                on={!muted(g.types)}
                disabled={busy}
                onChange={() => toggleGroup(g.types)}
              />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-neutral-500">
          Venue approval and security messages are always sent.
        </p>
      </section>
    </div>
  )
}

function Switch({
  on,
  onChange,
  disabled,
  labelledBy,
}: {
  on: boolean
  onChange: () => void
  disabled: boolean
  labelledBy: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-primary-600' : 'bg-neutral-300'}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`}
      />
    </button>
  )
}
