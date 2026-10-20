/**
 * Profile and account on mobile — E08-04 … E08-07, E08-09 and the parts of
 * E08-10 that need no Firebase. Screens render with a fake navigator and
 * mocked APIs.
 */
import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  addDays,
  venueClock,
  type NotificationItem,
  type Profile,
  type TrustScoreDetail,
} from '@pitchup/shared'
import { profileApi } from '../../lib/profileApi'
import { bookingApi } from '../../lib/bookingApi'
import { ApiError } from '../../lib/apiClient'
import { useAuthStore } from '../../stores/authStore'
import messaging from '@react-native-firebase/messaging'
import { openNotification, registerPushToken, startPush, stopPush } from '../../lib/push'
import { ProfileScreen } from './ProfileScreen'
import { TrustScoreDetailScreen, withMonths } from './TrustScoreDetailScreen'
import { EditProfileScreen } from './EditProfileScreen'
import { VerifyPhoneScreen } from './VerifyPhoneScreen'
import { ChangePasswordScreen } from './ChangePasswordScreen'
import { DeleteAccountScreen } from './DeleteAccountScreen'
import { PaymentMethodsScreen } from './PaymentMethodsScreen'
import { NotificationsScreen, groupOf } from '../notifications/NotificationsScreen'

jest.mock('../../lib/profileApi')
jest.mock('../../lib/bookingApi')
// The SDK's own mock renders the provider as text and drops its children.
jest.mock('@stripe/stripe-react-native', () => ({
  ...jest.requireActual('@stripe/stripe-react-native/jest/mock.js'),
  StripeProvider: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native')
  const { useEffect } = jest.requireActual('react')
  // Outside a navigator: run the focus effect once, as on first focus.
  return { ...actual, useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) }
})
const api = jest.mocked(profileApi)
const bookings = jest.mocked(bookingApi)

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() })
type Nav = ReturnType<typeof nav>

function show(Screen: unknown, navigation: Nav) {
  const S = Screen as React.ComponentType<{ navigation: Nav; route: object }>
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <S navigation={navigation} route={{ key: 'k', name: 'n', params: undefined }} />
    </QueryClientProvider>
  )
  return client
}

const press = (label: string | RegExp) => fireEvent.press(screen.getByLabelText(label))
/** Presses the button with this text in the last Alert. */
const answer = (spy: jest.SpyInstance, text: string) => {
  const buttons = spy.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[]
  act(() => {
    // Handlers may be async (logout); the test waits on their effects instead.
    void buttons.find(b => b.text === text)!.onPress?.()
  })
}

const profile: Profile = {
  id: 'u1',
  name: 'Maria Ionescu',
  email: 'maria@example.com',
  phone: '+40712345678',
  city: 'Cluj-Napoca',
  avatarUrl: null,
  role: 'PLAYER',
  emailVerified: true,
  phoneVerified: true,
  trustScore: 64,
  trustTier: 'Fair',
  createdAt: '2026-01-01T10:00:00.000Z',
}

const logout = jest.fn(async () => undefined)
beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({ logout })
  api.get.mockResolvedValue(profile)
})

describe('Profile (E08-04)', () => {
  it('shows the player, initials without a photo, and the trust score', async () => {
    show(ProfileScreen, nav())
    expect(await screen.findByText('Maria Ionescu')).toBeOnTheScreen()
    expect(screen.getByText('MI')).toBeOnTheScreen()
    expect(screen.getByLabelText('Trust score 64 out of 100, Fair')).toBeOnTheScreen()
    expect(screen.getByText('A card on file is required.')).toBeOnTheScreen()
  })

  it('every menu item goes somewhere', async () => {
    const n = nav()
    show(ProfileScreen, n)
    await screen.findByText('Maria Ionescu')
    fireEvent.press(screen.getByText('View history →'))
    for (const [label, screenName] of [
      ['Edit profile', 'EditProfile'],
      ['Change password', 'ChangePassword'],
      ['Payment methods', 'PaymentMethods'],
      ['My bookings', 'MyBookings'],
      ['My reviews', 'MyReviews'],
      ['Notifications', 'Notifications'],
      ['Delete account', 'DeleteAccount'],
    ]) {
      press(label!)
      expect(n.navigate).toHaveBeenCalledWith(screenName)
    }
    expect(n.navigate).toHaveBeenCalledWith('TrustScore')
  })

  it('logs out after a confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert')
    show(ProfileScreen, nav())
    await screen.findByText('Maria Ionescu')
    press('Log out')
    expect(logout).not.toHaveBeenCalled()
    answer(alert, 'Log out')
    await waitFor(() => expect(logout).toHaveBeenCalled())
  })
})

