/**
 * Step 1: the date — E05-02 (UIUX_SPEC §7.1). A month grid, Monday first,
 * 44×44 cells. Arrows or a horizontal swipe change month (not before this
 * month, not past the pitch's booking window). Past and closed days cannot
 * be tapped; a fully booked day says so.
 *
 * Deviation: the ticket suggests react-native-pager-view for the swipe. A
 * PanResponder does the same without another native dependency.
 */
import React, { useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useQuery } from '@tanstack/react-query'
import { addDays, dayOfWeek, formatDateLong, formatMonth, venueClock } from '@pitchup/shared'
import { bookingApi } from '../../lib/bookingApi'
import { useBookingStore } from '../../stores/bookingStore'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/common/Toast'
import { colors, spacing } from '../../theme/tokens'
import { BookingHeader } from './BookingHeader'
import type { BookingScreenProps } from './navigation'

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

const monthStart = (date: string) => `${date.slice(0, 7)}-01`
const shiftMonth = (first: string, by: number) => {
  const [y, m] = first.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1 + by, 1)).toISOString().slice(0, 10)
}
const daysIn = (first: string) => {
  const [y, m] = first.split('-').map(Number)
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate()
}

/** The month's days, Monday first, padded to whole weeks with nulls. */
export function monthGrid(first: string): (string | null)[] {
  const days = Array.from({ length: daysIn(first) }, (_, i) => addDays(first, i))
  const cells: (string | null)[] = [...Array<null>((dayOfWeek(first) + 6) % 7).fill(null), ...days]
  while (cells.length % 7) cells.push(null)
  return cells
}

export function Step1DateScreen({ navigation }: BookingScreenProps<'BookingDate'>) {
  const insets = useSafeAreaInsets()
  const pitch = useBookingStore(s => s.pitch)!
  const chosen = useBookingStore(s => s.date)
  const setDate = useBookingStore(s => s.setDate)
  const today = venueClock(new Date()).date
  const lastDay = addDays(today, pitch.advanceBookingDays)
  const [selected, setSelected] = useState<string | null>(chosen)
  const [month, setMonth] = useState(monthStart(chosen ?? today))
  const { show, toast } = useToast(insets.bottom + 96)

  const calendar = useQuery({
    queryKey: ['pitch-calendar', pitch.id, month],
    queryFn: () => bookingApi.calendar(pitch.id, month, daysIn(month)),
    staleTime: 30 * 1000,
  })
  const status = useMemo(
    () => new Map((calendar.data ?? []).map(d => [d.date, d.status])),
    [calendar.data]
  )

  const canPrev = month > monthStart(today)
  const canNext = shiftMonth(month, 1) <= lastDay
  const go = (by: -1 | 1) => {
    if (by < 0 ? canPrev : canNext) setMonth(m => shiftMonth(m, by))
  }

  // Refs keep the latest bounds inside a responder created once.
  const bounds = useRef({ go })
  bounds.current = { go }
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dy) < 20,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) bounds.current.go(1)
        if (g.dx > 50) bounds.current.go(-1)
      },
    })
  ).current

  const tap = (date: string) => {
    const s = status.get(date)
    if (s === 'full') return show('No available slots on this day')
    if (s === 'available') setSelected(date)
  }

  const close = () => navigation.getParent()?.goBack()

  return (
    <View style={styles.root}>
      <BookingHeader step={1} onBack={close} onClose={close} />
      <View style={styles.body}>
        <Text style={styles.heading}>Pick a date</Text>
        <View style={styles.monthRow}>
          <Pressable
            onPress={() => go(-1)}
            disabled={!canPrev}
            style={styles.arrow}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Icon
              name="chevron-left"
              size={26}
              color={canPrev ? colors.neutral[700] : colors.neutral[300]}
            />
          </Pressable>
          <Text style={styles.month} accessibilityRole="header">
            {formatMonth(month)}
          </Text>
          <Pressable
            onPress={() => go(1)}
            disabled={!canNext}
            style={styles.arrow}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Icon
              name="chevron-right"
              size={26}
              color={canNext ? colors.neutral[700] : colors.neutral[300]}
            />
          </Pressable>
        </View>

        <View style={styles.week}>
          {WEEKDAYS.map(d => (
            <Text key={d} style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.grid} {...swipe.panHandlers}>
          {monthGrid(month).map((date, i) => {
            if (!date) return <View key={i} style={styles.cell} />
            const s = status.get(date)
            const isSelected = date === selected
            const tappable = s === 'available' || s === 'full'
            return (
              <Pressable
                key={date}
                testID={`day-${date}`}
                onPress={() => tap(date)}
                disabled={!tappable}
                style={styles.cell}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: !tappable }}
                accessibilityLabel={`${formatDateLong(date)}${s === 'full' ? ', fully booked' : s === 'available' ? '' : ', unavailable'}`}
              >
                <View style={[styles.dayCircle, isSelected && styles.daySelected]}>
                  <Text
                    style={[
                      styles.dayText,
                      s !== 'available' && styles.dayMuted,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {Number(date.slice(8))}
                  </Text>
                </View>
                {date === today && !isSelected ? <View style={styles.todayDot} /> : null}
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label="Next"
          disabled={!selected}
          onPress={() => {
            if (!selected) return
            setDate(selected)
            navigation.navigate('BookingTime')
          }}
        />
      </View>
      {toast}
    </View>
  )
}

const CELL = 44

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  body: { flex: 1, paddingHorizontal: spacing.md },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  month: { fontSize: 18, fontWeight: '600', color: colors.neutral[900] },
  week: { flexDirection: 'row', marginTop: spacing.sm },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
    color: colors.neutral[500],
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  cell: { width: `${100 / 7}%`, height: CELL, alignItems: 'center', justifyContent: 'center' },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: colors.primary[600] },
  dayText: { fontSize: 15, color: colors.neutral[900] },
  dayMuted: { color: colors.neutral[300] },
  dayTextSelected: { color: colors.neutral[0], fontWeight: '600' },
  todayDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary[600],
  },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
})
