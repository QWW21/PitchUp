/**
 * Trust score detail — E08-05 (UIUX_SPEC §10.2). The score (badge and bar,
 * see TrustBadge for why there is no ring), the tier table with yours
 * highlighted, tips, and the history by month, loading more as you scroll.
 * Events about a booking open it.
 */
import React from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  formatDateLong,
  formatMonth,
  venueClock,
  type TrustEvent,
  type TrustScoreDetail,
} from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { profileApi } from '../../lib/profileApi'
import { ErrorState } from '../../components/common/ErrorState'
import { TrustBadge } from '../../components/profile/TrustBadge'
import { colors, spacing } from '../../theme/tokens'
import { useLocale, useT } from '../../i18n'
import type { Locale } from '@pitchup/shared'

type Props = NativeStackScreenProps<AppStackParamList, 'TrustScore'>

type Row = { kind: 'month'; label: string } | { kind: 'event'; event: TrustEvent }

/** Events with a month heading whenever the month changes. */
export function withMonths(events: TrustEvent[], locale: Locale): Row[] {
  const rows: Row[] = []
  let current = ''
  for (const event of events) {
    const label = formatMonth(venueClock(new Date(event.createdAt)).date, locale)
    if (label !== current) {
      rows.push({ kind: 'month', label })
      current = label
    }
    rows.push({ kind: 'event', event })
  }
  return rows
}

export function TrustScoreDetailScreen({ navigation }: Props) {
  const t = useT()
  const locale = useLocale()
  const q = useInfiniteQuery({
    queryKey: ['trust-score'],
    queryFn: ({ pageParam }) => profileApi.trustScore(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
  })

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />
  const first = q.data?.pages[0]
  if (!first) return <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
  const rows = withMonths(
    q.data!.pages.flatMap(p => p.events),
    locale
  )

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('profile.back')}
        >
          <Icon name="chevron-left" size={26} color={colors.neutral[900]} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('profile.trust.title')}
        </Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r, i) => (r.kind === 'event' ? r.event.id : `m-${r.label}-${i}`)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />
        }
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={<Header detail={first} empty={rows.length === 0} />}
        ListFooterComponent={
          <>
            {q.isFetchingNextPage ? <ActivityIndicator color={colors.primary[600]} /> : null}
            <Tips />
          </>
        }
        renderItem={({ item }) =>
          item.kind === 'month' ? (
            <Text style={styles.month}>{item.label.toUpperCase()}</Text>
          ) : (
            <EventRow
              event={item.event}
              onPress={
                item.event.bookingId
                  ? () => navigation.navigate('BookingDetail', { id: item.event.bookingId! })
                  : undefined
              }
            />
          )
        }
      />
    </SafeAreaView>
  )
}

function Header({ detail: d, empty }: { detail: TrustScoreDetail; empty: boolean }) {
  const t = useT()
  return (
    <View style={styles.headerBlock}>
      <View style={styles.center}>
        <TrustBadge score={d.score} size={120} duration={800} />
        <Text style={styles.tier}>{t(`trust.tier.${d.tier}`)}</Text>
        <Text style={styles.muted}>{d.tierDescription}</Text>
      </View>
      <View style={styles.card}>
        {d.tiers.map(row => {
          const current = row.name === d.tier
          return (
            <View
              key={row.name}
              style={[
                styles.tierRow,
                current && { backgroundColor: colors.neutral[50], borderLeftColor: row.colour },
              ]}
              accessibilityLabel={`${t(`trust.tier.${row.name}`)}, ${row.range}: ${row.description}${current ? t('profile.trust.yourTier') : ''}`}
            >
              <Text style={styles.tierName}>{t(`trust.tier.${row.name}`)}</Text>
              <Text style={styles.tierRange}>{row.range}</Text>
              <Text style={styles.tierText}>{row.description}</Text>
            </View>
          )
        })}
      </View>
      <Text style={styles.sectionTitle}>{t('profile.trust.history')}</Text>
      {empty ? <Text style={styles.muted}>{t('profile.trust.none')}</Text> : null}
    </View>
  )
}

export function EventRow({
  event: e,
  onPress,
}: {
  event: TrustEvent
  onPress?: (() => void) | undefined
}) {
  const locale = useLocale()
  const up = e.delta >= 0
  const content = (
    <>
      <View style={[styles.delta, { backgroundColor: up ? colors.primary[50] : colors.error[50] }]}>
        <Text style={[styles.deltaText, { color: up ? colors.primary[700] : colors.error[600] }]}>
          {up ? `+${e.delta}` : `−${Math.abs(e.delta)}`}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.eventLabel}>{e.label}</Text>
        <Text style={styles.date}>
          {formatDateLong(venueClock(new Date(e.createdAt)).date, locale)}
        </Text>
      </View>
      {onPress ? <Icon name="chevron-right" size={22} color={colors.neutral[400]} /> : null}
    </>
  )
  return onPress ? (
    <Pressable onPress={onPress} style={styles.event} accessibilityRole="button">
      {content}
    </Pressable>
  ) : (
    <View style={styles.event}>{content}</View>
  )
}

function Tips() {
  const t = useT()
  return (
    <View style={styles.tips}>
      <Text style={styles.sectionTitle}>{t('profile.trust.improve')}</Text>
      {([0, 1, 2, 3] as const).map(i => (
        <View key={i} style={styles.tip}>
          <Icon name="check-circle" size={18} color={colors.primary[600]} />
          <Text style={styles.tipText}>{t(`profile.trust.tips.${i}`)}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  loading: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: spacing.xs },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  headerBlock: { gap: spacing.md, marginBottom: spacing.sm },
  center: { alignItems: 'center', gap: 4 },
  tier: { marginTop: 4, fontSize: 18, fontWeight: '700', color: colors.neutral[900] },
  muted: { fontSize: 14, color: colors.neutral[500], textAlign: 'center' },
  card: { borderRadius: 8, borderWidth: 1, borderColor: colors.neutral[200], overflow: 'hidden' },
  tierRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  tierName: { width: 76, fontSize: 14, fontWeight: '600', color: colors.neutral[900] },
  tierRange: { width: 52, fontSize: 13, color: colors.neutral[500] },
  tierText: { flex: 1, fontSize: 13, color: colors.neutral[700] },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[900] },
  month: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[400],
  },
  event: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  delta: {
    width: 48,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deltaText: { fontSize: 14, fontWeight: '700' },
  flex: { flex: 1 },
  eventLabel: { fontSize: 15, color: colors.neutral[900] },
  date: { fontSize: 13, color: colors.neutral[400] },
  tips: {
    marginTop: spacing.lg,
    backgroundColor: colors.neutral[50],
    borderRadius: 8,
    padding: spacing.md,
    gap: 8,
  },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipText: { fontSize: 15, color: colors.neutral[700] },
})
