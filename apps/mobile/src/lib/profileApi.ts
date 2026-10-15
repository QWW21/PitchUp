/**
 * Profile, account, cards and notifications — E08. Same API as the web.
 */
import type {
  ChangeOwnPasswordInput,
  DeleteAccountInput,
  NotificationPage,
  Profile,
  SavedCard,
  TrustScoreDetail,
  UpdateProfileInput,
} from '@pitchup/shared'
import { apiRequest } from './apiClient'

export const profileApi = {
  get: () => apiRequest<Profile>({ method: 'GET', url: '/profile' }),
  update: (body: UpdateProfileInput) =>
    apiRequest<Profile>({ method: 'PUT', url: '/profile', data: body }),
  trustScore: (cursor: string | null) =>
    apiRequest<TrustScoreDetail>({
      method: 'GET',
      url: `/profile/trust-score${cursor ? `?cursor=${cursor}` : ''}`,
    }),
  changePassword: (body: ChangeOwnPasswordInput) =>
    apiRequest<{ message: string }>({
      method: 'POST',
      url: '/profile/change-password',
      data: body,
    }),
  deleteAccount: (body: DeleteAccountInput) =>
    apiRequest<{ message: string }>({ method: 'DELETE', url: '/profile', data: body }),

  // ── Saved cards (E05-09 endpoints) ──
  cards: () => apiRequest<SavedCard[]>({ method: 'GET', url: '/payments/methods' }),
  removeCard: (id: string) =>
    apiRequest<null>({ method: 'DELETE', url: `/payments/methods/${id}` }),
  setupIntent: () =>
    apiRequest<{ clientSecret: string }>({
      method: 'POST',
      url: '/payments/setup-intent',
      data: {},
    }),

  // ── Notifications (E08-09, E08-10) ──
  notifications: (cursor: string | null) =>
    apiRequest<NotificationPage>({
      method: 'GET',
      url: `/notifications${cursor ? `?cursor=${cursor}` : ''}`,
    }),
  markRead: (id: string) =>
    apiRequest<{ read: true }>({ method: 'PATCH', url: `/notifications/${id}/read` }),
  markAllRead: () =>
    apiRequest<{ updated: number }>({ method: 'PATCH', url: '/notifications/read-all' }),
  deleteNotification: (id: string) =>
    apiRequest<null>({ method: 'DELETE', url: `/notifications/${id}` }),
  registerDevice: (token: string, platform: 'ios' | 'android') =>
    apiRequest<{ registered: true }>({
      method: 'POST',
      url: '/notifications/device-token',
      data: { token, platform },
    }),
}