describe('Verify phone number (#163)', () => {
  function showVerify(n: Nav) {
    const S = VerifyPhoneScreen as unknown as React.ComponentType<{
      navigation: Nav
      route: object
    }>
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <S navigation={n} route={{ key: 'k', name: 'n', params: { phone: '+40712345678' } }} />
      </QueryClientProvider>
    )
  }

  it('Profile offers it only while the number is unverified', async () => {
    api.get.mockResolvedValue({ ...profile, phoneVerified: false })
    const n = nav()
    show(ProfileScreen, n)
    fireEvent.press(await screen.findByText('Verify phone number →'))
    expect(n.navigate).toHaveBeenCalledWith('VerifyPhone', { phone: '+40712345678' })
  })

  it('is not offered once verified', async () => {
    show(ProfileScreen, nav())
    await screen.findByText('Maria Ionescu')
    expect(screen.queryByText('Verify phone number →')).toBeNull()
  })

  it('texts a code only when asked, then verifies it and goes back', async () => {
    api.sendPhoneCode.mockResolvedValue({ sent: true })
    api.verifyPhone.mockResolvedValue({ verified: true })
    const n = nav()
    showVerify(n)
    expect(api.sendPhoneCode).not.toHaveBeenCalled()
    fireEvent.press(screen.getByText('Text me a code'))
    expect(await screen.findByText('We texted a code to +40712345678.')).toBeOnTheScreen()
    fireEvent.changeText(screen.getByLabelText('Code'), '12a3456')
    fireEvent.press(screen.getByText('Verify'))
    await waitFor(() => expect(n.goBack).toHaveBeenCalled())
    expect(api.verifyPhone).toHaveBeenCalledWith('123456')
  })

  it('wants all six digits, and shows what the server says about a wrong code', async () => {
    api.sendPhoneCode.mockResolvedValue({ sent: true })
    api.verifyPhone.mockRejectedValue(new ApiError('VALIDATION_ERROR', 'That code is not correct'))
    const n = nav()
    showVerify(n)
    fireEvent.press(screen.getByText('Text me a code'))
    await screen.findByLabelText('Code')
    fireEvent.changeText(screen.getByLabelText('Code'), '123')
    fireEvent.press(screen.getByText('Verify'))
    expect(screen.getByText('Enter the 6-digit code from the text.')).toBeOnTheScreen()
    fireEvent.changeText(screen.getByLabelText('Code'), '000000')
    fireEvent.press(screen.getByText('Verify'))
    expect(await screen.findByText('That code is not correct')).toBeOnTheScreen()
    expect(n.goBack).not.toHaveBeenCalled()
  })
})

