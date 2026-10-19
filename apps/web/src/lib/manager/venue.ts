/**
 * A venue's settings after approval — C-10, C-13.
 *
 * - Booking settings take effect at once: approving bookings automatically
 *   or by hand, and the refund policy (bookings keep the one they were made
 *   under).
 * - The venue's details (what players see: name, description, logo, links,
 *   address, contact and opening hours) are proposed, not saved: an admin
 *   approves them first, and the live page keeps the approved details
 *   meanwhile. Proposing a section again replaces that section; the manager
 *   can withdraw everything waiting.
 */
import 'server-only'
import { Prisma, type Company } from '@prisma/client'
import {
  DAY_SHORT,
  normalizeWeek,
  type CompanyInfoInput,
  type CompanyLocationInput,
  type ContactHoursInput,
  type PendingVenueChange,
  type VenueBookingSettings,
  type VenueBookingSettingsInput,
  type VenueChangeLine,
  type VenueChangesStatus,
  type VenueProfileChanges,
  type VenueProfileSection,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { deliverSoon, notify } from '@/lib/notifications/dispatch'
import { geocode } from '@/lib/onboarding/company'

// ── Booking settings (C-10, C-13) ──────────────────────────────────────────

export const bookingSettingsOf = (c: Company): VenueBookingSettings => ({
  autoApproveBookings: c.autoApproveBookings,
  refundPolicy: {
    fullRefundHours: c.refundFullHours,
    partialRefundHours: c.refundPartialHours,
    partialRefundPercent: c.refundPartialPercent,
  },
})

export async function saveBookingSettings(
  companyId: string,
  input: VenueBookingSettingsInput
): Promise<VenueBookingSettings> {
  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      ...(input.autoApproveBookings !== undefined
        ? { autoApproveBookings: input.autoApproveBookings }
        : {}),
      ...(input.refundPolicy
        ? {
            refundFullHours: input.refundPolicy.fullRefundHours,
            refundPartialHours: input.refundPolicy.partialRefundHours,
            refundPartialPercent: input.refundPolicy.partialRefundPercent,
          }
        : {}),
    },
  })
  return bookingSettingsOf(updated)
}

// ── The venue's details, approved again (C-13) ─────────────────────────────

const pendingOf = (c: Company): VenueProfileChanges =>
  (c.pendingChanges as VenueProfileChanges | null) ?? {}

export const venueChangesStatus = (c: Company): VenueChangesStatus => ({
  pending: Object.keys(pendingOf(c)) as VenueProfileSection[],
  submittedAt: c.changesSubmittedAt?.toISOString() ?? null,
  rejectionReason: c.changesRejectionReason,
})

type Proposal =
  | { section: 'info'; input: CompanyInfoInput }
  | { section: 'location'; input: CompanyLocationInput }
  | { section: 'contactHours'; input: ContactHoursInput }

/** Adds a section to what waits for an admin, and tells the admins. */
export async function proposeVenueChange(
  company: Company,
  proposal: Proposal,
  now: Date = new Date()
): Promise<VenueChangesStatus> {
  let value: VenueProfileChanges[VenueProfileSection]
  if (proposal.section === 'location') {
    const pinned = proposal.input.lat !== undefined && proposal.input.lng !== undefined
    const coords = pinned
      ? { lat: proposal.input.lat!, lng: proposal.input.lng! }
      : await geocode(`${proposal.input.addressLine1}, ${proposal.input.city}, Romania`)
    value = { ...proposal.input, lat: coords?.lat ?? null, lng: coords?.lng ?? null }
  } else if (proposal.section === 'contactHours') {
    value = {
      ...proposal.input,
      workingHours: [...proposal.input.workingHours].sort((a, b) => a.day - b.day),
    }
  } else {
    value = proposal.input
  }
  const changes = { ...pendingOf(company), [proposal.section]: value }
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', deletedAt: null },
    select: { id: true },
  })
  const updated = await prisma.$transaction(async tx => {
    const c = await tx.company.update({
      where: { id: company.id },
      data: {
        pendingChanges: changes as Prisma.InputJsonValue,
        changesSubmittedAt: now,
        changesRejectionReason: null,
      },
    })
    for (const a of admins) {
      await notify(tx, {
        userId: a.id,
        type: 'COMPANY_SUBMITTED',
        title: 'Venue changes to review',
        body: `${company.name} changed its details. They show once you approve them.`,
        data: { companyId: company.id, link: '/admin/companies' },
      })
    }
    return c
  })
  deliverSoon(admins.map(a => a.id))
  return venueChangesStatus(updated)
}

/** The manager takes back everything waiting. */
export async function withdrawVenueChanges(companyId: string): Promise<VenueChangesStatus> {
  const updated = await prisma.company.update({
    where: { id: companyId },
    data: { pendingChanges: Prisma.DbNull, changesSubmittedAt: null },
  })
  return venueChangesStatus(updated)
}

// ── The admin's side ────────────────────────────────────────────────────────

const text = (v: string | null | undefined) => (v && v.trim() ? v : '—')

const hoursText = (hours: unknown) =>
  normalizeWeek(hours)
    .map(d => `${DAY_SHORT[d.day]} ${d.isClosed ? 'closed' : `${d.openTime}–${d.closeTime}`}`)
    .join(', ')

