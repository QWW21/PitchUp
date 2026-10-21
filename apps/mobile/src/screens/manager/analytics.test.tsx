/**
 * A venue's analytics on the phone — E14-10. managerApi mocked.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AnalyticsRevenue, AnalyticsSummary } from '@pitchup/shared'
import { managerApi } from '../../lib/managerApi'
import { ManagerAnalyticsScreen } from './ManagerAnalyticsScreen'
import { ManagerPitchPerformanceScreen } from './ManagerPitchPerformanceScreen'

jest.mock('../../lib/managerApi')
const api = jest.mocked(managerApi)

const summary = (over: Partial<AnalyticsSummary> = {}): AnalyticsSummary => ({
  period: '30d',
  revenue: { value: 4275, change: 12, online: 3000, atVenue: 1275 },
  bookings: { value: 38, change: -5 },
  occupancy: { value: 67, change: 4 },
  avgRating: { value: 4.3, change: null },
  noShowRate: { value: 3, change: -1 },
  ...over,
})

const revenue: AnalyticsRevenue = {
  period: '30d',
  groupBy: 'day',
  data: [
    {
      period: '2026-11-01',
      gross: 300,
      online: 300,
      atVenue: 0,
      fees: 24,
      payout: 276,
      bookings: 2,
    },
    { period: '2026-11-02', gross: 0, online: 0, atVenue: 0, fees: 0, payout: 0, bookings: 0 },
  ],
}

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
  api.analyticsSummary.mockResolvedValue(summary())
  api.analyticsRevenue.mockResolvedValue(revenue)
})

describe('Venue analytics (E14-10)', () => {
  it('shows the five figures, each against the previous period', async () => {
    show(ManagerAnalyticsScreen)
    expect(await screen.findByText('4,275 RON')).toBeOnTheScreen()
    expect(screen.getByLabelText('Revenue: 4,275 RON. ↑ 12% vs before')).toBeOnTheScreen()
    expect(screen.getByLabelText('Average rating: ★ 4.3. No earlier data')).toBeOnTheScreen()
    expect(screen.getByText('3,000 RON online · 1,275 RON at the venue')).toBeOnTheScreen()
  })

  it('a period chip asks again for that period', async () => {
    show(ManagerAnalyticsScreen)
    await screen.findByText('4,275 RON')
    fireEvent.press(screen.getByText('7 days'))
    await waitFor(() => expect(api.analyticsSummary).toHaveBeenCalledWith('7d'))
    expect(api.analyticsRevenue).toHaveBeenCalledWith('7d')
  })

  it('tapping a bar shows its figures', async () => {
    show(ManagerAnalyticsScreen)
    fireEvent.press(await screen.findByLabelText('1 Nov: 300 RON'))
    expect(screen.getByText('1 Nov: 300 RON, 2 bookings')).toBeOnTheScreen()
  })

  it('opens pitch performance for the same period', async () => {
    const nav = show(ManagerAnalyticsScreen)
    fireEvent.press(await screen.findByText('Pitch performance'))
    expect(nav.navigate).toHaveBeenCalledWith('ManagerPitchPerformance', { period: '30d' })
  })

  it('pitch performance lists each pitch, highest revenue first', async () => {
    const row = {
      isActive: true,
      completedBookings: 1,
      occupancy: 40,
      cancellationRate: 0,
      noShowRate: 0,
      avgRating: null,
      reviewCount: 0,
    }
    api.analyticsPitches.mockResolvedValue([
      { ...row, pitchId: 'a', name: 'Teren Mic', revenue: 100, totalBookings: 1 },
      { ...row, pitchId: 'b', name: 'Teren Mare', revenue: 900, totalBookings: 4, isActive: false },
    ])
    show(ManagerPitchPerformanceScreen, { period: '90d' })
    expect(await screen.findByText('Teren Mare (inactive)')).toBeOnTheScreen()
    expect(screen.getByText('Last 90 days')).toBeOnTheScreen()
    const names = screen
      .getAllByText(/^Teren/)
      .map(n => n.props.children.join?.('') ?? n.props.children)
    expect(names[0]).toContain('Teren Mare')
  })
})