describe('Trust score detail (E08-05)', () => {
  const detail = (over: Partial<TrustScoreDetail> = {}): TrustScoreDetail => ({
    score: 64,
    tier: 'Fair',
    tierDescription: 'A card on file is required.',
    canBook: true,
    maxActiveBookings: null,
    requiresCardOnFile: true,
    requiresUpfrontDeposit: false,
    events: [
      {
        id: 'e1',
        delta: -5,
        reason: 'LATE_CANCEL',
        label: 'Late cancellation',
        bookingId: 'b1',
        createdAt: '2026-10-14T10:00:00.000Z',
      },
      {
        id: 'e2',
        delta: 1,
        reason: 'MONTHLY_RECOVERY',
        label: 'Monthly recovery',
        bookingId: null,
        createdAt: '2026-09-01T10:00:00.000Z',
      },
    ],
    nextCursor: null,
    hasMore: false,
    tiers: [
      { name: 'Good', range: '70–89', description: 'No restrictions.', colour: '#22C55E' },
      {
        name: 'Fair',
        range: '50–69',
        description: 'A card on file is required.',
        colour: '#F59E0B',
      },
    ],
    ...over,
  })

  it('groups the history by month', () => {
    expect(
      withMonths(detail().events, 'en').map(r => (r.kind === 'month' ? r.label : r.event.id))
    ).toEqual(['October 2026', 'e1', 'September 2026', 'e2'])
  })

  it('shows the tiers with yours marked, signed deltas, and opens a booking', async () => {
    api.trustScore.mockResolvedValue(detail())
    const n = nav()
    show(TrustScoreDetailScreen, n)
    expect(await screen.findByText('−5')).toBeOnTheScreen()
    expect(screen.getByText('+1')).toBeOnTheScreen()
    expect(screen.getByLabelText(/^Fair, 50–69: .*, your tier$/)).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Late cancellation'))
    expect(n.navigate).toHaveBeenCalledWith('BookingDetail', { id: 'b1' })
    // No booking: not a button.
    fireEvent.press(screen.getByText('Monthly recovery'))
    expect(n.navigate).toHaveBeenCalledTimes(1)
  })

  it('says when there is no history yet', async () => {
    api.trustScore.mockResolvedValue(detail({ events: [] }))
    show(TrustScoreDetailScreen, nav())
    expect(await screen.findByText('No score events yet')).toBeOnTheScreen()
  })
})

describe('Edit profile (E08-06)', () => {
  it('saves only what changed, and only once something did', async () => {
    api.update.mockResolvedValue({ ...profile, name: 'Maria Pop', city: 'Iași' })
    const n = nav()
    show(EditProfileScreen, n)
    await screen.findByDisplayValue('Maria Ionescu')
    expect(screen.getByLabelText('Save changes')).toBeDisabled()
    expect(screen.getByText('Email cannot be changed.')).toBeOnTheScreen()

    fireEvent.changeText(screen.getByLabelText('Full name'), 'Maria Pop')
    fireEvent.press(screen.getByText('Iași'))
    press('Save changes')
    await waitFor(() => expect(n.goBack).toHaveBeenCalled())
    expect(api.update).toHaveBeenCalledWith({ name: 'Maria Pop', city: 'Iași' })
  })

  it('catches a phone number without a country code', async () => {
    show(EditProfileScreen, nav())
    fireEvent.changeText(await screen.findByLabelText('Phone'), '0712')
    press('Save changes')
    expect(await screen.findByText(/Phone must include country code/)).toBeOnTheScreen()
    expect(api.update).not.toHaveBeenCalled()
  })
})

describe('Change password (E08-06)', () => {
  const fill = (current: string, next: string, confirm: string) => {
    fireEvent.changeText(screen.getByLabelText('Current password'), current)
    fireEvent.changeText(screen.getByLabelText('New password'), next)
    fireEvent.changeText(screen.getByLabelText('Confirm new password'), confirm)
  }

  it('shows strength, catches a mismatch, and a wrong current password under its field', async () => {
    api.changePassword.mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'Your password is not correct', { reason: 'WRONG_PASSWORD' })
    )
    show(ChangePasswordScreen, nav())
    fill('OldPass123', 'BrandNew123', 'BrandNew12')
    expect(screen.getByText(/^Password strength: /)).toBeOnTheScreen()
    expect(screen.getByText('Passwords do not match')).toBeOnTheScreen()
    fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'BrandNew123')
    press('Change password')
    expect(await screen.findByText('Your password is not correct')).toBeOnTheScreen()
  })

  it('on success, says so and signs out', async () => {
    api.changePassword.mockResolvedValue({ message: 'ok' })
    const alert = jest.spyOn(Alert, 'alert')
    show(ChangePasswordScreen, nav())
    fill('OldPass123', 'BrandNew123', 'BrandNew123')
    press('Change password')
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Password updated', expect.any(String), expect.any(Array))
    )
    expect(api.changePassword).toHaveBeenCalledWith({
      currentPassword: 'OldPass123',
      newPassword: 'BrandNew123',
    })
    answer(alert, 'OK')
    await waitFor(() => expect(logout).toHaveBeenCalled())
  })
})

