/**
 * Reviews on mobile — E07-06 (My reviews) and E07-07 (the sort pills). The
 * screens render with a fake navigator and a mocked API.
 */
import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MyReview } from '@pitchup/shared'
import { bookingApi } from '../../lib/bookingApi'
import { ApiError } from '../../lib/apiClient'
import { MyReviewsScreen } from './MyReviewsScreen'
import { ReviewSortSelector } from '../../components/reviews/ReviewSortSelector'

jest.mock('../../lib/bookingApi')
const api = jest.mocked(bookingApi)

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() })

function show(navigation: ReturnType<typeof nav>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MyReviewsScreen
        navigation={navigation as never}
        route={{ key: 'k', name: 'MyReviews', params: undefined }}
      />
    </QueryClientProvider>
  )
}

const review = (over: Partial<MyReview> = {}): MyReview => ({
  id: 'r1',
  bookingId: 'b1',
  rating: 4,
  text: 'Good pitch, lights on time.',
  isAnonymous: false,
  photoUrls: [],
  isEditable: true,
  editableUntil: '2026-10-16T10:00:00.000Z',
  reply: null,
  pitch: { id: 'p1', name: 'Teren 2' },
  company: { id: 'c1', name: 'Arena Gheorgheni' },
  bookingDate: '2026-10-14',
  createdAt: '2026-10-15T10:00:00.000Z',
  ...over,
})

beforeEach(() => jest.clearAllMocks())

describe('My reviews (E07-06)', () => {
  it('shows each review with its reply; Edit only while the server allows it', async () => {
    api.myReviews.mockResolvedValue([
      review(),
      review({
        id: 'r2',
        bookingId: 'b2',
        isEditable: false,
        text: 'Nets were torn.',
        reply: { text: 'New nets are up!', createdAt: '2026-10-15T12:00:00.000Z' },
      }),
    ])
    const n = nav()
    show(n)
    expect(await screen.findByText('Good pitch, lights on time.')).toBeOnTheScreen()
    expect(screen.getAllByText('Teren 2')).toHaveLength(2)
    expect(screen.getAllByText('Played Wednesday, 14 October 2026')).toHaveLength(2)
    expect(screen.getByText('Response from the venue')).toBeOnTheScreen()
    expect(screen.getByText('New nets are up!')).toBeOnTheScreen()
    expect(screen.getAllByText('Edit')).toHaveLength(1)
    expect(screen.getAllByText('Delete')).toHaveLength(2)

    fireEvent.press(screen.getByText('Edit'))
    expect(n.navigate).toHaveBeenCalledWith('Review', { bookingId: 'b1' })
  })

  it('deletes after confirming, removing the card at once', async () => {
    api.myReviews.mockResolvedValue([review()])
    api.deleteReview.mockResolvedValue(null)
    const alert = jest.spyOn(Alert, 'alert')
    show(nav())
    fireEvent.press(await screen.findByText('Delete'))
    expect(alert).toHaveBeenCalledWith(
      'Delete this review?',
      'This cannot be undone.',
      expect.any(Array)
    )
    // The server no longer lists it once deleted.
    api.myReviews.mockResolvedValue([])
    const buttons = alert.mock.calls[0]![2]!
    buttons.find(b => b.text === 'Delete')!.onPress!()
    await waitFor(() => expect(screen.queryByText('Good pitch, lights on time.')).toBeNull())
    expect(api.deleteReview).toHaveBeenCalledWith('r1')
    expect(await screen.findByText('Review deleted')).toBeOnTheScreen()
  })

  it('puts the card back when the delete fails', async () => {
    api.myReviews.mockResolvedValue([review()])
    api.deleteReview.mockRejectedValue(new ApiError('NOT_FOUND', 'Review not found'))
    const alert = jest.spyOn(Alert, 'alert')
    show(nav())
    fireEvent.press(await screen.findByText('Delete'))
    alert.mock.calls[0]![2]!.find(b => b.text === 'Delete')!.onPress!()
    expect(await screen.findByText('Review not found')).toBeOnTheScreen()
    expect(screen.getByText('Good pitch, lights on time.')).toBeOnTheScreen()
  })

  it('says when there is nothing yet, with a way to Discover', async () => {
    api.myReviews.mockResolvedValue([])
    const n = nav()
    show(n)
    expect(await screen.findByText('No reviews yet')).toBeOnTheScreen()
    fireEvent.press(screen.getByLabelText('Find a pitch'))
    expect(n.navigate).toHaveBeenCalledWith('Discover')
  })
})

describe('review sort pills (E07-07)', () => {
  it('marks the current order and reports a new one', () => {
    const onChange = jest.fn()
    render(<ReviewSortSelector value="newest" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Newest' })).toBeSelected()
    expect(screen.getByRole('button', { name: 'Lowest' })).not.toBeSelected()
    fireEvent.press(screen.getByRole('button', { name: 'Unanswered' }))
    expect(onChange).toHaveBeenCalledWith('unanswered')
  })
})
