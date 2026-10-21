/**
 * A venue manager's bookings on the phone — E11-09. The screens with a fake
 * navigator and managerApi mocked.
 */
import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ManagerBooking, ManagerBookingDetail } from '@pitchup/shared'
import { managerApi } from '../../lib/managerApi'
import { ManagerBookingsScreen } from './ManagerBookingsScreen'
import { ManagerBookingDetailScreen } from './ManagerBookingDetailScreen'

jest.mock('../../lib/managerApi')
const api = jest.mocked(managerApi)

const row = (over: Partial<ManagerBooking> = {}): ManagerBooking => ({
  id: 'b1',
  reference: '#B00K1',
  status: 'CONFIRMED',
  date: '2026-11-04',
  startTime: '18:00',
  endTime: '19:30',
  pitch: { id: 'p1', name: 'Teren 1', color: '#6366F1' },
  player: { name: 'Andrei Pop' },
  total: 135,
  paymentMethod: 'ONLINE',
  deposit: null,
  dueAtVenue: 0,
  attendedAt: null,
  canConfirmAttended: false,
  canReportNoShow: false,
  canComplete: false,
  canAccept: false,
  approvalDeadline: null,
  canCancel: false,
  ...over,
})

const detail = (over: Partial<ManagerBookingDetail> = {}): ManagerBookingDetail => ({
  ...row(),
  minutes: 90,
  createdAt: '2026-11-01T10:00:00Z',
  platformFee: 10.8,
  venuePayout: 124.2,
  teams: [
    { name: 'Team A', players: 7, colour: null },
    { name: 'Team B', players: 7, colour: null },
  ],
  shirtSets: 0,
  airType: null,
  note: null,
  refundAmount: null,
  cancellationReason: null,
  player: {
    name: 'Andrei Pop',
    phone: '+40712000111',
    history: { bookings: 4, completed: 3, noShows: 0, lateCancels: 1 },
  },
  statusHistory: [
    { status: 'PENDING', at: '2026-11-01T10:00:00Z' },
    { status: 'CONFIRMED', at: '2026-11-01T10:01:00Z' },
  ],
  review: null,
  noShow: null,
  ...over,
})

function show(Screen: unknown, params?: object) {
  const S = Screen as React.ComponentType<{ navigation: object; route: object }>
  const navigation = { navigate: jest.fn(), goBack: jest.fn() }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <S navigation={navigation} route={{ key: 'k', name: 'n', params }} />
    </QueryClientProvider>
  )
  return navigation
}

beforeEach(() => {
  jest.clearAllMocks()
  api.pitches.mockResolvedValue([
    { id: 'p1', name: 'Teren 1' },
    { id: 'p2', name: 'Teren 2' },
  ] as never)
})

describe('Venue bookings (E11-09)', () => {
  it('lists bookings with what is due, filters by status and pitch, and opens one', async () => {
    api.bookings.mockResolvedValue({
      items: [row({ paymentMethod: 'VENUE_DEPOSIT_TOWARDS', deposit: 27, dueAtVenue: 108 })],
      nextCursor: null,
    })
    const nav = show(ManagerBookingsScreen)
    expect(await screen.findByText('Andrei Pop')).toBeOnTheScreen()
    expect(screen.getByText('Teren 1 · 135 RON · 108 RON at the venue')).toBeOnTheScreen()
    expect(api.bookings).toHaveBeenCalledWith({ status: undefined, pitchId: undefined }, null)

    api.bookings.mockResolvedValue({ items: [], nextCursor: null })
    fireEvent.press(screen.getByText('No-show'))
    expect(await screen.findByText('No bookings found')).toBeOnTheScreen()
    expect(api.bookings).toHaveBeenLastCalledWith({ status: 'NO_SHOW', pitchId: undefined }, null)
    fireEvent.press(screen.getByText('Teren 2'))
    await waitFor(() =>
      expect(api.bookings).toHaveBeenLastCalledWith({ status: 'NO_SHOW', pitchId: 'p2' }, null)
    )

    api.bookings.mockResolvedValue({ items: [row()], nextCursor: null })
    fireEvent.press(screen.getByText('All'))
    fireEvent.press(await screen.findByLabelText(/^Andrei Pop/))
    expect(nav.navigate).toHaveBeenCalledWith('ManagerBookingDetail', { id: 'b1' })
  })
})

describe('Venue booking detail (E11-09)', () => {
  it('shows the booking, the player at this venue and the payout', async () => {
    api.booking.mockResolvedValue(detail())
    show(ManagerBookingDetailScreen, { id: 'b1' })
    expect(await screen.findByText('Booking #B00K1')).toBeOnTheScreen()
    expect(
      screen.getByText('With you: 4 bookings, 3 played, 0 no-shows, 1 late cancellations.')
    ).toBeOnTheScreen()
    expect(screen.getByText('124.2 RON')).toBeOnTheScreen()
    expect(screen.queryByText('Report no-show')).toBeNull()
  })

  it('asks before reporting a no-show, then sends it', async () => {
    api.booking.mockResolvedValue(detail({ canReportNoShow: true, canConfirmAttended: true }))
    api.noShow.mockResolvedValue(row({ status: 'NO_SHOW' }))
    const alert = jest.spyOn(Alert, 'alert')
    show(ManagerBookingDetailScreen, { id: 'b1' })
    fireEvent.press(await screen.findByText('Report no-show'))
    expect(alert).toHaveBeenCalledWith('Report a no-show?', expect.any(String), expect.any(Array))
    expect(api.noShow).not.toHaveBeenCalled()
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[]
    buttons.find(b => b.text === 'Confirm')!.onPress!()
    await waitFor(() => expect(api.noShow).toHaveBeenCalledWith('b1'))
  })
})

describe('Answering a booking (C-12, C-13)', () => {
  const waiting = () =>
    detail({
      status: 'AWAITING_APPROVAL',
      canAccept: true,
      canCancel: true,
      approvalDeadline: '2026-11-03T10:00:00Z',
    })

  it('accepts a booking that waits for the venue', async () => {
    api.booking.mockResolvedValue(waiting())
    api.accept.mockResolvedValue(row())
    show(ManagerBookingDetailScreen, { id: 'b1' })
    expect(await screen.findByText('Needs your answer')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Accept booking'))
    await waitFor(() => expect(api.accept).toHaveBeenCalledWith('b1'))
  })

  it('declines only with a reason for the player', async () => {
    api.booking.mockResolvedValue(waiting())
    api.cancel.mockResolvedValue(row({ status: 'CANCELLED' }))
    show(ManagerBookingDetailScreen, { id: 'b1' })
    fireEvent.press(await screen.findByText('Decline'))
    fireEvent.press(screen.getByText('Decline and refund'))
    expect(api.cancel).not.toHaveBeenCalled()
    fireEvent.changeText(screen.getByLabelText('Reason for the player'), 'The pitch is flooded')
    fireEvent.press(screen.getByText('Decline and refund'))
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('b1', 'The pitch is flooded'))
  })

  it('cancels a confirmed booking the same way', async () => {
    api.booking.mockResolvedValue(detail({ canCancel: true }))
    show(ManagerBookingDetailScreen, { id: 'b1' })
    fireEvent.press(await screen.findByText('Cancel booking'))
    expect(screen.getByText('Cancel this booking?')).toBeOnTheScreen()
  })
})
