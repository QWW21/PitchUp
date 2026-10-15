/**
 * Booking and payment endpoints — E05. Same API as the web flow.
 */
import type {
  BookingConfirmation,
  BookingCounts,
  BookingDetail,
  BookingListPage,
  BookingTab,
  CancelBookingResult,
  CalendarDay,
  CreateBookingResult,
  MyReview,
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
    apiRequest<BookingDetail>({ method: 'GET', url: `/bookings/${bookingId}` }),
  // ── My Bookings (E06) ──
  list: (tab: BookingTab, cursor: string | null) =>
    apiRequest<BookingListPage>({
      method: 'GET',
      url: `/bookings?tab=${tab}&limit=10${cursor ? `&cursor=${cursor}` : ''}`,
    }),
  counts: () => apiRequest<BookingCounts>({ method: 'GET', url: '/bookings/count' }),
  cancel: (bookingId: string) =>
    apiRequest<CancelBookingResult>({
      method: 'POST',
      url: `/bookings/${bookingId}/cancel`,
      data: {},
    }),
  dispute: (bookingId: string, disputeText: string) =>
    apiRequest<{ message: string }>({
      method: 'POST',
      url: `/bookings/${bookingId}/dispute`,
      data: { disputeText },
    }),
  createReview: (body: {
    bookingId: string
    rating: number
    text?: string
    isAnonymous: boolean
  }) => apiRequest<{ id: string }>({ method: 'POST', url: '/reviews', data: body }),
  updateReview: (id: string, body: { rating: number; text?: string; isAnonymous: boolean }) =>
    apiRequest<{ updated: true }>({ method: 'PUT', url: `/reviews/${id}`, data: body }),
  deleteReview: (id: string) => apiRequest<null>({ method: 'DELETE', url: `/reviews/${id}` }),
  // ── My reviews (E07) ──
  myReviews: () => apiRequest<MyReview[]>({ method: 'GET', url: '/reviews/mine' }),
}
