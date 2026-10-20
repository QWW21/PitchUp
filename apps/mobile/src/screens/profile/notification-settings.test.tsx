/**
 * Notification settings on the phone — E13-09. profileApi mocked.
 */
import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { NotificationPreferences } from '@pitchup/shared'
import { profileApi } from '../../lib/profileApi'
import { ApiError } from '../../lib/apiClient'
import { NotificationSettingsScreen } from './NotificationSettingsScreen'

jest.mock('../../lib/profileApi')
const api = jest.mocked(profileApi)

const prefs = (over: Partial<NotificationPreferences> = {}): NotificationPreferences => ({
  pushEnabled: true,
  emailEnabled: true,
  disabledTypes: [],
  ...over,
})

function show() {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const S = NotificationSettingsScreen as unknown as React.ComponentType<{
    navigation: object
    route: object
  }>
  render(
    <QueryClientProvider client={client}>
      <S navigation={navigation} route={{ key: 'k', name: 'n' }} />
    </QueryClientProvider>
  )
  return navigation
}

beforeEach(() => jest.clearAllMocks())

describe('Notification settings (E13-09)', () => {
  it('switches a channel off and saves it', async () => {
    api.notificationPreferences.mockResolvedValue(prefs())
    api.updateNotificationPreferences.mockResolvedValue(prefs({ emailEnabled: false }))
    show()
    fireEvent(await screen.findByLabelText('Email'), 'valueChange', false)
    await waitFor(() =>
      expect(api.updateNotificationPreferences).toHaveBeenCalledWith({ emailEnabled: false })
    )
  })

  it('mutes a kind of notification as its types', async () => {
    api.notificationPreferences.mockResolvedValue(prefs())
    api.updateNotificationPreferences.mockImplementation(async p => prefs(p as never))
    show()
    fireEvent(await screen.findByLabelText('Booking reminders'), 'valueChange', false)
    await waitFor(() =>
      expect(api.updateNotificationPreferences).toHaveBeenCalledWith({
        disabledTypes: ['BOOKING_REMINDER_24H', 'BOOKING_REMINDER_2H'],
      })
    )
  })

  it('offers no text messages: they are not a notification channel', async () => {
    api.notificationPreferences.mockResolvedValue(prefs())
    show()
    expect(await screen.findByLabelText('Push notifications')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Text messages')).toBeNull()
  })

  it('puts a switch back and says why when saving fails', async () => {
    api.notificationPreferences.mockResolvedValue(prefs())
    api.updateNotificationPreferences.mockRejectedValue(
      new ApiError('INTERNAL_ERROR', 'Something went wrong')
    )
    const alert = jest.spyOn(Alert, 'alert')
    show()
    fireEvent(await screen.findByLabelText('Push notifications'), 'valueChange', false)
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Not saved', 'Something went wrong'))
    expect(screen.getByLabelText('Push notifications')).toHaveProp('value', true)
  })
})
