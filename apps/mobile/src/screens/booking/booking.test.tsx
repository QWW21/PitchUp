/**
 * The mobile booking flow — E05-01 … E05-06. Each step rendered with a fake
 * navigator, the booking store seeded, and bookingApi mocked: what is checked
 * is the step's behaviour (what it shows, what it sends, where it goes).
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { addDays, venueClock, type PitchAvailability } from '@pitchup/shared'
import { DEFAULT_REFUND_POLICY } from '@pitchup/shared'
import { bookingApi } from '../../lib/bookingApi'
import { ApiError } from '../../lib/apiClient'
import { useBookingStore, bookingBody, type BookingPitch } from '../../stores/bookingStore'
import { Step1DateScreen, monthGrid } from './Step1DateScreen'
import { Step2TimeScreen } from './Step2TimeScreen'
import { Step3TeamsScreen } from './Step3TeamsScreen'
import { Step4SummaryScreen } from './Step4SummaryScreen'
import { Step5ConfirmationScreen } from './Step5ConfirmationScreen'

jest.mock('../../lib/bookingApi')
const api = jest.mocked(bookingApi)

const pitch: BookingPitch = {
  id: 'p1',
  name: 'Teren 1',
  companyName: 'Arena Gheorgheni',
  hourlyRate: 120,
  size: 'SIX_A_SIDE',
  hasShirts: true,
  shirtStock: [
    { colour: 'RED', quantity: 2 },
    { colour: 'BLUE', quantity: 1 },
  ],
  minBookingHours: 1,
  maxBookingHours: 4,
  advanceBookingDays: 60,
}
const today = venueClock(new Date()).date
const date = addDays(today, 10)

function makeNav() {
  const parent = { goBack: jest.fn(), replace: jest.fn() }
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
    getParent: () => parent,
    parent,
  }
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

beforeEach(() => {
  jest.clearAllMocks()
  useBookingStore.getState().start(pitch)
  api.paymentConfig.mockResolvedValue({ provider: 'test', publishableKey: null })
})

describe('bookingStore', () => {
  it('defaults players to what the size suggests and clears the time on a new date', () => {
    const s = useBookingStore.getState()
    expect(s.players).toEqual([6, 6, 6])
    s.setDate(date)
    s.setTime('18:00', '20:00', 120)
    useBookingStore.getState().setDate(addDays(date, 1))
    expect(useBookingStore.getState()).toMatchObject({ startTime: null, minutes: 0 })
  })

  it('builds the request: colours only for teams that borrow shirts', () => {
    const s = useBookingStore.getState()
    s.setDate(date)
    s.setTime('18:00', '20:00', 120)
    s.setTeamCount(3)
    s.setWantsShirts(true)
    s.setColour(0, 'RED')
    s.setNote('  bring a ball  ')
    expect(bookingBody(useBookingStore.getState())).toEqual({
      paymentMethod: 'ONLINE',
      pitchId: 'p1',
      date,
      startTime: '18:00',
      endTime: '20:00',
      teamCount: 3,
      teamsData: [{ playerCount: 6, colour: 'RED' }, { playerCount: 6 }, { playerCount: 6 }],
      wantsShirts: true,
      noteToManager: 'bring a ball',
    })
  })
})

describe('Step 1: date (E05-02)', () => {
  it('lays a month out Monday first, padded to whole weeks', () => {
    // 1 November 2026 is a Sunday: six blanks, then the 1st.
    const cells = monthGrid('2026-11-01')
    expect(cells.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01'])
    expect(cells.length % 7).toBe(0)
    expect(cells.filter(Boolean)).toHaveLength(30)
  })

  it('picks an available day; a full day explains itself; Next is enabled after a pick', async () => {
    const month = `${today.slice(0, 7)}-01`
    const days = monthGrid(month).filter((d): d is string => !!d)
    api.calendar.mockResolvedValue(
      days.map(d => ({
        date: d,
        status: d < today ? 'closed' : d === addDays(today, 1) ? 'full' : 'available',
      }))
    )
    const nav = makeNav()
    show(Step1DateScreen, nav)
    await waitFor(() => expect(api.calendar).toHaveBeenCalledWith('p1', month, days.length))
    expect(screen.getByLabelText('Next')).toBeDisabled()

    const pick = addDays(today, 2) <= days.at(-1)! ? addDays(today, 2) : today
    fireEvent.press(await screen.findByTestId(`day-${pick}`))
    press('Next')
    expect(useBookingStore.getState().date).toBe(pick)
    expect(nav.navigate).toHaveBeenCalledWith('BookingTime')
  })

  it('the close button on step 1 leaves without asking', () => {
    api.calendar.mockResolvedValue([])
    const nav = makeNav()
    show(Step1DateScreen, nav)
    press('Cancel booking')
    expect(nav.parent.goBack).toHaveBeenCalled()
  })
})

describe('Step 2: start and duration (C-6)', () => {
  const day = (statuses: string): PitchAvailability => ({
    date,
    pitchId: 'p1',
    isClosed: false,
    openTime: '18:00',
    closeTime: '22:00',
    slots: [...statuses].map((c, i) => ({
      time: `${18 + Math.floor(i / 2)}:${i % 2 ? '30' : '00'}`,
      status: c === 'x' ? 'booked' : 'available',
    })),
  })

  beforeEach(() => useBookingStore.getState().setDate(date))

  it('a start, then a duration; priced at the hourly rate and carried on', async () => {
    api.day.mockResolvedValue(day('........'))
    const nav = makeNav()
    show(Step2TimeScreen, nav)
    expect(await screen.findByText('EVENING')).toBeOnTheScreen()
    expect(screen.getByLabelText('Next')).toBeDisabled()
    press('18:00, available')
    // The shortest length is picked first; then two hours.
    expect(screen.getByText('18:00–19:00 · 1h · 120 RON')).toBeOnTheScreen()
    press('2h')
    expect(screen.getByText('18:00–20:00 · 2h · 240 RON')).toBeOnTheScreen()
    expect(screen.getByLabelText('18:00, selected')).toBeOnTheScreen()
    press('Next')
    expect(useBookingStore.getState()).toMatchObject({
      startTime: '18:00',
      endTime: '20:00',
      minutes: 120,
    })
    expect(nav.navigate).toHaveBeenCalledWith('BookingTeams')
  })

  it('disables starts and durations that do not fit, and keeps what still fits', async () => {
    // 18:30 booked; free from 19:00 to 22:00.
    api.day.mockResolvedValue(day('.x......'))
    show(Step2TimeScreen, makeNav())
    expect(await screen.findByLabelText('18:00, not enough time')).toBeDisabled()
    expect(screen.getByLabelText('18:30, booked')).toBeDisabled()
    expect(screen.getByLabelText('21:30, not enough time')).toBeDisabled()
    press('19:00, available')
    press('3h')
    press('20:00, available')
    // Only two hours are left before closing: the longest that fits.
    expect(screen.getByText('20:00–22:00 · 2h · 240 RON')).toBeOnTheScreen()
    expect(screen.getByLabelText('2h 30, doesn’t fit')).toBeDisabled()
  })

  it('opens on the time chosen before', async () => {
    useBookingStore.getState().setTime('19:00', '20:30', 90)
    api.day.mockResolvedValue(day('........'))
    show(Step2TimeScreen, makeNav())
    expect(await screen.findByText('19:00–20:30 · 1h 30 · 180 RON')).toBeOnTheScreen()
  })

  it('says so when nothing is free', async () => {
    api.day.mockResolvedValue(day('xxxx'))
    show(Step2TimeScreen, makeNav())
    expect(await screen.findByText('No slots available for this date')).toBeOnTheScreen()
  })
})

describe('Step 3: teams and shirts (E05-04)', () => {
  beforeEach(() => {
    const s = useBookingStore.getState()
    s.setDate(date)
    s.setTime('18:00', '20:00', 120)
  })

  it('counts sets as teams − 1 and only offers colours in stock', () => {
    show(Step3TeamsScreen, makeNav())
    expect(screen.getByText('One set for every team but one: 1 set.')).toBeOnTheScreen()
    fireEvent(screen.getByLabelText('Free shirts'), 'valueChange', true)
    expect(screen.getByLabelText('Team A: red')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Team A: green')).toBeNull()
    expect(screen.getByText('Team B plays in its own kit.')).toBeOnTheScreen()
  })

  it('says when the pitch lends no shirts (C-7)', () => {
    useBookingStore.setState({ pitch: { ...pitch, hasShirts: false, shirtStock: [] } })
    show(Step3TeamsScreen, makeNav())
    expect(screen.getByText('Teams')).toBeOnTheScreen()
    expect(
      screen.getByText("This pitch doesn't lend shirts. Bring your own bibs or colours.")
    ).toBeOnTheScreen()
    expect(screen.queryByLabelText('Free shirts')).toBeNull()
  })

  it('three teams need two sets: with three in stock that is fine', () => {
    show(Step3TeamsScreen, makeNav())
    fireEvent.press(screen.getByText('3 Teams'))
    expect(screen.getByText('One set for every team but one: 2 sets.')).toBeOnTheScreen()
    expect(screen.getByLabelText('Free shirts')).not.toBeDisabled()
  })

  it('steps players between 1 and 15', () => {
    show(Step3TeamsScreen, makeNav())
    press('More players in Team A')
    expect(useBookingStore.getState().players[0]).toBe(7)
    for (let i = 0; i < 10; i++) press('Fewer players in Team A')
    expect(useBookingStore.getState().players[0]).toBe(1)
    expect(screen.getByLabelText('Fewer players in Team A')).toBeDisabled()
  })
})

describe('Step 4: summary and payment (E05-05)', () => {
  beforeEach(() => {
    const s = useBookingStore.getState()
    s.setDate(date)
    s.setTime('18:00', '20:00', 120)
    api.paymentOptions.mockResolvedValue({
      mode: 'ONLINE',
      depositPercent: 20,
      methods: ['ONLINE'],
      trustTooLow: false,
      refundPolicy: DEFAULT_REFUND_POLICY,
      autoApproveBookings: true,
    })
  })

  it('shows the booking and pays in test mode', async () => {
    api.create.mockResolvedValue({
      bookingId: 'b1',
      reference: '#AAAAAA',
      total: 240,
      holdExpiresAt: new Date().toISOString(),
      payNow: 240,
      dueAtVenue: 0,
      payment: { provider: 'test' },
    })
    api.confirmTest.mockResolvedValue({ status: 'CONFIRMED' } as never)
    const nav = makeNav()
    show(Step4SummaryScreen, nav)
    expect(screen.getByText('18:00–20:00 (2h 00min)')).toBeOnTheScreen()
    expect(screen.getByText('2 teams · 12 players')).toBeOnTheScreen()
    expect(await screen.findByText(/Test mode\./)).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Confirm & pay 240 RON'))
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('BookingConfirmation', { bookingId: 'b1' })
    )
    expect(api.confirmTest).toHaveBeenCalledWith('b1', 'succeed')
  })

  it('explains a slot that was just taken, and stays', async () => {
    api.create.mockRejectedValue(
      new ApiError('CONFLICT', 'Someone has just booked that time', { reason: 'SLOT_CONFLICT' })
    )
    const nav = makeNav()
    show(Step4SummaryScreen, nav)
    fireEvent.press(await screen.findByText('Confirm & pay 240 RON'))
    expect(
      await screen.findByText('Someone has just booked that time. Please pick another.')
    ).toBeOnTheScreen()
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('a declined test card stays on the summary', async () => {
    api.create.mockResolvedValue({ bookingId: 'b2', payment: { provider: 'test' } } as never)
    api.confirmTest.mockResolvedValue({ status: 'CANCELLED' } as never)
    show(Step4SummaryScreen, makeNav())
    fireEvent.press(await screen.findByText('Simulate a declined card'))
    expect(await screen.findByText(/Your card was declined/)).toBeOnTheScreen()
  })

  it('pays at the venue: the deposit only, and the choice is sent (C-8)', async () => {
    api.paymentOptions.mockResolvedValue({
      mode: 'ONLINE_OR_VENUE',
      depositPercent: 20,
      methods: ['ONLINE', 'VENUE_DEPOSIT_TOWARDS', 'VENUE_REFUND_DEPOSIT'],
      trustTooLow: false,
      refundPolicy: DEFAULT_REFUND_POLICY,
      autoApproveBookings: true,
    })
    api.create.mockResolvedValue({ bookingId: 'b3', payment: { provider: 'test' } } as never)
    api.confirmTest.mockResolvedValue({ status: 'CONFIRMED' } as never)
    const nav = makeNav()
    show(Step4SummaryScreen, nav)
    expect(await screen.findByText('How do you want to pay?')).toBeOnTheScreen()
    expect(screen.getByText('Confirm & pay 240 RON')).toBeOnTheScreen()
    press(/^Pay at the venue, the deposit counts/)
    expect(screen.getByText('Pay 48 RON deposit now · 192 RON at the venue')).toBeOnTheScreen()
    press(/^Pay in full at the venue/)
    expect(
      screen.getByText('48 RON deposit now, refunded after the game · 240 RON at the venue')
    ).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Confirm & pay 48 RON deposit'))
    await waitFor(() => expect(nav.replace).toHaveBeenCalled())
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: 'VENUE_REFUND_DEPOSIT' })
    )
  })

  it('with no deposit nothing is paid online: Confirm booking (C-8)', async () => {
    api.paymentOptions.mockResolvedValue({
      mode: 'VENUE',
      depositPercent: 0,
      methods: ['VENUE_DEPOSIT_TOWARDS'],
      trustTooLow: false,
      refundPolicy: DEFAULT_REFUND_POLICY,
      autoApproveBookings: true,
    })
    api.create.mockResolvedValue({ bookingId: 'b4', payment: { provider: 'none' } } as never)
    const nav = makeNav()
    show(Step4SummaryScreen, nav)
    expect(await screen.findByText('Nothing to pay now · 240 RON at the venue')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Confirm booking'))
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('BookingConfirmation', { bookingId: 'b4' })
    )
    expect(api.confirmTest).not.toHaveBeenCalled()
  })

  it('a venue that takes payment there only says why a low-trust player cannot book (C-8)', async () => {
    api.paymentOptions.mockResolvedValue({
      mode: 'VENUE',
      depositPercent: 20,
      methods: [],
      trustTooLow: true,
      refundPolicy: DEFAULT_REFUND_POLICY,
      autoApproveBookings: true,
    })
    show(Step4SummaryScreen, makeNav())
    expect(await screen.findByText(/trust score of 70 or\s+more/)).toBeOnTheScreen()
    expect(screen.queryByText(/Confirm/)).toBeNull()
  })

  it('closing past step 1 asks first; Discard leaves', async () => {
    const nav = makeNav()
    show(Step4SummaryScreen, nav)
    press('Cancel booking')
    expect(screen.getByText('Are you sure?')).toBeOnTheScreen()
    press('Discard')
    expect(nav.parent.goBack).toHaveBeenCalled()
  })
})

describe('Step 5: confirmation (E05-06)', () => {
  it('shows the confirmed booking, then opens it or goes back to Discover', async () => {
    api.get.mockResolvedValue({
      id: 'b1',
      reference: '#B00K1D',
      status: 'CONFIRMED',
      date,
      startTime: '18:00',
      endTime: '20:00',
      minutes: 120,
      teamCount: 2,
      shirtSets: 1,
      total: 240,
      paidAt: new Date().toISOString(),
      cancellationReason: null,
      paymentMethod: 'ONLINE',
      deposit: null,
      dueAtVenue: 0,
      attendedAt: null,
      pitch: { id: 'p1', name: 'Teren 1' },
      company: { id: 'c1', name: 'Arena Gheorgheni', address: 'Str. X', city: 'Cluj-Napoca' },
    } as never)
    jest.useFakeTimers()
    const nav = makeNav()
    show(Step5ConfirmationScreen, nav, { bookingId: 'b1' })
    expect(await screen.findByText('Booking confirmed!')).toBeOnTheScreen()
    expect(screen.getByText('#B00K1D')).toBeOnTheScreen()
    expect(screen.getByText('Total paid: 240 RON')).toBeOnTheScreen()
    expect(screen.getByText('Free shirts: 1 set')).toBeOnTheScreen()
    act(() => jest.runOnlyPendingTimers())
    press('Back to Discover')
    expect(nav.parent.goBack).toHaveBeenCalled()
    press('View my booking')
    expect(nav.parent.replace).toHaveBeenCalledWith('BookingDetail', { id: 'b1' })
    jest.useRealTimers()
  })
})
