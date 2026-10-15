/**
 * Booking and payment endpoints — E05. Same API as the web flow.
 */
import type {
  BookingConfirmation,
  CalendarDay,
  CreateBookingResult,
  PaymentConfig,
  PitchAvailability,
  SavedCard,
} from '@pitchup/shared'
import { apiRequest } from './apiClient'

export interface CreateBookingBody {
  pitchId: string
  date: string
  startTime: string
  endTime: string
  teamCount: number
  teamsData: { playerCount?: number; colour?: string }[]
  wantsShirts: boolean
  noteToManager?: string
  paymentMethodId?: string
}

export const bookingApi = {
  paymentConfig: () => apiRequest<PaymentConfig>({ method: 'GET', url: '/payments/config' }),
  savedCards: () => apiRequest<SavedCard[]>({ method: 'GET', url: '/payments/methods' }),
  calendar: (pitchId: string, from: string, days: number) =>
    apiRequest<CalendarDay[]>({
      method: 'GET',
      url: `/pitches/${pitchId}/calendar?from=${from}&days=${days}`,
    }),
  day: (pitchId: string, date: string) =>
    apiRequest<PitchAvailability>({
      method: 'GET',
      url: `/pitches/${pitchId}/availability?date=${date}`,
      // The availability response is cacheable for a minute; a booking needs it fresh.
      headers: { 'Cache-Control': 'no-cache' },
    }),
  create: (body: CreateBookingBody) =>
    apiRequest<CreateBookingResult>({ method: 'POST', url: '/bookings', data: body }),
  confirmTest: (bookingId: string, outcome: 'succeed' | 'decline') =>
    apiRequest<BookingConfirmation>({
      method: 'POST',
      url: '/payments/test/confirm',
      data: { bookingId, outcome },
    }),
  get: (bookingId: string) =>
    apiRequest<BookingConfirmation>({ method: 'GET', url: `/bookings/${bookingId}` }),
}
