import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { SavedCard } from '@pitchup/shared'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isStripeConfigured, listCards } from '@/lib/payments/stripe'
import { paymentConfig } from '@/lib/payments'
import { PaymentMethods } from '@/components/profile/PaymentMethods'

export const metadata: Metadata = { title: 'Payment methods | PitchUp' }

/**
 * Payment methods — E08-08. The saved cards from E05-09; adding one is a
 * Stripe SetupIntent, so it needs Stripe. In test mode there is nothing to
 * save and the page says so.
 */
export default async function PaymentMethodsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fprofile%2Fpayment-methods')

  let cards: SavedCard[] = []
  if (isStripeConfigured()) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })
    if (user?.stripeCustomerId) cards = await listCards(user.stripeCustomerId)
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">Payment methods</h1>
      <PaymentMethods cards={cards} publishableKey={paymentConfig().publishableKey} />
    </>
  )
}
