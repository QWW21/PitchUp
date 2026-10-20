/**
 * One booking in My Bookings — E06-06 (UIUX_SPEC §8.1).
 */
import React, { useEffect, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import {
  formatCountdown,
  formatDateLong,
  type BookingListItem,
  type BookingStatus,
} from '@pitchup/shared'
import { colors, spacing } from '../../theme/tokens'
import { useLocale, useT } from '../../i18n'

const BADGE: Record<BookingStatus, { bg: string; fg: string }> = {
  CONFIRMED: { bg: colors.primary[50], fg: colors.primary[700] },
  PENDING: { bg: colors.warning[50], fg: '#92400E' },
  AWAITING_APPROVAL: { bg: colors.warning[50], fg: '#92400E' },
  COMPLETED: { bg: colors.primary[50], fg: colors.primary[700] },
  NO_SHOW: { bg: colors.error[50], fg: colors.error[600] },
  CANCELLED: { bg: colors.neutral[100], fg: colors.neutral[700] },
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const t = useT()
  const b = BADGE[status]
  return (
    <View style={[styles.badge, { backgroundColor: b.bg }]}>
      <Text style={[styles.badgeText, { color: b.fg }]}>{t(`bookings.badge.${status}`)}</Text>
    </View>
  )
}

/** "Starts in 3h 20min", within 24 hours of kick-off; ticks every minute. */
export function CountdownChip({ startsAt }: { startsAt: string }) {
  const t = useT()
  const locale = useLocale()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const start = new Date(startsAt)
  if (start.getTime() - now.getTime() > 24 * 3_600_000) return null
  const text = formatCountdown(start, locale, now)
  return (
    <View style={styles.chip}>
      <Icon name="clock-fast" size={14} color={colors.warning[500]} />
      <Text style={styles.chipText}>
        {text === t('duration.countdownNow') ? text : t('bookings.startsIn', { time: text })}
      </Text>
    </View>
  )
}

interface Props {
  booking: BookingListItem
  onPress: () => void
  onReview: () => void
  onRebook: () => void
}

export function BookingCard({ booking: b, onPress, onReview, onRebook }: Props) {
  const t = useT()
  const locale = useLocale()
  const upcoming = b.status === 'CONFIRMED' || b.status === 'PENDING'
  const past = b.status === 'COMPLETED' || b.status === 'NO_SHOW'
  // The card and its buttons are siblings: a screen reader cannot reach a
  // button nested inside another accessible button.
  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress}
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={t('bookings.card.label', {
          pitch: b.pitch.name,
          venue: b.company.name,
          date: formatDateLong(b.date, locale),
          start: b.startTime,
          end: b.endTime,
          status: t(`bookings.badge.${b.status}`),
        })}
      >
        <View style={styles.row}>
          {b.company.logoUrl ? (
            <Image source={{ uri: b.company.logoUrl }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoEmpty]}>
              <Icon name="office-building" size={20} color={colors.neutral[400]} />
            </View>
          )}
          <View style={styles.flex}>
            <Text style={styles.company} numberOfLines={1}>
              {b.company.name}
            </Text>
            <Text style={styles.pitch} numberOfLines={1}>
              {b.pitch.name}
            </Text>
          </View>
          {b.status !== 'CANCELLED' ? <StatusBadge status={b.status} /> : null}
        </View>

        <View style={styles.line}>
          <Icon name="calendar" size={16} color={colors.neutral[400]} />
          <Text style={styles.body}>{formatDateLong(b.date, locale)}</Text>
        </View>
        <View style={styles.line}>
          <Icon name="clock-outline" size={16} color={colors.neutral[400]} />
          <Text style={styles.body}>
            {b.startTime}–{b.endTime}
          </Text>
        </View>

        {upcoming ? <CountdownChip startsAt={b.startsAt} /> : null}
        {b.status === 'CONFIRMED' && b.dueAtVenue > 0 ? (
          <Text style={styles.due}>{t('bookings.card.due', { amount: b.dueAtVenue })}</Text>
        ) : null}

        {b.status === 'CANCELLED' ? (
          <View style={styles.line}>
            <Text style={styles.italic}>
              {t(`bookings.cancelledBy.${b.cancelledBy ?? 'SYSTEM'}`)}
            </Text>
            {b.refundAmount ? (
              <Text style={styles.refund}>
                {t('bookings.card.refund', { amount: b.refundAmount })}
              </Text>
            ) : (
              <Text style={styles.muted}>{t('bookings.card.noRefund')}</Text>
            )}
          </View>
        ) : null}
      </Pressable>

      {past ? (
        <View style={styles.actions}>
          {b.canReview ? (
            <Pressable onPress={onReview} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>{t('bookings.card.review')}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable onPress={onRebook} style={styles.ghost} accessibilityRole="button">
            <Text style={styles.ghostText}>{t('bookings.card.rebook')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  main: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  logo: { width: 40, height: 40, borderRadius: 6 },
  logoEmpty: {
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  company: { fontSize: 13, fontWeight: '500', color: colors.neutral[700] },
  pitch: { fontSize: 16, fontWeight: '600', color: colors.neutral[900] },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '500' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: { fontSize: 15, color: colors.neutral[700] },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warning[50],
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: '500', color: '#92400E' },
  italic: { fontSize: 13, fontStyle: 'italic', color: colors.neutral[500] },
  refund: { fontSize: 13, fontWeight: '500', color: colors.primary[700] },
  muted: { fontSize: 13, color: colors.neutral[500] },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  secondary: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryText: { fontSize: 14, fontWeight: '500', color: colors.neutral[900] },
  ghost: { paddingHorizontal: 12, paddingVertical: 8 },
  ghostText: { fontSize: 14, fontWeight: '500', color: colors.primary[600] },
  due: { fontSize: 14, fontWeight: '600', color: colors.neutral[900] },
})
