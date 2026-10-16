/**
 * Approving venues — the minimal admin step agreed for E09 (E15 builds the
 * full admin panel). An admin sees venues waiting for approval and approves
 * them (ACTIVE: public on Discover) or sends them back with a reason
 * (DRAFT again, so the manager can fix and resubmit). The manager is told by
 * email and by notification.
 */
import 'server-only'
import type { PendingCompany } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { ApiException, notFound } from '@/lib/api/errors'
import { getEmailProvider } from '@/lib/notifications'
import { renderCompanyApprovedEmail, renderCompanyRejectedEmail } from '@/lib/emails/company'

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

const appUrl = () => env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')

async function tell(to: string, email: { subject: string; html: string; text: string }) {
  // Best-effort: the decision stands even if the email does not go out.
  try {
    await getEmailProvider().send({ to, ...email })
  } catch (caught) {
    console.error('[admin] Could not email the manager:', caught)
  }
}

export async function approveCompany(companyId: string, now: Date = new Date()): Promise<void> {
  const company = await pending(companyId)
  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { status: 'ACTIVE', reviewedAt: now, rejectionReason: null },
    }),
    prisma.notification.create({
      data: {
        userId: company.owner.id,
        type: 'COMPANY_APPROVED',
        title: `${company.name} is approved`,
        body: 'Your venue is live on PitchUp. Add your pitches to start taking bookings.',
        data: { companyId },
      },
    }),
  ])
  await tell(
    company.owner.email,
    renderCompanyApprovedEmail(company.name, `${appUrl()}/manager/overview`)
  )
}

export async function rejectCompany(
  companyId: string,
  reason: string,
  now: Date = new Date()
): Promise<void> {
  const company = await pending(companyId)
  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { status: 'DRAFT', reviewedAt: now, rejectionReason: reason },
    }),
    prisma.notification.create({
      data: {
        userId: company.owner.id,
        type: 'COMPANY_REJECTED',
        title: `${company.name} needs changes`,
        body: reason,
        data: { companyId },
      },
    }),
  ])
  await tell(
    company.owner.email,
    renderCompanyRejectedEmail(company.name, reason, `${appUrl()}/onboarding`)
  )
}
