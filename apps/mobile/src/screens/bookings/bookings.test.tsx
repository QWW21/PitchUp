/**
 * My Bookings on mobile — E06-06 … E06-09. Screens rendered with a fake
 * navigator and bookingApi mocked: what is checked is what each screen shows,
 * what it sends, and where it goes.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { addDays, venueClock, type BookingDetail, type BookingListItem } from '@pitchup/shared'
import { bookingApi } from '../../lib/bookingApi'
import { ApiError } from '../../lib/apiClient'
import { MyBookingsScreen } from './MyBookingsScreen'
import { BookingDetailScreen } from './BookingDetailScreen'
import { ReviewScreen } from './ReviewScreen'

jest.mock('../../lib/bookingApi')
const api = jest.mocked(bookingApi)

const date = addDays(venueClock(new Date()).date, 5)
const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString()

function makeNav() {
  return { navigate: jest.fn(), goBack: jest.fn(), popTo: jest.fn() }
}
type Nav = ReturnType<typeof makeNav>

function show(Screen: unknown, navigation: Nav, params?: object) {
  const S = Screen as React.ComponentType<{ navigation: Nav; route: object }>
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <S navigation={navigation} route={{ key: 'k', name: 'n', params }} />
    </QueryClientProvider>
  )
}

const press = (label: string | RegExp) => fireEvent.press(screen.getByLabelText(label))

const item = (over: Partial<BookingListItem> = {}): BookingListItem => ({
  id: 'b1',
  reference: '#B00K1',
  status: 'CONFIRMED',
  date,
  startTime: '18:00',
  endTime: '20:00',
  minutes: 120,
  startsAt: hours(120),
  pitch: { id: 'p1', name: 'Teren 1', surfaceType: 'ARTIFICIAL_GRASS' },
  company: { id: 'c1', name: 'Arena Gheorgheni', logoUrl: null },
  total: 360,
  refundAmount: null,
  cancelledBy: null,
  hasReview: false,
  canReview: false,
  ...over,
})

const detail = (over: Partial<BookingDetail> = {}): BookingDetail =>
  ({
    id: 'b1',
    reference: '#B00K1',
    status: 'CONFIRMED',
    date,
    startTime: '18:00',
    endTime: '20:00',
    minutes: 120,
    teamCount: 2,
    shirtSets: 0,
    total: 360,
    paidAt: hours(-1),
    cancellationReason: null,
    startsAt: hours(120),
    createdAt: hours(-1),
    pitch: { id: 'p1', name: 'Teren 1', surfaceType: 'ARTIFICIAL_GRASS', size: 'SIX_A_SIDE' },
    company: {
      id: 'c1',
      name: 'Arena Gheorgheni',
      address: 'Str. X',
      city: 'Cluj-Napoca',
      logoUrl: null,
      phone: '+40712345678',
    },
    teams: [
      { name: 'Team 1', players: 6, colour: null },
      { name: 'Team 2', players: 6, colour: null },
    ],
    note: null,
    payment: {
      provider: 'test',
      cardBrand: null,
      cardLast4: null,
      paidAt: hours(-1),
      refundAmount: null,
      refundedAt: null,
    },
    cancelledBy: null,
    statusHistory: [
      { status: 'PENDING', at: hours(-1) },
      { status: 'CONFIRMED', at: hours(-1) },
    ],
    cancellation: { refundPercent: 100, refundAmount: 360 },
    review: null,
    canReview: false,
    noShow: null,
    ...over,
  }) as BookingDetail

beforeEach(() => jest.clearAllMocks())

describe('My Bookings (E06-06)', () => {
  it('lists the upcoming bookings and switches tabs', async () => {
    api.list.mockResolvedValue({ items: [item()], nextCursor: null, hasMore: false })
    const nav = makeNav()
    show(MyBookingsScreen, nav)
    expect(await screen.findByText('Teren 1')).toBeOnTheScreen()
    expect(api.list).toHaveBeenCalledWith('upcoming', null)
    expect(screen.getByText('Confirmed')).toBeOnTheScreen()

    api.list.mockResolvedValue({ items: [], nextCursor: null, hasMore: false })
    fireEvent.press(screen.getByText('Past'))
    expect(await screen.findByText('No past bookings yet')).toBeOnTheScreen()
    expect(api.list).toHaveBeenCalledWith('past', null)
  })

  it('opens a booking', async () => {
    api.list.mockResolvedValue({ items: [item()], nextCursor: null, hasMore: false })
    const nav = makeNav()
    show(MyBookingsScreen, nav)
    fireEvent.press(await screen.findByLabelText(/^Teren 1 at Arena Gheorgheni/))
    expect(nav.navigate).toHaveBeenCalledWith('BookingDetail', { id: 'b1' })
  })

  it('shows the empty state with a way to Discover', async () => {
    api.list.mockResolvedValue({ items: [], nextCursor: null, hasMore: false })
    const nav = makeNav()
    show(MyBookingsScreen, nav)
    expect(await screen.findByText('No upcoming bookings')).toBeOnTheScreen()
    press('Find a pitch')
    expect(nav.navigate).toHaveBeenCalledWith('Discover')
  })

  it('past cards offer a review and a re-book', async () => {
    api.list.mockResolvedValue({
      items: [item({ status: 'COMPLETED', canReview: true, startsAt: hours(-48) })],
      nextCursor: null,
      hasMore: false,
    })
    const nav = makeNav()
    show(MyBookingsScreen, nav, { tab: 'past' })
    expect(await screen.findByText('Completed')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Leave a review'))
    expect(nav.navigate).toHaveBeenCalledWith('Review', { bookingId: 'b1' })
    fireEvent.press(screen.getByText('Re-book'))
    expect(nav.navigate).toHaveBeenCalledWith('PitchDetail', { pitchId: 'p1', companyId: 'c1' })
  })

  it('opens on the tab it is sent to and says why', async () => {
    api.list.mockResolvedValue({
      items: [item({ status: 'CANCELLED', cancelledBy: 'PLAYER', refundAmount: 180 })],
      nextCursor: null,
      hasMore: false,
    })
    show(MyBookingsScreen, makeNav(), { tab: 'cancelled', notice: 'Booking cancelled.' })
    expect(await screen.findByText('Cancelled by you')).toBeOnTheScreen()
    expect(screen.getByText('· Refund: 180 RON')).toBeOnTheScreen()
    expect(screen.getByText('Booking cancelled.')).toBeOnTheScreen()
    expect(api.list).toHaveBeenCalledWith('cancelled', null)
  })
})

describe('Booking detail (E06-07, E06-08)', () => {
  it('shows the booking, its payment and its history', async () => {
    api.get.mockResolvedValue(detail())
    show(BookingDetailScreen, makeNav(), { id: 'b1' })
    expect(await screen.findByText('Booking details')).toBeOnTheScreen()
    expect(screen.getByText('#B00K1')).toBeOnTheScreen()
    expect(screen.getByText('Test payment')).toBeOnTheScreen()
    expect(screen.getByText('Paid and confirmed')).toBeOnTheScreen()
    expect(screen.getByText('Booked, awaiting payment')).toBeOnTheScreen()
    expect(screen.getByLabelText('Call Arena Gheorgheni')).toBeOnTheScreen()
  })

  it('cancels with the refund the policy gives, then returns to the Cancelled tab', async () => {
    api.get.mockResolvedValue(detail({ cancellation: { refundPercent: 50, refundAmount: 180 } }))
    api.cancel.mockResolvedValue({ refundAmount: 180, refundPercent: 50, booking: detail() })
    const nav = makeNav()
    show(BookingDetailScreen, nav, { id: 'b1' })
    fireEvent.press(await screen.findByLabelText('Cancel booking'))
    expect(screen.getByText(/50% refund/)).toBeOnTheScreen()
    press('Cancel — get 180 RON refund')
    await waitFor(() =>
      expect(nav.popTo).toHaveBeenCalledWith('MyBookings', {
        tab: 'cancelled',
        notice: expect.stringContaining('180 RON will be refunded'),
      })
    )
    expect(api.cancel).toHaveBeenCalledWith('b1')
  })

  it('keeps the booking when the player changes their mind', async () => {
    api.get.mockResolvedValue(detail({ cancellation: { refundPercent: 0, refundAmount: 0 } }))
    show(BookingDetailScreen, makeNav(), { id: 'b1' })
    fireEvent.press(await screen.findByLabelText('Cancel booking'))
    expect(screen.getByText('No refund')).toBeOnTheScreen()
    press('Keep my booking')
    expect(api.cancel).not.toHaveBeenCalled()
  })

  it('says why a cancellation failed', async () => {
    api.get.mockResolvedValue(detail())
    api.cancel.mockRejectedValue(
      new ApiError('NOT_CANCELLABLE', 'This booking has already started')
    )
    const nav = makeNav()
    show(BookingDetailScreen, nav, { id: 'b1' })
    fireEvent.press(await screen.findByLabelText('Cancel booking'))
    press('Cancel — get 360 RON refund')
    expect(await screen.findByText('This booking has already started')).toBeOnTheScreen()
    expect(nav.popTo).not.toHaveBeenCalled()
  })

  it('offers a review after the game', async () => {
    api.get.mockResolvedValue(detail({ status: 'COMPLETED', cancellation: null, canReview: true }))
    const nav = makeNav()
    show(BookingDetailScreen, nav, { id: 'b1' })
    fireEvent.press(await screen.findByLabelText('Rate this pitch'))
    expect(nav.navigate).toHaveBeenCalledWith('Review', { bookingId: 'b1' })
  })

  it('disputes a no-show with what happened', async () => {
    api.get.mockResolvedValue(
      detail({
        status: 'NO_SHOW',
        cancellation: null,
        noShow: { reason: 'Nobody came', disputeStatus: 'NONE', disputeUntil: hours(20) },
      })
    )
    api.dispute.mockResolvedValue({ message: 'ok' })
    show(BookingDetailScreen, makeNav(), { id: 'b1' })
    fireEvent.changeText(await screen.findByLabelText('What happened'), 'We played, ask the staff')
    press('Dispute no-show')
    await waitFor(() => expect(api.dispute).toHaveBeenCalledWith('b1', 'We played, ask the staff'))
  })

  it('lets the player edit or delete a fresh review', async () => {
    api.get.mockResolvedValue(
      detail({
        status: 'COMPLETED',
        cancellation: null,
        review: {
          id: 'r1',
          rating: 4,
          text: 'Good pitch, nice lights',
          isAnonymous: false,
          createdAt: hours(-1),
          editableUntil: hours(23),
        },
      })
    )
    api.deleteReview.mockResolvedValue(null)
    const nav = makeNav()
    show(BookingDetailScreen, nav, { id: 'b1' })
    expect(await screen.findByLabelText('4 out of 5 stars')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Edit review'))
    expect(nav.navigate).toHaveBeenCalledWith('Review', { bookingId: 'b1' })
    fireEvent.press(screen.getByText('Delete review'))
    await waitFor(() => expect(api.deleteReview).toHaveBeenCalledWith('r1'))
  })
})

describe('Review (E06-09)', () => {
  const played = detail({ status: 'COMPLETED', cancellation: null, canReview: true })

  it('needs a star before it sends anything', async () => {
    api.get.mockResolvedValue(played)
    show(ReviewScreen, makeNav(), { bookingId: 'b1' })
    expect(await screen.findByText('Teren 1')).toBeOnTheScreen()
    press('Submit review')
    expect(api.createReview).not.toHaveBeenCalled()
  })

  it('asks for at least 10 characters when there is text', async () => {
    api.get.mockResolvedValue(played)
    show(ReviewScreen, makeNav(), { bookingId: 'b1' })
    fireEvent.press(await screen.findByLabelText('4 stars'))
    fireEvent.changeText(screen.getByLabelText('Your review'), 'Nice')
    expect(screen.getByText('Review must be at least 10 characters')).toBeOnTheScreen()
    expect(screen.getByLabelText('Submit review')).toBeDisabled()
  })

  it('posts the rating, text and anonymity, then goes back', async () => {
    api.get.mockResolvedValue(played)
    api.createReview.mockResolvedValue({ id: 'r1' })
    const nav = makeNav()
    show(ReviewScreen, nav, { bookingId: 'b1' })
    fireEvent.press(await screen.findByLabelText('5 stars'))
    expect(screen.getByText('Excellent!')).toBeOnTheScreen()
    fireEvent.changeText(screen.getByLabelText('Your review'), '  Great pitch, great lights  ')
    fireEvent(screen.getByLabelText('Post anonymously'), 'valueChange', true)
    press('Submit review')
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled())
    expect(api.createReview).toHaveBeenCalledWith({
      bookingId: 'b1',
      rating: 5,
      text: 'Great pitch, great lights',
      isAnonymous: true,
    })
  })

  it('edits an existing review', async () => {
    api.get.mockResolvedValue({
      ...played,
      review: {
        id: 'r1',
        rating: 3,
        text: 'It was fine overall',
        isAnonymous: false,
        createdAt: hours(-1),
        editableUntil: hours(23),
      },
    })
    api.updateReview.mockResolvedValue({ updated: true })
    const nav = makeNav()
    show(ReviewScreen, nav, { bookingId: 'b1' })
    expect(await screen.findByText('Edit your review')).toBeOnTheScreen()
    expect(screen.getByDisplayValue('It was fine overall')).toBeOnTheScreen()
    press('4 stars')
    press('Save changes')
    await waitFor(() =>
      expect(api.updateReview).toHaveBeenCalledWith('r1', {
        rating: 4,
        text: 'It was fine overall',
        isAnonymous: false,
      })
    )
  })
})
