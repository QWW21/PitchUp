/**
 * What was charged by card for a booking: the price when paid online, the
 * deposit when paid at the venue (C-8). Refunds are taken from this.
 */
import type { Prisma } from '@prisma/client'

export const chargedOnline = (b: {
  paymentMethod: string
  depositAmount: Prisma.Decimal | null
  totalAmount: Prisma.Decimal
}): number => Number(b.paymentMethod === 'ONLINE' ? b.totalAmount : (b.depositAmount ?? 0))
