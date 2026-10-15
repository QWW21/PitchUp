/**
 * Notifications — E08-09 (UIUX_SPEC §9.1). Grouped Today / Yesterday /
 * Earlier this week / Older; unread rows tinted with a dot; a tap marks it
 * read and opens what it is about; "Mark all read" in the header.
 *
 * Deviation, agreed with the owner (no new native modules): deleting is a
 * long press and a confirmation rather than a swipe, which would need
 * react-native-gesture-handler. Opened from the bell on Discover (no tab bar
 * yet), which shows the unread count.
 */
import React from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { addDays, venueClock, type NotificationItem, type NotificationPage } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { profileApi } from '../../lib/profileApi'
import { openNotification } from '../../lib/push'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { colors, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AppStackParamList, 'Notifications'>

export const NOTIFICATIONS_KEY = ['notifications'] as const

type Group = 'Today' | 'Yesterday' | 'Earlier this week' | 'Older'

/** Which section a notification falls in, by the venue's calendar day. */
export function groupOf(iso: string, now: Date = new Date()): Group {
  const day = venueClock(new Date(iso)).date
  const today = venueClock(now).date
  if (day === today) return 'Today'
  if (day === addDays(today, -1)) return 'Yesterday'
  if (day >= addDays(today, -6)) return 'Earlier this week'
  return 'Older'
}

export function sections(items: NotificationItem[], now: Date = new Date()) {
  const order: Group[] = ['Today', 'Yesterday', 'Earlier this week', 'Older']
  return order
    .map(title => ({ title, data: items.filter(n => groupOf(n.createdAt, now) === title) }))
    .filter(s => s.data.length > 0)
}

const ICONS: Record<string, { name: string; bg: string; fg: string }> = {
  BOOKING_CONFIRMED: { name: 'check-circle', bg: colors.primary[50], fg: colors.primary[600] },
  BOOKING_REMINDER_24H: { name: 'clock-outline', bg: '#EFF6FF', fg: '#2563EB' },
  BOOKING_REMINDER_2H: { name: 'clock-outline', bg: '#EFF6FF', fg: '#2563EB' },
  BOOKING_CANCELLED_PLAYER: {
    name: 'close-circle',
    bg: colors.neutral[100],
    fg: colors.neutral[700],
  },
  BOOKING_CANCELLED_MANAGER: {
    name: 'close-circle',
    bg: colors.neutral[100],
    fg: colors.neutral[700],
  },
  REFUND_PROCESSED: { name: 'cash-refund', bg: colors.primary[50], fg: colors.primary[600] },
  NO_SHOW_REPORTED: { name: 'alert-circle', bg: colors.error[50], fg: colors.error[500] },
  PENALTY_CHARGED: { name: 'currency-usd', bg: colors.error[50], fg: colors.error[500] },
  DISPUTE_RESOLVED: { name: 'shield-check', bg: '#EFF6FF', fg: '#2563EB' },
  MANAGER_REPLIED: { name: 'message-reply-text', bg: colors.warning[50], fg: colors.warning[500] },
  REVIEW_LEFT: { name: 'star', bg: colors.warning[50], fg: colors.warning[500] },
}
const FALLBACK = { name: 'bell', bg: colors.neutral[100], fg: colors.neutral[500] }

const time = (iso: string) => venueClock(new Date(iso))

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: ({ pageParam }) => profileApi.notifications(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last: NotificationPage) => last.nextCursor,
  })
}

export function NotificationsScreen({ navigation }: Props) {
  const queryClient = useQueryClient()
  const q = useNotifications()
  const items = q.data?.pages.flatMap(p => p.items) ?? []
  const unread = q.data?.pages[0]?.unread ?? 0
  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })

  const readAll = useMutation({ mutationFn: () => profileApi.markAllRead(), onSuccess: refresh })
  const remove = useMutation({
    mutationFn: (id: string) => profileApi.deleteNotification(id),
    onSuccess: refresh,
  })

  const open = async (n: NotificationItem) => {
    if (!n.isRead) {
      await profileApi.markRead(n.id).catch(() => undefined)
      void refresh()
    }
    openNotification(navigation as never, n.type, n.data)
  }

  const confirmDelete = (n: NotificationItem) =>
    Alert.alert('Delete this notification?', n.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(n.id) },
    ])

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
          Notifications
        </Text>
        {unread > 0 ? (
          <Pressable
            onPress={() => readAll.mutate()}
            style={styles.readAll}
            accessibilityRole="button"
          >
            <Text style={styles.readAllText}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
      ) : (
        <SectionList
          sections={sections(items)}
          keyExtractor={n => n.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />
          }
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={0.3}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.section}>{section.title.toUpperCase()}</Text>
          )}
          ListEmptyComponent={
            <EmptyState
              illustration={<Icon name="bell-outline" size={48} color={colors.neutral[300]} />}
              title="All caught up!"
              description="No notifications yet"
            />
          }
          renderItem={({ item: n }) => {
            const icon = ICONS[n.type] ?? FALLBACK
            const t = time(n.createdAt)
            return (
              <Pressable
                onPress={() => void open(n)}
                onLongPress={() => confirmDelete(n)}
                style={[styles.row, !n.isRead && styles.unread]}
                accessibilityRole="button"
                accessibilityLabel={`${n.isRead ? '' : 'Unread. '}${n.title}. ${n.body}`}
                accessibilityHint="Long press to delete"
              >
                {!n.isRead ? <View style={styles.dot} /> : null}
                <View style={[styles.icon, { backgroundColor: icon.bg }]}>
                  <Icon name={icon.name} size={22} color={icon.fg} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.rowTitle, !n.isRead && styles.bold]}>{n.title}</Text>
                  <Text style={styles.body} numberOfLines={2}>
                    {n.body}
                  </Text>
                  <Text style={styles.time}>
                    {String(Math.floor(t.minutes / 60)).padStart(2, '0')}:
                    {String(t.minutes % 60).padStart(2, '0')}
                  </Text>
                </View>
              </Pressable>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  loading: { marginTop: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: spacing.xs },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  readAll: { paddingHorizontal: spacing.sm, height: 44, justifyContent: 'center' },
  readAllText: { fontSize: 14, fontWeight: '600', color: colors.primary[600] },
  list: { flexGrow: 1, paddingBottom: spacing.xl },
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[400],
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  unread: { backgroundColor: colors.primary[50] },
  dot: {
    position: 'absolute',
    left: 4,
    top: 30,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[600],
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  rowTitle: { fontSize: 15, color: colors.neutral[900] },
  bold: { fontWeight: '700' },
  body: { fontSize: 13, color: colors.neutral[500] },
  time: { marginTop: 2, fontSize: 12, color: colors.neutral[400] },
})
