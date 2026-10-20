/**
 * Payouts — E09-04, PRD §8.6. Each venue gets a Stripe Express account;
 * Stripe's hosted pages collect identity and bank details (PitchUp never
 * sees them). Coming back with the details submitted sends the venue for
 * approval.
 *
 * Without Stripe keys (development, CI) a built-in stand-in does the same
 * in one click: a `test_acct_…` account that counts as submitted.
 */
import 'server-only'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { ApiException } from '@/lib/api/errors'
import { isStripeConfigured, stripe } from '@/lib/payments/stripe'
import { readyForPayouts, submitForApproval } from './company'

const appUrl = () => env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
export const RETURN_PATH = '/api/v1/onboarding/stripe-connect/return'
export const REFRESH_PATH = '/onboarding/stripe-connect/refresh'

/** Where to send the manager to set up payouts (a Stripe page, or our own return in test mode). */
export async function startConnect(user: { id: string; email: string }): Promise<{ url: string }> {
  const company = await readyForPayouts(user.id)

  if (!isStripeConfigured()) {
    if (!company.stripeAccountId) {
      await prisma.company.update({
        where: { id: company.id },
        data: { stripeAccountId: `test_acct_${randomBytes(8).toString('hex')}` },
      })
    }
    return { url: `${appUrl()}${RETURN_PATH}` }
  }

  let accountId = company.stripeAccountId
  if (!accountId) {
    try {
      const account = await stripe().accounts.create({
        type: 'express',
        country: 'RO',
        email: user.email,
        business_profile: { name: company.name },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { companyId: company.id, managerId: user.id },
      })
      accountId = account.id
    } catch (caught) {
      console.error('[onboarding] Stripe account creation failed:', (caught as Error).message)
      throw new ApiException('SERVICE_UNAVAILABLE', 'api.stripeDown')
    }
    // Stored at once, so a retry reuses the same account.
    await prisma.company.update({ where: { id: company.id }, data: { stripeAccountId: accountId } })
  }
  const link = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl()}${REFRESH_PATH}`,
    // No company id in the URL: the return handler reads the signed-in manager's own.
    return_url: `${appUrl()}${RETURN_PATH}`,
    type: 'account_onboarding',
  })
  return { url: link.url }
}

/**
 * Back from Stripe. Submitted details send the venue for approval; an
 * abandoned form goes back to step 4. Returns where to send the browser.
 */
export async function finishConnect(ownerId: string): Promise<string> {
  const company = await prisma.company.findUnique({ where: { ownerId } })
  if (!company?.stripeAccountId) return '/onboarding/step/4'
  if (company.status === 'ACTIVE') return '/manager/overview'
  if (company.status !== 'DRAFT') return '/onboarding/pending'

  let submitted = company.stripeAccountId.startsWith('test_acct_')
  if (!submitted && isStripeConfigured()) {
    const account = await stripe().accounts.retrieve(company.stripeAccountId)
    submitted = account.details_submitted === true
    await prisma.company.update({
      where: { id: company.id },
      data: {
        stripeChargesEnabled: account.charges_enabled === true,
        stripePayoutsEnabled: account.payouts_enabled === true,
      },
    })
  }
  if (!submitted) return `${REFRESH_PATH}`
  await submitForApproval(company.id)
  return '/onboarding/pending'
}
