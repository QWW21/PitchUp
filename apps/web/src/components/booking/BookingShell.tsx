'use client'

/**
 * Frame around every booking step — E05-10: progress bar, "Step X of 5",
 * back, and Cancel (which asks first once something has been chosen).
 */
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, type ReactNode } from 'react'
import { ChevronLeft, X } from 'lucide-react'
import { PLAYERS_FOR_SIZE } from '@pitchup/shared'
import {
  BookingDraftProvider,
  STEPS,
  clearDraft,
  stepPath,
  useBooking,
  type BookingPitch,
  type Step,
} from './draft'
import { useT } from '@/i18n/client'

export function BookingShell({ pitch, children }: { pitch: BookingPitch; children: ReactNode }) {
  const players = PLAYERS_FOR_SIZE[pitch.size]
  return (
    <BookingDraftProvider
      pitch={pitch}
      defaults={{
        teamCount: 2,
        players: [players, players, players],
        wantsShirts: false,
        colours: ['', '', ''],
        note: '',
      }}
    >
      <Frame>{children}</Frame>
    </BookingDraftProvider>
  )
}

function Frame({ children }: { children: ReactNode }) {
  const t = useT()
  const { pitch, draft } = useBooking()
  const router = useRouter()
  const pathname = usePathname()
  const dialog = useRef<HTMLDialogElement>(null)

  const step = (STEPS.find(s => pathname.endsWith(`/${s}`)) ?? 'date') as Step
  const index = STEPS.indexOf(step)
  const pitchPath = `/discover/${pitch.companyId}/${pitch.id}`
  const done = step === 'confirmation'

  const leave = () => {
    clearDraft(pitch.id)
    router.push(pitchPath)
  }
  const cancel = () => (draft.date ? dialog.current?.showModal() : leave())

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-4">
      <div
        className="h-1 overflow-hidden rounded-full bg-neutral-200 print:hidden"
        role="progressbar"
        aria-label={t('booking.shell.progress')}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={index + 1}
      >
        <div
          className="h-full bg-primary-600 transition-[width] duration-300 ease-in-out"
          style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="mt-3 flex h-11 items-center justify-between print:hidden">
        {index > 0 && !done ? (
          <Link
            href={stepPath(pitch.id, STEPS[index - 1]!)}
            className="flex h-11 items-center gap-1 text-sm font-medium text-neutral-700 hover:text-neutral-900"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {t('common.back')}
          </Link>
        ) : (
          <Link
            href={pitchPath}
            className="flex h-11 items-center gap-1 text-sm font-medium text-neutral-700 hover:text-neutral-900"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {pitch.name}
          </Link>
        )}
        <p className="text-xs font-medium text-neutral-500">
          {t('booking.shell.step', { n: index + 1, total: STEPS.length })}
        </p>
        {done ? (
          <span className="w-16" />
        ) : (
          <button
            type="button"
            onClick={cancel}
            className="flex h-11 items-center gap-1 text-sm font-medium text-neutral-700 hover:text-neutral-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            {t('common.cancel')}
          </button>
        )}
      </div>

      <p className="mt-2 text-sm text-neutral-500">
        {pitch.name} · {pitch.companyName}
      </p>
      <div className="mt-4">{children}</div>

      <dialog
        ref={dialog}
        aria-labelledby="discard-title"
        className="w-[min(24rem,calc(100%-2rem))] rounded-xl p-6 shadow-xl backdrop:bg-black/40"
      >
        <h2 id="discard-title" className="text-lg font-semibold text-neutral-900">
          {t('booking.shell.sure')}
        </h2>
        <p className="mt-2 text-sm text-neutral-500">{t('booking.shell.lost')}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
            className="h-10 flex-1 rounded-md border border-neutral-200 bg-white text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            {t('booking.shell.keepEditing')}
          </button>
          <button
            type="button"
            onClick={leave}
            className="h-10 flex-1 rounded-md border border-error-600 bg-white text-sm font-semibold text-error-600 hover:bg-error-50"
          >
            {t('booking.shell.discard')}
          </button>
        </div>
      </dialog>
    </main>
  )
}
