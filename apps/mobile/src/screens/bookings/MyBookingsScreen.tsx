/**
 * My Bookings — E06-06 (UIUX_SPEC §8.1). Upcoming / Past / Cancelled, each
 * its own paged list with pull-to-refresh.
 *
 * Deviation: the ticket uses react-native-tab-view, which is not installed
 * (and pulls in a native pager); three tabs over one FlatList need neither.
 */
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useInfiniteQuery } from '@tanstack/react-query'
import { BOOKING_TABS, type BookingTab } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { bookingApi } from '../../lib/bookingApi'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { useToast } from '../../components/common/Toast'
import { colors, spacing } from '../../theme/tokens'
import { BookingCard } from './BookingCard'

type Props = NativeStackScreenProps<AppStackParamList, 'MyBookings'>

const LABELS: Record<BookingTab, string> = {
  upcoming: 'Upcoming',
  past: 'Past',
  cancelled: 'Cancelled',
}

export function useBookingList(tab: BookingTab) {
  return useInfiniteQuery({
    queryKey: ['bookings', tab],
    queryFn: ({ pageParam }) => bookingApi.list(tab, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
  })
}

export function MyBookingsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<BookingTab>(route.params?.tab ?? 'upcoming')
  const { show, toast } = useToast(insets.bottom + 24)

  // Returning here with new params (after a cancellation) switches tab and tells why.
  const { tab: paramTab, notice } = route.params ?? {}
  useEffect(() => {
    if (paramTab) setTab(paramTab)
  }, [paramTab])
  useEffect(() => {
    if (notice) show(notice)
  }, [notice, show])
  const q = useBookingList(tab)
  const items = q.data?.pages.flatMap(p => p.items) ?? []

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
          My bookings
        </Text>
        <Pressable
          onPress={() => navigation.navigate('MyReviews')}
          style={styles.reviews}
          accessibilityRole="button"
          accessibilityLabel="My reviews"
        >
          <Icon name="star-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.reviewsText}>My reviews</Text>
        </Pressable>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {BOOKING_TABS.map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, t === tab && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: t === tab }}
          >
            <Text style={[styles.tabText, t === tab && styles.tabTextOn]}>{LABELS[t]}</Text>
          </Pressable>
        ))}
      </View>

      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={b => b.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          refreshControl={
            <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />
          }
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<Empty tab={tab} onFind={() => navigation.navigate('Discover')} />}
          ListFooterComponent={
            q.isFetchingNextPage ? <ActivityIndicator color={colors.primary[600]} /> : null
          }
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              onPress={() => navigation.navigate('BookingDetail', { id: item.id })}
              onReview={() => navigation.navigate('Review', { bookingId: item.id })}
              onRebook={() =>
                navigation.navigate('PitchDetail', {
                  pitchId: item.pitch.id,
                  companyId: item.company.id,
                })
              }
            />
          )}
        />
      )}
      {toast}
    </SafeAreaView>
  )
}

function Empty({ tab, onFind }: { tab: BookingTab; onFind: () => void }) {
  if (tab === 'upcoming') {
    return (
      <EmptyState
        illustration={<Icon name="calendar-blank" size={64} color={colors.neutral[300]} />}
        title="No upcoming bookings"
        description="Book a pitch and it will show up here."
        ctaLabel="Find a pitch"
        ctaVariant="primary"
        onCta={onFind}
      />
    )
  }
  return (
    <EmptyState
      illustration={
        <Icon
          name={tab === 'past' ? 'soccer-field' : 'check-circle-outline'}
          size={64}
          color={colors.neutral[300]}
        />
      }
      title={tab === 'past' ? 'No past bookings yet' : 'No cancelled bookings'}
      description={tab === 'past' ? 'Games you have played appear here.' : 'Nothing cancelled.'}
    />
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, height: 52 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  reviews: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: spacing.sm,
  },
  reviewsText: { fontSize: 14, fontWeight: '500', color: colors.primary[600] },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.neutral[200] },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabOn: { borderBottomWidth: 2, borderBottomColor: colors.primary[600] },
  tabText: { fontSize: 15, fontWeight: '500', color: colors.neutral[500] },
  tabTextOn: { color: colors.neutral[900] },
  loading: { marginTop: spacing.xl },
  list: { padding: spacing.md, flexGrow: 1 },
  gap: { height: 12 },
})
