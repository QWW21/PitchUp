/**
 * A venue manager's bookings — E11-09. The same API as the web dashboard.
 */
import type {
  BookingStatus,
  ManagerBooking,
  ManagerBookingDetail,
  ManagerBookingPage,
  ManagerPitchRow,
} from '@pitchup/shared'
import { apiRequest } from './apiClient'

export interface ManagerBookingFilters {
  status?: BookingStatus | undefined
  pitchId?: string | undefined
}

export const managerApi = {
  bookings: (filters: ManagerBookingFilters, cursor: string | null) => {
    const q = new URLSearchParams({ limit: '20' })
    if (filters.status) q.set('status', filters.status)
    if (filters.pitchId) q.set('pitchId', filters.pitchId)
    if (cursor) q.set('cursor', cursor)
    return apiRequest<ManagerBookingPage>({ method: 'GET', url: `/manager/bookings?${q}` })
  },
  booking: (id: string) =>
    apiRequest<ManagerBookingDetail>({ method: 'GET', url: `/manager/bookings/${id}` }),
  pitches: () => apiRequest<ManagerPitchRow[]>({ method: 'GET', url: '/manager/pitches' }),
  attended: (id: string) =>
    apiRequest<ManagerBooking>({
      method: 'POST',
      url: `/manager/bookings/${id}/attended`,
      data: {},
    }),
  noShow: (id: string) =>
    apiRequest<ManagerBooking>({
      method: 'POST',
      url: `/manager/bookings/${id}/no-show`,
      data: {},
    }),
  complete: (id: string) =>
    apiRequest<ManagerBooking>({
      method: 'POST',
      url: `/manager/bookings/${id}/complete`,
      data: {},
    }),
  /** C-13: accept a booking that waits for the venue. */
  accept: (id: string) =>
    apiRequest<ManagerBooking>({
      method: 'POST',
      url: `/manager/bookings/${id}/accept`,
      data: {},
    }),
  /** C-12 / C-13: decline a request, or cancel a booking; the player is refunded in full. */
  cancel: (id: string, reason: string) =>
    apiRequest<ManagerBooking>({
      method: 'POST',
      url: `/manager/bookings/${id}/cancel`,
      data: { reason },
    }),
}
