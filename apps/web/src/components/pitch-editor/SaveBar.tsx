'use client'

/** The sticky footer every editor tab shares: save, discard, and what happened. */
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/i18n/client'

export function SaveBar({
  label,
  dirty,
  busy,
  saved,
  error,
  onSave,
  onReset,
  disabled,
}: {
  label: string
  dirty: boolean
  busy: boolean
  saved: boolean
  error: string | null
  onSave: () => void
  onReset: () => void
  disabled?: boolean
}) {
  const t = useT()
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 space-y-2 border-t border-neutral-200 bg-neutral-50/95 px-4 py-3 backdrop-blur">
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={busy || disabled || !dirty}
          className="h-10 rounded-md bg-primary-600 px-5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? t('editor.bar.saving') : label}
        </button>
        {dirty && (
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="h-10 rounded-md px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            {t('editor.bar.cancel')}
          </button>
        )}
        <p role="status" className="text-sm text-neutral-500">
          {dirty ? t('editor.bar.unsaved') : saved ? t('editor.bar.saved') : ''}
        </p>
      </div>
    </div>
  )
}