describe('Delete account (E08-06)', () => {
  it('needs the password and a second yes, then signs out', async () => {
    api.deleteAccount.mockResolvedValue({ message: 'ok' })
    const alert = jest.spyOn(Alert, 'alert')
    show(DeleteAccountScreen, nav())
    expect(screen.getByText('This action is permanent and cannot be undone')).toBeOnTheScreen()
    press('Permanently delete my account')
    expect(screen.getByText('Enter your password')).toBeOnTheScreen()

    fireEvent.changeText(screen.getByLabelText('Password'), 'Testing123')
    press('Permanently delete my account')
    answer(alert, 'Cancel')
    expect(api.deleteAccount).not.toHaveBeenCalled()
    press('Permanently delete my account')
    answer(alert, 'Delete')
    await waitFor(() => expect(logout).toHaveBeenCalled())
    expect(api.deleteAccount).toHaveBeenCalledWith({ password: 'Testing123', reason: '' })
  })
})

describe('Payment methods (E08-07)', () => {
  it('without Stripe: says so, and offers no Add', async () => {
    bookings.paymentConfig.mockResolvedValue({ provider: 'test', publishableKey: null })
    api.cards.mockResolvedValue([])
    show(PaymentMethodsScreen, nav())
    expect(await screen.findByText('No saved cards')).toBeOnTheScreen()
    expect(screen.getByText(/Saving cards needs Stripe/)).toBeOnTheScreen()
    expect(screen.queryByText('Add new card')).toBeNull()
  })

  it('removes a card after a confirmation, at once, and puts it back on failure', async () => {
    bookings.paymentConfig.mockResolvedValue({ provider: 'stripe', publishableKey: 'pk_test_x' })
    api.cards.mockResolvedValue([
      { id: 'pm_1', brand: 'visa', last4: '4242', expMonth: 4, expYear: 2030 },
    ])
    api.removeCard.mockRejectedValue(new ApiError('NOT_FOUND', 'Card not found'))
    const alert = jest.spyOn(Alert, 'alert')
    show(PaymentMethodsScreen, nav())
    expect(await screen.findByText('Visa ···· 4242')).toBeOnTheScreen()
    expect(screen.getByText('Expires 04/30')).toBeOnTheScreen()
    expect(screen.getByText('Add new card')).toBeOnTheScreen()
    press('Remove Visa ending 4242')
    answer(alert, 'Remove')
    expect(await screen.findByText('Card not found')).toBeOnTheScreen()
    expect(screen.getByText('Visa ···· 4242')).toBeOnTheScreen()
  })
})

