/**
 * Each pitch over the period, on the phone — E14-10: a simple list (the web
 * has the sortable table), highest revenue first.
 */
import React from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useQuery } from '@tanstack/react-query'
import { ANALYTICS_PERIOD_LABELS } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { managerApi } from '../../lib/managerApi'
import { ErrorState } from '../../components/common/ErrorState'
import { colors, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AppStackParamList, 'ManagerPitchPerformance'>

export function ManagerPitchPerformanceScreen({ navigation, route }: Props) {
  const { period } = route.params
  const rows = useQuery({
    queryKey: ['analytics-pitches', period],
    queryFn: () => managerApi.analyticsPitches(period),
    staleTime: 5 * 60_000,
  })
  const sorted = [...(rows.data ?? [])].sort((a, b) => b.revenue - a.revenue)
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
        <View>
          <Text style={styles.title} accessibilityRole="header">
            Pitch performance
          </Text>
          <Text style={styles.muted}>{ANALYTICS_PERIOD_LABELS[period]}</Text>
        </View>
      </View>
      {rows.isError ? (
        <ErrorState onRetry={() => rows.refetch()} />
      ) : !rows.data ? (
        <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={r => r.pitchId}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.muted}>No pitches yet.</Text>}
          renderItem={({ item: r }) => (
            <View style={styles.card}>
              <Text style={styles.name}>
                {r.name}
                {r.isActive ? '' : ' (inactive)'}
              </Text>
              <Text style={styles.muted}>
                {Math.round(r.revenue * 100) / 100} RON · {r.totalBookings}{' '}
                {r.totalBookings === 1 ? 'booking' : 'bookings'}
                {r.occupancy === null ? '' : ` · ${r.occupancy}% booked`}
              </Text>
              <Text style={styles.muted}>
                {r.avgRating === null ? 'No reviews' : `★ ${r.avgRating.toFixed(1)}`} ·{' '}
                {r.cancellationRate}% cancelled · {r.noShowRate}% no-shows
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  loading: { marginTop: spacing.xl },
  list: { padding: spacing.md, gap: spacing.sm },
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.neutral[0], gap: 2 },
  name: { fontSize: 16, fontWeight: '600', color: colors.neutral[900] },
  muted: { fontSize: 13, color: colors.neutral[700] },
})
