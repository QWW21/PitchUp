import { describe, expect, it } from 'vitest'
import {
  VenuePaymentSettingsSchema,
  describePayment,
  paymentMethodsFor,
  paymentSplit,
  paymentStatusLine,
} from './index'

describe('paymentMethodsFor (C-8)', () => {
  it('online-only venues offer only online payment, whatever the trust', () => {
    expect(paymentMethodsFor('ONLINE', 20, 100)).toEqual(['ONLINE'])
  })

  it('players with 70+ may pay at the venue; below that only online', () => {
    expect(paymentMethodsFor('ONLINE_OR_VENUE', 20, 70)).toEqual([
      'ONLINE',
      'VENUE_DEPOSIT_TOWARDS',
      'VENUE_REFUND_DEPOSIT',
    ])
    expect(paymentMethodsFor('ONLINE_OR_VENUE', 20, 69)).toEqual(['ONLINE'])
  })

  it('a venue-only venue: nothing for players below 70', () => {
    expect(paymentMethodsFor('VENUE', 20, 69)).toEqual([])
    expect(paymentMethodsFor('VENUE', 20, 85)).toEqual([
      'VENUE_DEPOSIT_TOWARDS',
      'VENUE_REFUND_DEPOSIT',
    ])
  })

  it('with no deposit there is one way to pay at the venue', () => {
    expect(paymentMethodsFor('VENUE', 0, 90)).toEqual(['VENUE_DEPOSIT_TOWARDS'])
  })
})

describe('paymentSplit and the words for it', () => {
  it('online: everything now', () => {
    const s = paymentSplit(270, 'ONLINE', 20)
    expect(s).toMatchObject({ payNow: 270, deposit: null, dueAtVenue: 0 })
    expect(describePayment(s, 'en')).toBe('Pay 270 RON now')
  })

  it('(b) the deposit counts: the rest at the venue', () => {
    const s = paymentSplit(270, 'VENUE_DEPOSIT_TOWARDS', 20)
    expect(s).toMatchObject({ payNow: 54, deposit: 54, dueAtVenue: 216, depositRefunded: false })
    expect(describePayment(s, 'en')).toBe('Pay 54 RON deposit now · 216 RON at the venue')
  })

  it('(a) deposit back: the full price at the venue', () => {
    const s = paymentSplit(270, 'VENUE_REFUND_DEPOSIT', 20)
    expect(s).toMatchObject({ payNow: 54, deposit: 54, dueAtVenue: 270, depositRefunded: true })
    expect(describePayment(s, 'en')).toBe(
      '54 RON deposit now, refunded after the game · 270 RON at the venue'
    )
  })

  it('no deposit: nothing now, and nothing to refund', () => {
    const s = paymentSplit(270, 'VENUE_REFUND_DEPOSIT', 0)
    expect(s).toMatchObject({ method: 'VENUE_DEPOSIT_TOWARDS', payNow: 0, dueAtVenue: 270 })
    expect(describePayment(s, 'en')).toBe('Nothing to pay now · 270 RON at the venue')
  })

  it('rounds the deposit to bani', () => {
    expect(paymentSplit(175, 'VENUE_DEPOSIT_TOWARDS', 15)).toMatchObject({
      deposit: 26.25,
      dueAtVenue: 148.75,
    })
  })
})

describe('paymentStatusLine', () => {
  const base = { total: 270, deposit: 54, dueAtVenue: 216 }
  it('says what was paid and what is still due', () => {
    expect(paymentStatusLine({ ...base, paymentMethod: 'ONLINE', deposit: null }, 'en')).toBe(
      'Total paid: 270 RON'
    )
    expect(paymentStatusLine({ ...base, paymentMethod: 'VENUE_DEPOSIT_TOWARDS' }, 'en')).toBe(
      'Deposit paid: 54 RON · To pay at the venue: 216 RON'
    )
    expect(
      paymentStatusLine({ ...base, paymentMethod: 'VENUE_REFUND_DEPOSIT', dueAtVenue: 270 }, 'en')
    ).toBe('Deposit paid: 54 RON (refunded after the game) · To pay at the venue: 270 RON')
    expect(
      paymentStatusLine(
        {
          ...base,
          paymentMethod: 'VENUE_DEPOSIT_TOWARDS',
          deposit: 0,
          dueAtVenue: 270,
        },
        'en'
      )
    ).toBe('To pay at the venue: 270 RON')
    expect(
      paymentStatusLine({ ...base, paymentMethod: 'VENUE_DEPOSIT_TOWARDS', attendedAt: 'x' }, 'en')
    ).toBe('Paid at the venue: 216 RON')
    expect(paymentStatusLine({ ...base, paymentMethod: 'VENUE_DEPOSIT_TOWARDS' }, 'ro')).toBe(
      'Avans plătit: 54 RON · De plătit la teren: 216 RON'
    )
  })
})

it('venue settings: a deposit of 0–50%', () => {
  const ok = (depositPercent: number) =>
    VenuePaymentSettingsSchema.safeParse({ paymentMode: 'VENUE', depositPercent }).success
  expect([0, 20, 50].map(ok)).toEqual([true, true, true])
  expect([-5, 55, 12.5].map(ok)).toEqual([false, false, false])
})
