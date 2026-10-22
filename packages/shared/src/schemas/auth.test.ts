import { describe, expect, it } from 'vitest'
import { LoginSchema, RegisterManagerSchema, RegisterPlayerSchema } from './auth'
import { passwordSchema, phoneSchema } from './common'
import { sharedT } from '../i18n'

const player = (patch: Record<string, unknown> = {}) =>
  RegisterPlayerSchema.safeParse({
    name: 'Ion Popescu',
    email: 'ion@example.ro',
    phone: '+40712345678',
    password: 'Parola123',
    city: 'Cluj-Napoca',
    dateOfBirth: '1995-05-05',
    ...patch,
  })

const isoYearsAgo = (years: number, days = 0) => {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - years)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('passwordSchema (PRD §6.1)', () => {
  it.each([
    ['Parola123', true],
    ['short1A', false],
    ['nouppercase1', false],
    ['NoNumberHere', false],
  ])('%s → %s', (pw, ok) => {
    expect(passwordSchema.safeParse(pw).success).toBe(ok)
  })
})

describe('phoneSchema', () => {
  it('accepts E.164 and rejects the rest', () => {
    expect(phoneSchema.safeParse('+40712345678').success).toBe(true)
    expect(phoneSchema.safeParse('0712345678').success).toBe(false)
    expect(phoneSchema.safeParse('+4040712345678').success).toBe(true) // valid shape; #174 was a client bug
  })
})

describe('RegisterPlayerSchema', () => {
  it('accepts a valid player', () => {
    expect(player().success).toBe(true)
  })
  it('accepts exactly 16 today and rejects 16 tomorrow', () => {
    expect(player({ dateOfBirth: isoYearsAgo(16) }).success).toBe(true)
    expect(player({ dateOfBirth: isoYearsAgo(16, 1) }).success).toBe(false)
  })
  it('explains a too-short name in plain words', () => {
    const r = player({ name: 'A' })
    expect(r.success).toBe(false)
    const message = r.error!.flatten().fieldErrors.name![0]!
    expect(sharedT('en').text(message)).toBe('Enter your full name')
    expect(sharedT('ro').text(message)).toBe('Introdu numele complet')
  })
})

describe('RegisterManagerSchema', () => {
  it('needs no date of birth or city', () => {
    expect(
      RegisterManagerSchema.safeParse({
        name: 'Maria Ionescu',
        email: 'maria@example.ro',
        phone: '+40712345679',
        password: 'Parola123',
      }).success
    ).toBe(true)
  })
})

describe('LoginSchema (#188)', () => {
  it('trims the email, so the same address is signed in and counted', () => {
    const r = LoginSchema.safeParse({ email: '  foo@x.ro ', password: 'x' })
    expect(r.success && r.data.email).toBe('foo@x.ro')
  })
})
