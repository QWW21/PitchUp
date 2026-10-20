/**
 * Component rendering with fixture data — T-08. Asserts on what a player
 * reads (text, accessibility labels and state), not on styles.
 */
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Alert } from 'react-native'
import {
  type CompanyListItem,
  type PitchDetail,
  type ReviewItem,
  type ReviewPage,
} from '@pitchup/shared'
import { CompanyCard } from './discover/CompanyCard'
import { FilterChip } from './filters/FilterChip'
import { ReviewCard } from './reviews/ReviewCard'
import { RatingBreakdown } from './reviews/RatingBreakdown'
import { AmenitiesGrid, PricingCard } from './pitch/PitchSections'
import { BookNowFooter } from './pitch/BookNowFooter'
import { SizeInfo } from './pitch/SizeInfo'
import { sharedEn } from '@pitchup/shared'

const company: CompanyListItem = {
  id: 'c1',
  name: 'Arena Gheorgheni',
  logoUrl: null,
  city: 'Cluj-Napoca',
  address: 'Str. Alexandru Vaida Voevod 50',
  lat: 46.77,
  lng: 23.63,
  avgRating: 4.7,
  reviewCount: 5,
  pitchCount: 2,
  priceFrom: 120,
  isOpenNow: true,
  distanceKm: 1.4,
  isVerified: true,
}