const addressText = (a: {
  addressLine1: string | null
  addressLine2?: string | null | undefined
  postalCode?: string | null | undefined
  city: string | null
  county?: string | null | undefined
}) =>
  [a.addressLine1, a.addressLine2, a.postalCode, a.city, a.county].filter(Boolean).join(', ') || '—'

const pinText = (lat: number | null | undefined, lng: number | null | undefined) =>
  lat == null || lng == null ? 'none' : `${lat.toFixed(5)}, ${lng.toFixed(5)}`

/** What would change, field by field; unchanged fields are left out. */
export function changeLines(c: Company): VenueChangeLine[] {
  const p = pendingOf(c)
  const lines: VenueChangeLine[] = []
  const line = (field: string, before: string, after: string) => {
    if (before !== after) lines.push({ field, before, after })
  }
  if (p.info) {
    line('Name', c.name, p.info.name)
    line('Description', text(c.description), text(p.info.description))
    if ((c.logoUrl ?? '') !== (p.info.logoUrl ?? '')) {
      lines.push({
        field: 'Logo',
        before: c.logoUrl ? 'current logo' : 'none',
        after: p.info.logoUrl ? 'a new logo' : 'removed',
      })
    }
    line('Website', text(c.websiteUrl), text(p.info.websiteUrl))
    line('Facebook', text(c.facebookUrl), text(p.info.facebookUrl))
    line('Instagram', text(c.instagramUrl), text(p.info.instagramUrl))
  }
  if (p.location) {
    line('Address', addressText(c), addressText(p.location))
    line('Map pin', pinText(c.lat, c.lng), pinText(p.location.lat, p.location.lng))
  }
  if (p.contactHours) {
    line('Phone', text(c.phone), p.contactHours.phone)
    line('Email', text(c.email), p.contactHours.email)
    line('Opening hours', hoursText(c.workingHours), hoursText(p.contactHours.workingHours))
  }
  return lines
}

export async function listVenueChanges(): Promise<PendingVenueChange[]> {
  const rows = await prisma.company.findMany({
    where: { status: 'ACTIVE', changesSubmittedAt: { not: null } },
    orderBy: { changesSubmittedAt: 'asc' },
    include: { owner: { select: { name: true, email: true } } },
  })
  return rows
    .filter(c => Object.keys(pendingOf(c)).length > 0)
    .map(c => ({
      companyId: c.id,
      companyName: c.name,
      manager: { name: c.owner.name, email: c.owner.email },
      submittedAt: c.changesSubmittedAt!.toISOString(),
      lines: changeLines(c),
    }))
}

async function withChanges(companyId: string) {
  const c = await prisma.company.findUnique({ where: { id: companyId } })
  if (!c) throw notFound('Company not found')
  if (!c.changesSubmittedAt || !Object.keys(pendingOf(c)).length) {
    throw new ApiException('CONFLICT', 'This venue has no changes waiting', {
      reason: 'NO_CHANGES',
    })
  }
  return c
}

const orNull = (v: string | undefined) => v ?? null

export async function approveVenueChanges(companyId: string, now: Date = new Date()) {
  const c = await withChanges(companyId)
  const p = pendingOf(c)
  await prisma.$transaction(async tx => {
    await tx.company.update({
      where: { id: c.id },
      data: {
        ...(p.info
          ? {
              name: p.info.name,
              description: orNull(p.info.description),
              logoUrl: orNull(p.info.logoUrl),
              websiteUrl: orNull(p.info.websiteUrl),
              facebookUrl: orNull(p.info.facebookUrl),
              instagramUrl: orNull(p.info.instagramUrl),
            }
          : {}),
        ...(p.location
          ? {
              addressLine1: p.location.addressLine1,
              addressLine2: orNull(p.location.addressLine2),
              city: p.location.city,
              county: p.location.county,
              postalCode: p.location.postalCode,
              lat: p.location.lat,
              lng: p.location.lng,
            }
          : {}),
        ...(p.contactHours
          ? {
              phone: p.contactHours.phone,
              email: p.contactHours.email,
              workingHours: p.contactHours.workingHours,
            }
          : {}),
        pendingChanges: Prisma.DbNull,
        changesSubmittedAt: null,
        changesRejectionReason: null,
        reviewedAt: now,
      },
    })
    await notify(tx, {
      userId: c.ownerId,
      type: 'COMPANY_APPROVED',
      title: 'Your changes are live',
      body: `PitchUp approved the new details of ${p.info?.name ?? c.name}; players see them now.`,
      data: { companyId: c.id, link: '/manager/settings' },
    })
  })
  deliverSoon([c.ownerId])
}

export async function rejectVenueChanges(
  companyId: string,
  reason: string,
  now: Date = new Date()
) {
  const c = await withChanges(companyId)
  await prisma.$transaction(async tx => {
    await tx.company.update({
      where: { id: c.id },
      data: {
        pendingChanges: Prisma.DbNull,
        changesSubmittedAt: null,
        changesRejectionReason: reason,
        reviewedAt: now,
      },
    })
    await notify(tx, {
      userId: c.ownerId,
      type: 'COMPANY_REJECTED',
      title: 'Your changes were not approved',
      body: `${reason} Your page keeps its current details; you can send new changes in Settings.`,
      data: { companyId: c.id, reason, link: '/manager/settings' },
    })
  })
  deliverSoon([c.ownerId])
}
