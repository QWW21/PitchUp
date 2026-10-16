/**
 * A venue's analytics on the phone — E14-10. Period chips, the five
 * headline numbers, and revenue as bars (plain Views: no chart or SVG
 * library, so no new native module). Tapping a bar shows its figures.
 * No heatmap on the phone; the pitches are a list on their own screen.
 */
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useQuery } from '@tanstack/react-query'
import { ANALYTICS_PERIODS, bucketLabel, type AnalyticsPeriod, type Kpi } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { managerApi } from '../../lib/managerApi'
import { ErrorState } from '../../components/common/ErrorState'
import { colors, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AppStackParamList, 'ManagerAnalytics'>

const PERIOD_CHIPS: Record<AnalyticsPeriod, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '12m': '12 months',
}
/** Analytics needn't be live: five minutes is fresh enough. */
const STALE = 5 * 60_000
const BAR_AREA = 120

const ron = (n: number) => `${Math.round(n * 100) / 100} RON`

export function ManagerAnalyticsScreen({ navigation }: Props) {
  const [period, setPeriod] = React.useState<AnalyticsPeriod>('30d')
  const [bar, setBar] = React.useState<number | null>(null)
  const summary = useQuery({
    queryKey: ['analytics-summary', period],
    queryFn: () => managerApi.analyticsSummary(period),
    staleTime: STALE,
  })
  const revenue = useQuery({
    queryKey: ['analytics-revenue', period],
    queryFn: () => managerApi.analyticsRevenue(period),
    staleTime: STALE,
  })
  const s = summary.data
  const points = revenue.data?.data ?? []
  const max = Math.max(1, ...points.map(p => p.gross))
  const chosen = bar === null ? null : points[bar]

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="chevron-left" size={26} color={colors.neutral[900]} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Analytics
        </Text>
      </View>
      <View style={styles.chips}>
        {ANALYTICS_PERIODS.map(p => (
          <Pressable
            key={p}
            onPress={() => {
              setPeriod(p)
              setBar(null)
            }}
            style={[styles.chip, period === p && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: period === p }}
          >
            <Text style={[styles.chipText, period === p && styles.chipTextOn]}>
              {PERIOD_CHIPS[p]}
            </Text>
          </Pressable>
        ))}
      </View>
      {summary.isError || revenue.isError ? (
        <ErrorState
          onRetry={() => {
            void summary.refetch()
            void revenue.refetch()
          }}
        />
      ) : !s || !revenue.data ? (
        <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={summary.isRefetching}
              onRefresh={() => {
                void summary.refetch()
                void revenue.refetch()
              }}
            />
          }
        >
          <View style={styles.grid}>
            <Card label="Revenue" value={ron(s.revenue.value ?? 0)} kpi={s.revenue} />
            <Card label="Bookings played" value={String(s.bookings.value ?? 0)} kpi={s.bookings} />
            <Card
              label="Occupancy"
              value={s.occupancy.value === null ? '—' : `${s.occupancy.value}%`}
              kpi={s.occupancy}
            />
            <Card
              label="Average rating"
              value={s.avgRating.value === null ? '—' : `★ ${s.avgRating.value.toFixed(1)}`}
              kpi={s.avgRating}
            />
            <Card
              label="No-show rate"
              value={s.noShowRate.value === null ? '—' : `${s.noShowRate.value}%`}
              kpi={s.noShowRate}
              invertGood
              wide
            />
          </View>
          <Text style={styles.muted}>
            {ron(s.revenue.online)} online · {ron(s.revenue.atVenue)} at the venue
          </Text>

          <Text style={styles.section} accessibilityRole="header">
            Revenue
          </Text>
          {points.every(p => p.gross === 0) ? (
            <Text style={styles.muted}>No revenue in this period.</Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.bars}>
                  {points.map((p, i) => (
                    <Pressable
                      key={p.period}
                      onPress={() => setBar(bar === i ? null : i)}
                      style={styles.barSlot}
                      accessibilityRole="button"
                      accessibilityLabel={`${bucketLabel(p.period, revenue.data.groupBy)}: ${ron(p.gross)}`}
                    >
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(2, (p.gross / max) * BAR_AREA) },
                          bar === i && styles.barOn,
                        ]}
                      />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.muted} accessibilityLiveRegion="polite">
                {chosen
                  ? `${bucketLabel(chosen.period, revenue.data.groupBy)}: ${ron(chosen.gross)}, ${chosen.bookings} ${chosen.bookings === 1 ? 'booking' : 'bookings'}`
                  : `${bucketLabel(points[0]!.period, revenue.data.groupBy)} – ${bucketLabel(points.at(-1)!.period, revenue.data.groupBy)} · tap a bar for its figures`}
              </Text>
            </>
          )}

          <Pressable
            onPress={() => navigation.navigate('ManagerPitchPerformance', { period })}
            style={styles.link}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>Pitch performance</Text>
            <Icon name="chevron-right" size={22} color={colors.neutral[500]} />
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function Card({
  label,
  value,
  kpi,
  invertGood = false,
  wide = false,
}: {
  label: string
  value: string
  kpi: Kpi
  invertGood?: boolean
  wide?: boolean
}) {
  const { change } = kpi
  const good = change !== null && change !== 0 && (invertGood ? change < 0 : change > 0)
  const bad = change !== null && change !== 0 && !good
  const text =
    change === null
      ? 'No earlier data'
      : `${change > 0 ? '↑' : change < 0 ? '↓' : ''} ${Math.abs(change)}% vs before`
  return (
    <View
      style={[styles.card, wide && styles.cardWide]}
      accessible
      accessibilityLabel={`${label}: ${value}. ${text}`}
    >
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      <Text
        style={[
          styles.cardChange,
          good && { color: colors.primary[700] },
          bad && { color: colors.error[600] },
        ]}
      >
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
  },
  chipOn: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  chipText: { fontSize: 13, color: colors.neutral[700] },
  chipTextOn: { color: colors.neutral[0], fontWeight: '600' },
  loading: { marginTop: spacing.xl },
  body: { padding: spacing.md, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    width: '48%',
    minHeight: 84,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.neutral[0],
  },
  cardWide: { width: '100%' },
  cardLabel: { fontSize: 13, color: colors.neutral[700] },
  cardValue: { fontSize: 20, fontWeight: '700', color: colors.neutral[900], marginTop: 2 },
  cardChange: { fontSize: 12, color: colors.neutral[500], marginTop: 2 },
  muted: { fontSize: 13, color: colors.neutral[700] },
  section: { fontSize: 16, fontWeight: '700', color: colors.neutral[900] },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: BAR_AREA, gap: 4 },
  barSlot: { width: 20, height: BAR_AREA, justifyContent: 'flex-end' },
  bar: { width: 20, borderRadius: 3, backgroundColor: colors.primary[600] },
  barOn: { backgroundColor: colors.primary[700] },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.neutral[0],
  },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.neutral[900] },
})
