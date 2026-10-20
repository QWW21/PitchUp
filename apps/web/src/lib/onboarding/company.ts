/**
 * Manager onboarding — E09-01 … E09-05, PRD §8.1.
 *
 * One company per manager (`Company.ownerId` is unique). It is created by
 * step 1 as DRAFT, filled in by steps 2 and 3, and submitted by step 4
 * (Stripe Connect), which makes it PENDING until an admin approves it.
 * Steps can be redone while DRAFT or PENDING; an approved venue's details
 * are changed from Settings, and an admin approves them again (C-13,
 * lib/manager/venue.ts).
 */
import 'server-only'
import { Prisma, type Company } from '@prisma/client'
import type {
  CompanyInfoInput,
  CompanyLocationInput,
  ContactHoursInput,
  OnboardingStatus,
  OnboardingStep,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { ApiException, notFound } from '@/lib/api/errors'
import { deliverSoon, notify } from '@/lib/notifications/dispatch'

export const managerCompany = (ownerId: string) => prisma.company.findUnique({ where: { ownerId } })

/** Which steps are done, from what the company row holds. */
export function onboardingStatus(company: Company | null): OnboardingStatus {
  if (!company) {
    return {
      companyId: null,
      companyStatus: null,
      completedSteps: [],
      stripeConnected: false,
      currentStep: 1,
      rejectionReason: null,
    }
  }
  const done: OnboardingStep[] = []
  if (company.name) done.push('info')
  if (company.addressLine1 && company.city) done.push('location')
  if (company.phone && company.email && company.workingHours) done.push('contact-hours')
  // Submitted, or approved (the seeded venues predate onboarding): past step 4.
  if (company.status !== 'DRAFT') done.push('stripe')
  const steps: OnboardingStep[] = ['info', 'location', 'contact-hours', 'stripe']
  const next = steps.findIndex(s => !done.includes(s))
  return {
    companyId: company.id,
    companyStatus: company.status,
    completedSteps: done,
    stripeConnected: !!company.stripeAccountId,
    currentStep: next === -1 ? null : ((next + 1) as 1 | 2 | 3 | 4),
    rejectionReason: company.rejectionReason,
  }
}

/** The manager's company, if they may still change it through onboarding. */
async function editable(ownerId: string): Promise<Company> {
  const company = await managerCompany(ownerId)
  if (!company) {
    throw new ApiException('VALIDATION_ERROR', 'api.startWithCompany', {
      reason: 'NO_COMPANY',
    })
  }
  if (company.status !== 'DRAFT' && company.status !== 'PENDING') {
    throw new ApiException('CONFLICT', 'api.alreadyApproved', {
      reason: 'ALREADY_ACTIVE',
    })
  }
  return company
}

const orNull = (v: string | undefined) => v ?? null

/** Step 1: creates the company on the first call, updates it afterwards. */
export async function saveInfo(
  ownerId: string,
  input: CompanyInfoInput
): Promise<{ id: string; created: boolean }> {
  const data = {
    name: input.name,
    description: orNull(input.description),
    logoUrl: orNull(input.logoUrl),
    websiteUrl: orNull(input.websiteUrl),
    facebookUrl: orNull(input.facebookUrl),
    instagramUrl: orNull(input.instagramUrl),
  }
  const existing = await managerCompany(ownerId)
  if (existing) {
    await editable(ownerId)
    await prisma.company.update({ where: { id: existing.id }, data })
    return { id: existing.id, created: false }
  }
  try {
    const company = await prisma.company.create({
      data: { ...data, ownerId, status: 'DRAFT' },
      select: { id: true },
    })
    return { id: company.id, created: true }
  } catch (caught) {
    // Two first submits at once: the unique owner wins once.
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002') {
      throw new ApiException('CONFLICT', 'api.hasCompany', { reason: 'COMPANY_EXISTS' })
    }
    throw caught
  }
}

/**
 * Turns an address into coordinates with Google's Geocoding API, when a
 * server key is set. Null when it cannot (no key, no result, an error):
 * the address is still saved.
 */
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!env.GOOGLE_MAPS_API_KEY) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?region=ro&address=${encodeURIComponent(address)}&key=${env.GOOGLE_MAPS_API_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    const data = (await res.json()) as {
      status: string
      results?: { geometry: { location: { lat: number; lng: number } } }[]
    }
    // Only the status is logged: the response repeats the address.
    if (data.status !== 'OK' || !data.results?.[0]) {
      console.warn(`[onboarding] geocoding returned ${data.status}`)
      return null
    }
    return data.results[0].geometry.location
  } catch {
    console.warn('[onboarding] geocoding failed')
    return null
  }
}

/** Step 2. The pin's coordinates win; otherwise the server geocodes. */
export async function saveLocation(
  ownerId: string,
  input: CompanyLocationInput
): Promise<{ id: string; lat: number | null; lng: number | null; geocoded: boolean }> {
  const company = await editable(ownerId)
  const pinned = input.lat !== undefined && input.lng !== undefined
  const coords = pinned
    ? { lat: input.lat!, lng: input.lng! }
    : await geocode(`${input.addressLine1}, ${input.city}, Romania`)
  await prisma.company.update({
    where: { id: company.id },
    data: {
      addressLine1: input.addressLine1,
      addressLine2: orNull(input.addressLine2),
      city: input.city,
      county: input.county,
      postalCode: input.postalCode,
      country: 'RO',
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    },
  })
  return {
    id: company.id,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    geocoded: !!coords,
  }
}

/** Step 3. */
export async function saveContactHours(
  ownerId: string,
  input: ContactHoursInput
): Promise<{ id: string; phone: string; email: string }> {
  const company = await editable(ownerId)
  await prisma.company.update({
    where: { id: company.id },
    data: {
      phone: input.phone,
      email: input.email,
      workingHours: [...input.workingHours].sort((a, b) => a.day - b.day),
    },
  })
  return { id: company.id, phone: input.phone, email: input.email }
}

/** Steps 1–3 must be done before payouts and submission. */
export async function readyForPayouts(ownerId: string): Promise<Company> {
  const company = await editable(ownerId)
  const status = onboardingStatus(company)
  const missing = (['info', 'location', 'contact-hours'] as const).filter(
    s => !status.completedSteps.includes(s)
  )
  if (missing.length) {
    throw new ApiException('VALIDATION_ERROR', 'api.earlierSteps', {
      reason: 'STEPS_INCOMPLETE',
      missing,
    })
  }
  return company
}

/**
 * Hands the venue to the admins: PENDING, and each admin gets a
 * COMPANY_SUBMITTED notification. Doing it twice changes nothing.
 */
export async function submitForApproval(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) throw notFound('api.companyNotFound')
  if (company.status !== 'DRAFT') return
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', deletedAt: null },
    select: { id: true },
  })
  await prisma.$transaction(async tx => {
    await tx.company.update({
      where: { id: companyId },
      data: { status: 'PENDING', submittedAt: new Date(), rejectionReason: null },
    })
    for (const a of admins) {
      await notify(tx, {
        userId: a.id,
        type: 'COMPANY_SUBMITTED',
        title: t => t('notify.venueSubmitted.title'),
        body: t => t('notify.venueSubmitted.body', { company: company.name }),
        data: { companyId, link: '/admin/companies' },
      })
    }
  })
  deliverSoon(admins.map(a => a.id))
}
