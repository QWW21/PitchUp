/**
 * The booking in progress — E05-01. In memory only (no persist): it survives
 * moving between steps, and is gone when the flow is closed or the app
 * restarts. Nothing here is worth keeping on disk.
 */
import { create } from 'zustand'
import {
  BOOKING,
  PLAYERS_FOR_SIZE,
  type AirType,
  type BookingPaymentMethod,
  type PitchSize,
  type ShirtColour,
} from '@pitchup/shared'

export interface BookingPitch {
  id: string
  name: string
  companyName: string
  hourlyRate: number
  size: PitchSize
  hasShirts: boolean
  shirtStock: { colour: ShirtColour; quantity: number }[]
  minBookingHours: number
  maxBookingHours: number
  advanceBookingDays: number
}

interface BookingState {
  pitch: BookingPitch | null
  date: string | null
  startTime: string | null
  endTime: string | null
  minutes: number
  /** C-14: the air chosen on a covered day; null when uncovered. */
  airType: AirType | null
  /** The hourly rate on that day (and air), from the availability. */
  rate: number | null
  teamCount: 2 | 3
  players: number[]
  wantsShirts: boolean
  /** The colour each team borrows; null when it plays in its own kit. */
  colours: (ShirtColour | null)[]
  note: string
  start: (pitch: BookingPitch, date?: string) => void
  setDate: (date: string) => void
  setTime: (
    startTime: string,
    endTime: string,
    minutes: number,
    price?: { airType: AirType | null; rate: number }
  ) => void
  setTeamCount: (count: 2 | 3) => void
  setPlayers: (team: number, count: number) => void
  setWantsShirts: (wants: boolean) => void
  setColour: (team: number, colour: ShirtColour | null) => void
  setNote: (note: string) => void
  reset: () => void
}

const empty = {
  pitch: null,
  date: null,
  startTime: null,
  endTime: null,
  minutes: 0,
  airType: null,
  rate: null,
  teamCount: 2 as const,
  players: [5, 5, 5],
  wantsShirts: false,
  colours: [null, null, null],
  note: '',
}

export const useBookingStore = create<BookingState>(set => ({
  ...empty,
  start: (pitch, date) => {
    const n = PLAYERS_FOR_SIZE[pitch.size]
    set({ ...empty, pitch, date: date ?? null, players: [n, n, n] })
  },
  // A new date clears the time chosen for the old one.
  setDate: date =>
    set(s =>
      s.date === date
        ? {}
        : { date, startTime: null, endTime: null, minutes: 0, airType: null, rate: null }
    ),
  setTime: (startTime, endTime, minutes, price) =>
    set({
      startTime,
      endTime,
      minutes,
      airType: price?.airType ?? null,
      rate: price?.rate ?? null,
    }),
  // A team that no longer exists has no shirts to borrow.
  setTeamCount: teamCount =>
    set(s => ({
      teamCount,
      colours: teamCount === 2 ? [s.colours[0]!, s.colours[1]!, null] : s.colours,
    })),
  setPlayers: (team, count) =>
    set(s => {
      const players = [...s.players]
      players[team] = Math.min(BOOKING.MAX_PLAYERS_PER_TEAM, Math.max(1, count))
      return { players }
    }),
  setWantsShirts: wantsShirts => set({ wantsShirts }),
  setColour: (team, colour) =>
    set(s => {
      const colours = [...s.colours]
      colours[team] = colour
      return { colours }
    }),
  setNote: note => set({ note }),
  reset: () => set(empty),
}))

/** The request body for POST /bookings, from the store. */
export function bookingBody(
  s: BookingState,
  paymentMethod: BookingPaymentMethod = 'ONLINE',
  paymentMethodId?: string
) {
  return {
    paymentMethod,
    pitchId: s.pitch!.id,
    date: s.date!,
    startTime: s.startTime!,
    endTime: s.endTime!,
    teamCount: s.teamCount,
    teamsData: Array.from({ length: s.teamCount }, (_, t) => ({
      playerCount: s.players[t]!,
      ...(s.wantsShirts && s.colours[t] ? { colour: s.colours[t]! } : {}),
    })),
    wantsShirts: s.wantsShirts,
    ...(s.note.trim() ? { noteToManager: s.note.trim() } : {}),
    ...(paymentMethodId ? { paymentMethodId } : {}),
    ...(s.airType ? { airType: s.airType } : {}),
  }
}

/** The hourly rate the booking is priced at: the chosen day's, else the pitch's. */
export const bookingRate = (s: Pick<BookingState, 'rate' | 'pitch'>): number =>
  s.rate ?? s.pitch!.hourlyRate
