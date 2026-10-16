import { describe, expect, it } from 'vitest'
import {
  CompanyInfoSchema,
  CompanyLocationSchema,
  ContactHoursSchema,
  DEFAULT_ONBOARDING_HOURS,
  OnboardingHoursSchema,
  RejectCompanySchema,
} from './index'

const LOGO = 'https://res.cloudinary.com/pitchup/image/upload/v1/companies/a/logo.png'

describe('CompanyInfoSchema (E09-01)', () => {
  it('needs a name of 2–80 characters', () => {
    expect(CompanyInfoSchema.safeParse({ name: 'A' }).success).toBe(false)
    expect(CompanyInfoSchema.safeParse({ name: 'x'.repeat(81) }).success).toBe(false)
    expect(CompanyInfoSchema.safeParse({ name: '  Arena  ' }).data?.name).toBe('Arena')
  })

  it('treats blank and null optional fields as not given', () => {
    const r = CompanyInfoSchema.safeParse({
      name: 'Arena',
      description: '  ',
      logoUrl: null,
      websiteUrl: '',
      facebookUrl: null,
    })
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ name: 'Arena' })
  })

  it('takes full links only, and logos uploaded through PitchUp', () => {
    expect(CompanyInfoSchema.safeParse({ name: 'Arena', websiteUrl: 'arena.ro' }).success).toBe(
      false
    )
    expect(
      CompanyInfoSchema.safeParse({ name: 'Arena', logoUrl: 'https://evil.example/x.png' }).success
    ).toBe(false)
    expect(CompanyInfoSchema.safeParse({ name: 'Arena', logoUrl: LOGO }).success).toBe(true)
    expect(
      CompanyInfoSchema.safeParse({ name: 'Arena', description: 'x'.repeat(501) }).success
    ).toBe(false)
  })
})

describe('CompanyLocationSchema (E09-02)', () => {
  const base = {
    addressLine1: 'Str. Sportului 1',
    city: 'Cluj-Napoca',
    county: 'Cluj',
    postalCode: '400001',
  }

  it('accepts an address with or without a pin', () => {
    expect(CompanyLocationSchema.safeParse(base).success).toBe(true)
    expect(CompanyLocationSchema.safeParse({ ...base, lat: 46.77, lng: 23.62 }).success).toBe(true)
  })

  it('refuses a city off the list, half a pin, or a short address', () => {
    expect(CompanyLocationSchema.safeParse({ ...base, city: 'Atlantis' }).success).toBe(false)
    expect(CompanyLocationSchema.safeParse({ ...base, lat: 46.77 }).success).toBe(false)
    expect(CompanyLocationSchema.safeParse({ ...base, addressLine1: 'Str' }).success).toBe(false)
  })
})

describe('OnboardingHoursSchema (E09-03)', () => {
  it('accepts the defaults and late closing', () => {
    expect(OnboardingHoursSchema.safeParse(DEFAULT_ONBOARDING_HOURS).success).toBe(true)
    const late = DEFAULT_ONBOARDING_HOURS.map(d => (d.day === 5 ? { ...d, closeTime: '01:30' } : d))
    expect(OnboardingHoursSchema.safeParse(late).success).toBe(true)
  })

  it('needs seven different days, at least one open, and no zero-length day', () => {
    expect(OnboardingHoursSchema.safeParse(DEFAULT_ONBOARDING_HOURS.slice(1)).success).toBe(false)
    const dup = DEFAULT_ONBOARDING_HOURS.map(d => (d.day === 0 ? { ...d, day: 1 } : d))
    expect(OnboardingHoursSchema.safeParse(dup).success).toBe(false)
    const closed = DEFAULT_ONBOARDING_HOURS.map(d => ({ ...d, isClosed: true }))
    expect(OnboardingHoursSchema.safeParse(closed).success).toBe(false)
    const same = DEFAULT_ONBOARDING_HOURS.map(d => (d.day === 2 ? { ...d, closeTime: '08:00' } : d))
    const r = OnboardingHoursSchema.safeParse(same)
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual([2, 'closeTime'])
    // A closed day's times don't matter.
    const closedSame = same.map(d => (d.day === 2 ? { ...d, isClosed: true } : d))
    expect(OnboardingHoursSchema.safeParse(closedSame).success).toBe(true)
  })

  it('checks the contact details alongside', () => {
    const ok = {
      phone: '+40712000111',
      email: 'hi@arena.ro',
      workingHours: DEFAULT_ONBOARDING_HOURS,
    }
    expect(ContactHoursSchema.safeParse(ok).success).toBe(true)
    expect(ContactHoursSchema.safeParse({ ...ok, email: 'nope' }).success).toBe(false)
  })
})

describe('RejectCompanySchema', () => {
  it('needs a reason the manager can act on', () => {
    expect(RejectCompanySchema.safeParse({ reason: 'no' }).success).toBe(false)
    expect(RejectCompanySchema.safeParse({ reason: 'Add the street number.' }).success).toBe(true)
  })
})
