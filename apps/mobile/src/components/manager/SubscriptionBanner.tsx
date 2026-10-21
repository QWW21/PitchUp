/**
 * The venue isn't live, or soon won't be — C-15: not subscribed, a free
 * month without a card, a failed payment, or paused. The subscription is
 * managed on the web, so the banner says where. Nothing while all is well.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { formatDateLong } from '@pitchup/shared'
import { managerApi } from '../../lib/managerApi'
import { colors, spacing } from '../../theme/tokens'
import { useLocale, useT } from '../../i18n'

export function SubscriptionBanner() {
  const t = useT()
  const locale = useLocale()
  const billing = useQuery({
    queryKey: ['manager-billing'],
    queryFn: managerApi.billing,
    staleTime: 5 * 60_000,
  })
  const b = billing.data
  if (!b) return null
  const date = (iso: string | null) => (iso ? formatDateLong(iso.slice(0, 10), locale) : '')
  const message =
    b.status === 'NONE'
      ? t('manager.subscription.NONE')
      : b.status === 'PAUSED'
        ? t('manager.subscription.PAUSED')
        : b.status === 'PAST_DUE'
          ? t('manager.subscription.PAST_DUE', { date: date(b.pauseOn) })
          : b.status === 'TRIALING' && !b.interval
            ? t('manager.subscription.trialNoCard', { date: date(b.trialEndsAt) })
            : null
  if (!message) return null
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>{message}</Text>
      <Text style={styles.web}>{t('manager.subscription.onWeb')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning[500],
    backgroundColor: colors.warning[50],
    gap: 4,
  },
  text: { fontSize: 14, color: colors.neutral[900] },
  web: { fontSize: 13, color: colors.neutral[700] },
})