describe('Notifications (E08-09)', () => {
  const now = new Date('2026-10-15T12:00:00Z')
  it('groups by day: today, yesterday, this week, older', () => {
    const at = (d: number) => `${addDays(venueClock(now).date, d)}T09:00:00Z`
    expect([0, -1, -3, -10].map(d => groupOf(at(d), now))).toEqual([
      'Today',
      'Yesterday',
      'Earlier this week',
      'Older',
    ])
  })

  const item = (over: Partial<NotificationItem>): NotificationItem => ({
    id: 'n1',
    type: 'BOOKING_CONFIRMED',
    title: 'Booking confirmed',
    body: 'Teren 2 · Thursday',
    data: { bookingId: 'b1' },
    isRead: false,
    createdAt: new Date().toISOString(),
    ...over,
  })

  it('a tap marks it read and opens the booking; Mark all read; long press deletes', async () => {
    api.notifications.mockResolvedValue({
      items: [
        item({}),
        item({ id: 'n2', type: 'MANAGER_REPLIED', title: 'Arena replied', isRead: true, data: {} }),
      ],
      nextCursor: null,
      hasMore: false,
      unread: 1,
    })
    api.markRead.mockResolvedValue({ read: true })
    api.markAllRead.mockResolvedValue({ updated: 1 })
    api.deleteNotification.mockResolvedValue(null)
    const alert = jest.spyOn(Alert, 'alert')
    const n = nav()
    show(NotificationsScreen, n)
    expect(await screen.findByText('TODAY')).toBeOnTheScreen()

    fireEvent.press(screen.getByLabelText(/^Unread\. Booking confirmed/))
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('BookingDetail', { id: 'b1' }))
    expect(api.markRead).toHaveBeenCalledWith('n1')

    fireEvent.press(screen.getByLabelText(/^Arena replied/))
    expect(n.navigate).toHaveBeenCalledWith('MyReviews')
    expect(api.markRead).toHaveBeenCalledTimes(1)

    fireEvent.press(screen.getByText('Mark all read'))
    await waitFor(() => expect(api.markAllRead).toHaveBeenCalled())

    fireEvent(screen.getByLabelText(/^Arena replied/), 'longPress')
    answer(alert, 'Delete')
    await waitFor(() => expect(api.deleteNotification).toHaveBeenCalledWith('n2'))
  })

  it('all caught up when there are none', async () => {
    api.notifications.mockResolvedValue({ items: [], nextCursor: null, hasMore: false, unread: 0 })
    show(NotificationsScreen, nav())
    expect(await screen.findByText('All caught up!')).toBeOnTheScreen()
    expect(screen.queryByText('Mark all read')).toBeNull()
  })
})

describe('push routing (E08-10, without Firebase)', () => {
  it('opens the same place as the list would', () => {
    const n = nav()
    expect(openNotification(n, 'NO_SHOW_REPORTED', { bookingId: 'b9' })).toBe(true)
    expect(n.navigate).toHaveBeenCalledWith('BookingDetail', { id: 'b9' })
    expect(openNotification(n, 'OTP', {})).toBe(false)
    expect(openNotification(n, undefined, {})).toBe(false)
  })

  it('registers a token for iOS and Android only', async () => {
    api.registerDevice.mockResolvedValue({ registered: true })
    await registerPushToken('tok_123', 'android')
    await registerPushToken('tok_123', 'web')
    expect(api.registerDevice).toHaveBeenCalledTimes(1)
    expect(api.registerDevice).toHaveBeenCalledWith('tok_123', 'android')
  })
})

describe('push with Firebase (E08-10)', () => {
  // The Firebase instance from jest.setup.js.
  const fcm = (messaging as unknown as { instance: Record<string, jest.Mock> }).instance

  beforeEach(() => {
    api.registerDevice.mockResolvedValue({ registered: true })
  })

  it('registers the token, follows its refreshes and opens the push that launched the app', async () => {
    fcm.getInitialNotification!.mockResolvedValueOnce({
      data: { type: 'NO_SHOW_REPORTED', bookingId: 'b9' },
    })
    const n = nav()
    const stop = await startPush(n)
    expect(api.registerDevice).toHaveBeenCalledWith('fcm-token-from-jest-0001', 'ios')
    expect(n.navigate).toHaveBeenCalledWith('BookingDetail', { id: 'b9' })

    const refresh = fcm.onTokenRefresh!.mock.calls[0]![0] as (token: string) => void
    refresh('fcm-token-rotated-0002')
    expect(api.registerDevice).toHaveBeenLastCalledWith('fcm-token-rotated-0002', 'ios')

    const opened = fcm.onNotificationOpenedApp!.mock.calls[0]![0] as (m: object) => void
    opened({ data: { type: 'NO_SHOW_REPORTED', bookingId: 'b7' } })
    expect(n.navigate).toHaveBeenLastCalledWith('BookingDetail', { id: 'b7' })
    stop()
  })

  it('stays quiet when the person says no', async () => {
    fcm.requestPermission!.mockResolvedValueOnce(0)
    await startPush(nav())
    expect(fcm.getToken).not.toHaveBeenCalled()
    expect(api.registerDevice).not.toHaveBeenCalled()
  })

  it('throws the token away on sign-out', async () => {
    await stopPush()
    expect(fcm.deleteToken).toHaveBeenCalled()
  })
})
