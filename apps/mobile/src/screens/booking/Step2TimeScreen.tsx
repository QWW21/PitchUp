/**
 * Step 2: the time — E05-03 (UIUX_SPEC §7.2). 40 px per 30 minutes; tap a
 * start, then an end. What a tap does comes from tapSlot in @pitchup/shared,
 * the same rules as the web. Today, the list opens at the current time and
 * an orange line marks "now".
 */
import React, { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useQuery } from '@tanstack/react-query'
import {
  bookingPrice,
  formatDuration,
  rangeTimes,
  tapSlot,
  venueClock,
  type SlotRange,
} from '@pitchup/shared'
import { bookingApi } from '../../lib/bookingApi'
import { useBookingStore } from '../../stores/bookingStore'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { colors, spacing } from '../../theme/tokens'
import { BookingHeader } from './BookingHeader'
import type { BookingScreenProps } from './navigation'

const ROW = 40

export function Step2TimeScreen({ navigation }: BookingScreenProps<'BookingTime'>) {
  const insets = useSafeAreaInsets()
  const pitch = useBookingStore(s => s.pitch)!
  const date = useBookingStore(s => s.date)!
  const setTime = useBookingStore(s => s.setTime)
  const [range, setRange] = useState<SlotRange | null>(null)

  const day = useQuery({
    queryKey: ['booking-slots', pitch.id, date],
    queryFn: () => bookingApi.day(pitch.id, date),
    staleTime: 0,
  })
  const slots = day.data?.slots ?? []
  const isToday = date === venueClock(new Date()).date
  const nowIndex = isToday ? slots.findIndex(s => s.status !== 'past') : -1

  const chosen = range ? rangeTimes(slots, range) : null
  const valid = !!chosen && chosen.minutes >= pitch.minBookingHours * 60
  const price = chosen ? bookingPrice(pitch.hourlyRate, chosen.minutes) : null
  const noneFree = day.isSuccess && !slots.some(s => s.status === 'available')

  return (
    <View style={styles.root}>
      <BookingHeader
        step={2}
        onBack={() => navigation.goBack()}
        onClose={() => navigation.getParent()?.goBack()}
      />
      <View style={styles.top}>
        <Text style={styles.heading}>Pick a time</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText} accessibilityLiveRegion="polite">
            {chosen
              ? `${chosen.startTime}–${chosen.endTime} · ${formatDuration(chosen.minutes)}`
              : 'Select a start and end time'}
          </Text>
        </View>
      </View>

      {day.isError ? (
        <ErrorState onRetry={() => day.refetch()} />
      ) : noneFree ? (
        <EmptyState
          illustration={<Icon name="calendar-remove" size={64} color={colors.neutral[300]} />}
          title="No slots available for this date"
          description="Every time on this day is booked or has passed."
          ctaLabel="← Change date"
          onCta={() => navigation.goBack()}
        />
      ) : (
        <FlatList
          data={slots}
          keyExtractor={s => s.time}
          getItemLayout={(_, index) => ({ length: ROW, offset: ROW * index, index })}
          initialScrollIndex={nowIndex > 2 ? nowIndex - 2 : 0}
          renderItem={({ item, index }) => {
            const inRange = !!range && index >= range.start && index <= range.end
            const edge = range?.start === index || range?.end === index
            const free = item.status === 'available'
            return (
              <View style={styles.row}>
                <Text style={styles.time}>{item.time}</Text>
                <Pressable
                  testID={`slot-${item.time}`}
                  disabled={!free}
                  onPress={() =>
                    setRange(r => tapSlot(slots, r, index, pitch.maxBookingHours * 60))
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected: inRange, disabled: !free }}
                  accessibilityLabel={`${item.time}, ${free ? (inRange ? 'selected' : 'available') : item.status === 'past' ? 'already passed' : 'booked'}`}
                  style={[
                    styles.cell,
                    !free && (item.status === 'past' ? styles.past : styles.booked),
                    inRange && (edge ? styles.edge : styles.middle),
                    range?.start === index && styles.first,
                    range?.end === index && styles.last,
                  ]}
                >
                  {item.status === 'booked' ? <Text style={styles.bookedText}>Booked</Text> : null}
                </Pressable>
                {index === nowIndex && nowIndex > 0 ? <View style={styles.now} /> : null}
              </View>
            )
          }}
        />
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {chosen && price ? (
          <Text style={styles.price}>
            {formatDuration(chosen.minutes)} × {pitch.hourlyRate} RON/h ={' '}
            <Text style={styles.bold}>{price.total} RON</Text>
          </Text>
        ) : null}
        {chosen && !valid ? (
          <Text style={styles.hint}>Choose at least {pitch.minBookingHours} hour(s).</Text>
        ) : null}
        <Button
          label="Next"
          disabled={!valid}
          onPress={() => {
            if (!chosen || !valid) return
            setTime(chosen.startTime, chosen.endTime, chosen.minutes)
            navigation.navigate('BookingTeams')
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  top: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  heading: { fontSize: 22, fontWeight: '700', color: colors.neutral[900] },
  pill: {
    alignSelf: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { fontSize: 14, fontWeight: '500', color: colors.neutral[700] },
  row: {
    height: ROW,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  time: {
    width: 48,
    fontSize: 12,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: ROW,
  },
  cell: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.sm },
  past: { backgroundColor: colors.neutral[50] },
  booked: { backgroundColor: colors.neutral[100] },
  bookedText: { fontSize: 12, color: colors.neutral[500], textDecorationLine: 'line-through' },
  edge: { backgroundColor: colors.primary[600] },
  middle: {
    backgroundColor: colors.primary[100],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[600],
  },
  first: { borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  last: { borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  now: {
    position: 'absolute',
    top: -1,
    left: 48,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: colors.accent[500],
  },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  price: { fontSize: 15, color: colors.neutral[700] },
  bold: { fontWeight: '700', color: colors.neutral[900] },
  hint: { fontSize: 13, color: colors.neutral[700] },
})
