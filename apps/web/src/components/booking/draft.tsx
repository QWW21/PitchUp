'use client'

/**
 * The booking in progress — E05-10. Lives in sessionStorage, keyed by pitch,
 * so a refresh or a step back loses nothing, and it is gone when the tab
 * closes. Nothing personal goes in the URL.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PitchSize, ShirtColour } from '@pitchup/shared'

/** What the steps need to know about the pitch, sent once from the server. */
export interface BookingPitch {
  id: string
  name: string
  companyId: string
  companyName: string
  hourlyRate: number
  size: PitchSize
  hasShirts: boolean
  shirtStock: { colour: ShirtColour; quantity: number }[]
  minBookingHours: number
  maxBookingHours: number
  advanceBookingDays: number
}

export interface BookingDraft {
  date?: string | undefined
  startTime?: string | undefined
  endTime?: string | undefined
  minutes?: number | undefined
  teamCount: 2 | 3
  players: number[]
  wantsShirts: boolean
  /** The colour each team borrows; '' when it plays in its own kit. */
  colours: (ShirtColour | '')[]
  note: string
  /** Set when the teams step is done, so the summary knows it can show. */
  teamsDone?: boolean
}

export { STEPS, stepPath, type Step } from './paths'

const key = (pitchId: string) => `booking_${pitchId}`

function read(pitchId: string): Partial<BookingDraft> {
  try {
    return JSON.parse(sessionStorage.getItem(key(pitchId)) ?? '{}')
  } catch {
    // Storage blocked (some private modes): the draft lives in memory only.
    return {}
  }
}

function write(pitchId: string, draft: BookingDraft): void {
  try {
    sessionStorage.setItem(key(pitchId), JSON.stringify(draft))
  } catch {
    // As above: the flow still works for this page view.
  }
}

export function clearDraft(pitchId: string): void {
  try {
    sessionStorage.removeItem(key(pitchId))
  } catch {
    // Nothing stored, nothing to clear.
  }
}

interface Ctx {
  pitch: BookingPitch
  draft: BookingDraft
  /** False until sessionStorage has been read: steps wait before redirecting. */
  ready: boolean
  update: (patch: Partial<BookingDraft>) => void
}

const DraftContext = createContext<Ctx | null>(null)

export function BookingDraftProvider({
  pitch,
  defaults,
  children,
}: {
  pitch: BookingPitch
  defaults: BookingDraft
  children: ReactNode
}) {
  const [draft, setDraft] = useState<BookingDraft>(defaults)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setDraft(d => ({ ...d, ...read(pitch.id) }))
    setReady(true)
  }, [pitch.id])

  const update = useCallback(
    (patch: Partial<BookingDraft>) =>
      setDraft(d => {
        const next = { ...d, ...patch }
        write(pitch.id, next)
        return next
      }),
    [pitch.id]
  )

  return (
    <DraftContext.Provider value={{ pitch, draft, ready, update }}>
      {children}
    </DraftContext.Provider>
  )
}

export function useBooking(): Ctx {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useBooking outside BookingDraftProvider')
  return ctx
}
