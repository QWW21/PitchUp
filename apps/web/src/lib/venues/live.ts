/**
 * Which venues players see — C-15. Approved by an admin and paying for a
 * subscription (or in its free month, its grace period, or the paid end of a
 * cancelled one). Every player-facing query of venues uses this.
 */
import type { Prisma, SubscriptionStatus } from '@prisma/client'

export const LIVE_SUBSCRIPTIONS: SubscriptionStatus[] = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLING',
]

export const liveCompanyWhere = {
  status: 'ACTIVE',
  subscriptionStatus: { in: LIVE_SUBSCRIPTIONS },
} satisfies Prisma.CompanyWhereInput
