/**
 * A venue's bookings on the phone — E11-09. Status and pitch chips filter
 * the list, which loads more as it scrolls and refreshes on pull. Each card
 * has its pitch's colour down the left side. Opened from Profile.
 */
import React, { useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
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
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { formatDateLong, type BookingStatus, type ManagerBooking } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { managerApi } from '../../lib/managerApi'
import { SubscriptionBanner } from '../../components/manager/SubscriptionBanner'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { colors, spacing } from '../../theme/tokens'
import { useLocale, useT } from '../../i18n'

type Props = NativeStackScreenProps<AppStackParamList, 'ManagerBookings'>

const STATUSES: (BookingStatus | undefined)[] = [
  undefined,
  'CONFIRMED',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
]

/** Each status's icon and colour; its words are manager.status.* in the catalog. */
export const STATUS_TEXT: Record<BookingStatus, [string, string]> = {
  PENDING: ['clock-outline', colors.warning[500]],
  AWAITING_APPROVAL: ['help-circle-outline', colors.warning[500]],
  CONFIRMED: ['check-circle', colors.primary[600]],
  CANCELLED: ['close-circle', colors.neutral[500]],
  COMPLETED: ['check-all', colors.info[500]],
  NO_SHOW: ['alert-circle', colors.error[600]],
}

export function ManagerBookingsScreen({ navigation }: Props) {
  const t = useT()
  const [status, setStatus] = useState<BookingStatus | undefined>(undefined)
  const [pitchId, setPitchId] = useState<string | undefined>(undefined)
  const pitches = useQuery({ queryKey: ['manager-pitches'], queryFn: managerApi.pitches })
  const list = useInfiniteQuery({
    queryKey: ['manager-bookings', status, pitchId],
    queryFn: ({ pageParam }) => managerApi.bookings({ status, pitchId }, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    staleTime: 30_000,
  })
  const items = list.data?.pages.flatMap(p => p.items) ?? []

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('manager.back')}
        >
          <Icon name="chevron-left" size={26} color={colors.neutral[900]} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('manager.bookings.title')}
        </Text>
      </View>
      <SubscriptionBanner />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {STATUSES.map(value => (
          <Chip
            key={value ?? 'all'}
            label={value ? t(`manager.status.${value}`) : t('manager.bookings.all')}
            on={status === value}
            onPress={() => setStatus(value)}
          />
        ))}
      </ScrollView>
      {pitches.data && pitches.data.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label={t('manager.bookings.allPitches')}
            on={!pitchId}
            onPress={() => setPitchId(undefined)}
          />
          {pitches.data.map(p => (
            <Chip
              key={p.id}
              label={p.name}
              on={pitchId === p.id}
              onPress={() => setPitchId(p.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {list.isError ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={b => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <BookingRow
              booking={item}
              onPress={() => navigation.navigate('ManagerBookingDetail', { id: item.id })}
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage()
          }}
          refreshControl={
            <RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />
          }
          ListFooterComponent={
            list.isFetchingNextPage ? <ActivityIndicator color={colors.primary[600]} /> : null
          }
          ListEmptyComponent={
            <EmptyState
              illustration={<Icon name="calendar-blank" size={64} color={colors.neutral[300]} />}
              title={
                pitches.data?.length === 0
                  ? t('manager.bookings.addPitch')
                  : t('manager.bookings.none')
              }
              description={t('manager.bookings.hint')}
            />
          }
        />
      )}
    </SafeAreaView>
  )
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  )
}

function BookingRow({ booking: b, onPress }: { booking: ManagerBooking; onPress: () => void }) {
  const t = useT()
  const locale = useLocale()
  const [icon, tint] = b.attendedAt ? ['check-circle', colors.primary[600]] : STATUS_TEXT[b.status]
  const label = b.attendedAt ? t('manager.status.attended') : t(`manager.status.${b.status}`)
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { borderLeftColor: b.pitch.color }]}
      accessibilityRole="button"
      accessibilityLabel={t('manager.bookings.rowLabel', {
        player: b.player.name,
        when: `${formatDateLong(b.date, locale)} ${b.startTime}`,
        pitch: b.pitch.name,
        status: label,
      })}
    >
      <View style={styles.cardTop}>
        <Text style={styles.player} numberOfLines={1}>
          {b.player.name}
        </Text>
        <Icon name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.muted}>
        {formatDateLong(b.date, locale)} · {b.startTime}–{b.endTime}
      </Text>
      <Text style={styles.muted}>
        {b.pitch.name} · {b.total} RON
        {b.dueAtVenue > 0 && !b.attendedAt && b.status === 'CONFIRMED'
          ? t('manager.bookings.atVenue', { amount: b.dueAtVenue })
          : ''}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, height: 52 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  chips: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.sm },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  chipText: { fontSize: 14, color: colors.neutral[700] },
  chipTextOn: { color: colors.neutral[0], fontWeight: '600' },
  loading: { marginTop: spacing.xl },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  card: {
    minHeight: 80,
    backgroundColor: colors.neutral[0],
    borderRadius: 8,
    borderLeftWidth: 4,
    padding: 12,
    gap: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  player: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.neutral[900] },
  muted: { fontSize: 13, color: colors.neutral[500] },
})