describe('CompanyCard', () => {
  it('shows name, open badge, rating, distance, pitches and price', () => {
    render(<CompanyCard company={company} />)
    expect(screen.getByText('Arena Gheorgheni')).toBeTruthy()
    expect(screen.getByText('OPEN')).toBeTruthy()
    expect(screen.getByText('4.7')).toBeTruthy()
    expect(screen.getByText('(5)')).toBeTruthy()
    expect(screen.getByText('1.4 km')).toBeTruthy()
    expect(screen.getByText('2 pitches')).toBeTruthy()
    expect(screen.getByText(/120 RON/)).toBeTruthy()
  })

  it('hides the badge when closed, the distance without a position, and the rating below three reviews', () => {
    render(
      <CompanyCard
        company={{
          ...company,
          isOpenNow: false,
          distanceKm: null,
          avgRating: null,
          reviewCount: 2,
          pitchCount: 1,
        }}
      />
    )
    expect(screen.queryByText('OPEN')).toBeNull()
    expect(screen.queryByText(/ km$/)).toBeNull()
    expect(screen.getByText('Not rated yet')).toBeTruthy()
    expect(screen.getByText('1 pitch')).toBeTruthy()
  })

  it('falls back to a building icon without a logo, and calls onPress', () => {
    const onPress = jest.fn()
    render(<CompanyCard company={company} onPress={onPress} />)
    expect(screen.getByTestId('icon-office-building')).toBeTruthy()
    fireEvent.press(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalled()
  })
})

describe('FilterChip', () => {
  it('reports its checked state and toggles on press', () => {
    const onPress = jest.fn()
    const { rerender } = render(<FilterChip label="Futsal" selected={false} onPress={onPress} />)
    expect(screen.getByRole('checkbox', { name: 'Futsal' })).not.toBeChecked()
    fireEvent.press(screen.getByRole('checkbox'))
    expect(onPress).toHaveBeenCalled()
    rerender(<FilterChip label="Futsal" selected onPress={onPress} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })
})

const review: ReviewItem = {
  id: 'r1',
  pitchId: 'p1',
  pitchName: 'Teren 1',
  rating: 5,
  text: 'Great surface.',
  isAnonymous: false,
  playerName: 'Demo P.',
  playerAvatarUrl: null,
  photoUrls: [],
  managerReply: 'Thanks for playing!',
  managerRepliedAt: '2026-10-02T09:00:00.000Z',
  createdAt: '2026-10-01T14:32:00.000Z',
}

describe('ReviewCard', () => {
  it("shows initials, name, date, text and the venue's reply with its date", () => {
    render(<ReviewCard review={review} />)
    expect(screen.getByText('DP')).toBeTruthy()
    expect(screen.getByText('Demo P.')).toBeTruthy()
    expect(screen.getByText('Oct 1, 2026')).toBeTruthy()
    expect(screen.getByText('Great surface.')).toBeTruthy()
    expect(screen.getByText('RESPONSE FROM THE VENUE · Oct 2, 2026')).toBeTruthy()
  })

  it('anonymous: a "?" avatar and no name', () => {
    render(<ReviewCard review={{ ...review, isAnonymous: true, playerName: 'Anonymous player' }} />)
    expect(screen.getByText('?')).toBeTruthy()
    expect(screen.getByText('Anonymous player')).toBeTruthy()
  })

  it('rating only: no text line; compact hides the reply', () => {
    render(<ReviewCard review={{ ...review, text: null }} compact />)
    expect(screen.queryByText('Great surface.')).toBeNull()
    expect(screen.queryByText('RESPONSE FROM MANAGER')).toBeNull()
    expect(screen.getByLabelText('5.0 out of 5')).toBeTruthy()
  })
})

describe('RatingBreakdown', () => {
  // The bars animate in; fake timers let the animation finish inside act().
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('shows the rating, total and a count per star', () => {
    const page: ReviewPage = {
      reviews: [],
      page: 1,
      limit: 10,
      total: 14,
      hasMore: true,
      avgRating: 4.4,
      distribution: { 5: 7, 4: 4, 3: 2, 2: 1, 1: 0 },
    }
    render(<RatingBreakdown page={page} />)
    act(() => jest.runAllTimers())
    expect(screen.getByText('4.4')).toBeTruthy()
    expect(screen.getByText('(14 reviews)')).toBeTruthy()
    for (const n of ['7', '4', '2', '1', '0'])
      expect(screen.getAllByText(n).length).toBeGreaterThan(0)
  })
})

const pitch = {
  hourlyRate: 120,
  minBookingHours: 1,
  hasShirts: true,
  shirtInventory: [
    { colour: 'BLUE', quantity: 2 },
    { colour: 'RED', quantity: 2 },
  ],
} as unknown as PitchDetail

describe('pitch sections', () => {
  it('lists all fourteen amenities, marking which are available', () => {
    render(<AmenitiesGrid amenities={[{ amenityType: 'WIFI', isPaid: false, price: null }]} />)
    expect(screen.getByLabelText('Wi-Fi, available')).toBeTruthy()
    expect(screen.getByLabelText('Referee, not available')).toBeTruthy()
    expect(screen.getAllByLabelText(/available$/)).toHaveLength(14)
  })

  it('shows one rate for any time, and free shirts with their colours', () => {
    render(<PricingCard pitch={pitch} />)
    expect(screen.getByText('Any time')).toBeTruthy()
    expect(screen.getByText(/120 RON/)).toBeTruthy()
    expect(screen.queryByText(/Peak|Off-peak/)).toBeNull()
    expect(screen.getByText(/in blue and red\. Ask for them when you book/)).toBeTruthy()
    expect(screen.queryByText(/RON\/shirt/)).toBeNull()
  })

  it('has no shirt row when the pitch lends none', () => {
    render(<PricingCard pitch={{ ...pitch, hasShirts: false, shirtInventory: [] }} />)
    expect(screen.queryByText(/Free shirts/)).toBeNull()
  })
})

describe('SizeInfo', () => {
  it('explains the size on tap, since a phone has no hover', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<SizeInfo />)
    fireEvent.press(screen.getByRole('button', { name: 'About pitch sizes' }))
    expect(alert).toHaveBeenCalledWith('Pitch size', sharedEn.size.info)
  })
})

describe('BookNowFooter', () => {
  it('books when allowed', () => {
    const onBook = jest.fn()
    render(<BookNowFooter hourlyRate={120} block={null} onBook={onBook} />)
    fireEvent.press(screen.getByRole('button', { name: 'Book Now' }))
    expect(onBook).toHaveBeenCalled()
  })

  it.each([
    ['unavailable', 'Not available'],
    ['restricted', 'Account restricted'],
  ] as const)('%s: says "%s" and does nothing on press', (block, label) => {
    const onBook = jest.fn()
    render(<BookNowFooter hourlyRate={120} block={block} onBook={onBook} />)
    expect(screen.getByText(label)).toBeTruthy()
    fireEvent.press(screen.getByRole('button'))
    expect(onBook).not.toHaveBeenCalled()
  })
})
