/**
 * Approving venues — the minimal admin step agreed for E09 (E15 builds the
 * full admin panel). An admin sees venues waiting for approval and approves
 * them (ACTIVE: public on Discover) or sends them back with a reason
 * (DRAFT again, so the manager can fix and resubmit). The manager is told by
 * email and by notification.
 */
import 'server-only'
import {
  COMPANY_STATUS_LABELS,
  COMPANY_TRANSITIONS,
  type AdminCompanyPage,
  type AdminCompanyQuery,
  type CompanyStatusUpdate,
  type PendingCompany,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { deliverSoon, notify } from '@/lib/notifications/dispatch'

export async function listPendingCompanies(): Promise<PendingCompany[]> {
  const rows = await prisma.company.findMany({
    where: { status: 'PENDING' },
    orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
    include: {
      owner: { select: { name: true, email: true } },
      _count: { select: { pitches: true } },
    },
  })
  return rows.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    logoUrl: c.logoUrl,
    websiteUrl: c.websiteUrl,
    address: [c.addressLine1, c.addressLine2, c.postalCode].filter(Boolean).join(', '),
    city: c.city ?? '',
    phone: c.phone,
    email: c.email,
    manager: { name: c.owner.name, email: c.owner.email },
    stripeConnected: !!c.stripeAccountId,
    pitchCount: c._count.pitches,
    submittedAt: c.submittedAt?.toISOString() ?? null,
  }))
}

async function pending(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { owner: { select: { id: true, email: true } } },
  })
  if (!company) throw notFound('Company not found')
  if (company.status !== 'PENDING') {
    throw new ApiException('CONFLICT', 'This venue is not waiting for approval', {
      reason: 'NOT_PENDING',
    })
  }
  return company
}

export async function approveCompany(companyId: string, now: Date = new Date()): Promise<void> {
  const company = await pending(companyId)
  await prisma.$transaction(async tx => {
    await tx.company.update({
      where: { id: companyId },
      data: { status: 'ACTIVE', reviewedAt: now, rejectionReason: null },
    })
    // The approval email is this notification's email (E13).
    await notify(tx, {
      userId: company.owner.id,
      type: 'COMPANY_APPROVED',
      title: `${company.name} is approved`,
      body: 'Your venue is live on PitchUp. Add your pitches to start taking bookings.',
      data: { companyId, companyName: company.name, link: '/manager/overview' },
    })
  })
  deliverSoon([company.owner.id])
}

export async function rejectCompany(
  companyId: string,
  reason: string,
  now: Date = new Date()
): Promise<void> {
  const company = await pending(companyId)
  await prisma.$transaction(async tx => {
    await tx.company.update({
      where: { id: companyId },
      data: { status: 'DRAFT', reviewedAt: now, rejectionReason: reason },
    })
    await notify(tx, {
      userId: company.owner.id,
      type: 'COMPANY_REJECTED',
      title: `${company.name} needs changes`,
      body: reason,
      data: { companyId, companyName: company.name, reason, link: '/onboarding' },
    })
  })
  deliverSoon([company.owner.id])
}

// ── The full venue list and status changes (E15-01, E15-02) ─────────────────

/** Every venue, newest first, filtered by status and a name or manager email. */
export async function listCompanies(query: AdminCompanyQuery): Promise<AdminCompanyPage> {
  const rows = await prisma.company.findMany({
    where: {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { owner: { email: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { pitches: { where: { deletedAt: null } } } },
    },
  })
  const more = rows.length > query.limit
  const page = rows.slice(0, query.limit)
  return {
    items: page.map(c => ({
      id: c.id,
      name: c.name,
      city: c.city,
      status: c.status,
      manager: c.owner,
      pitchCount: c._count.pitches,
      createdAt: c.createdAt.toISOString(),
      submittedAt: c.submittedAt?.toISOString() ?? null,
      hasChanges: !!c.changesSubmittedAt,
      stripeConnected: !!c.stripeAccountId,
    })),
    nextCursor: more ? page.at(-1)!.id : null,
  }
}

/**
 * Moves a venue along COMPANY_TRANSITIONS. Approving and sending back are
 * E09's; suspending takes it off Discover and stops new bookings (the
 * manager sees why); reinstating puts it back. Bookings already made stay.
 */
export async function setCompanyStatus(
  companyId: string,
  input: CompanyStatusUpdate,
  now: Date = new Date()
): Promise<{ status: string }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, status: true, ownerId: true },
  })
  if (!company) throw notFound('Company not found')
  if (!COMPANY_TRANSITIONS[company.status].includes(input.status)) {
    throw new ApiException(
      'CONFLICT',
      `A venue that is ${COMPANY_STATUS_LABELS[company.status].toLowerCase()} can't become ${COMPANY_STATUS_LABELS[input.status].toLowerCase()}`,
      { reason: 'INVALID_TRANSITION', from: company.status, to: input.status }
    )
  }
  if (company.status === 'PENDING') {
    if (input.status === 'ACTIVE') await approveCompany(companyId, now)
    else await rejectCompany(companyId, input.reason!, now)
    return { status: input.status }
  }
  const suspending = input.status === 'SUSPENDED'
  await prisma.$transaction(async tx => {
    await tx.company.update({
      where: { id: companyId },
      data: {
        status: input.status,
        suspensionReason: suspending ? input.reason! : null,
        reviewedAt: now,
      },
    })
    await notify(tx, {
      userId: company.ownerId,
      type: 'ADMIN_NOTICE',
      title: suspending ? `${company.name} is suspended` : `${company.name} is live again`,
      body: suspending
        ? `${input.reason} Players can't find or book it until PitchUp reinstates it. Bookings already made stay.`
        : 'PitchUp reinstated your venue: players can find and book it again.',
      data: { companyId, link: '/manager/overview' },
    })
  })
  deliverSoon([company.ownerId])
  return { status: input.status }
}
