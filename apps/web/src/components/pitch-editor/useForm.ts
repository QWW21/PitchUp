'use client'

/**
 * A tab's form state: the values, whether they differ from what was loaded,
 * and saving them. After a save the saved values become the new baseline.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { send } from '@/lib/http'
import { useUnsaved } from './PitchEditorShell'

export function useEditorForm<T>(initial: T) {
  const router = useRouter()
  const [baseline, setBaseline] = useState(initial)
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The API's machine-readable reason for the last failed save, if it gave one. */
  const [reason, setReason] = useState<string | null>(null)
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline)
  useUnsaved(dirty)

  const save = async (url: string, method: string, body: unknown) => {
    setBusy(true)
    setError(null)
    setReason(null)
    setSaved(false)
    try {
      await send(url, method, body)
      setBaseline(values)
      setSaved(true)
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
      setReason((caught as { reason?: string }).reason ?? null)
    }
    setBusy(false)
  }

  return {
    values,
    setValues,
    dirty,
    busy,
    saved,
    error,
    reason,
    setError,
    save,
    reset: () => {
      setValues(baseline)
      setError(null)
    },
  }
}
