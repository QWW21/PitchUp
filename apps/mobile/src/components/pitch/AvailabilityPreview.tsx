import React, { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { DAY_LONG, DAY_SHORT, dayOfWeek, type PitchAvailability } from '@pitchup/shared'
import { usePitchWeek } from '../../hooks/useVenue'
import { colors } from '../../theme/tokens'

type DayState = 'loading' | 'available' | 'full' | 'closed'

function stateOf(a: PitchAvailability | undefined): DayState {
  if (!a) return 'loading'
  if (a.isClosed) return 'closed'
  if (a.slots.some(s => s.status === 'available')) return 'available'
  // Nothing left today because the day is over, not because it sold out.
  if (!a.slots.some(s => s.status === 'booked')) return 'closed'
  return 'full'
}

const DOT: Record<Exclude<DayState, 'loading'>, string> = {
  available: colors.primary[600],
  full: colors.error[500],
  closed: colors.neutral[300],
}

function LoadingDot() {
  const pulse = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])
  return (
    <Animated.View style={[styles.dot, { backgroundColor: colors.neutral[300], opacity: pulse }]} />
  )
}

interface AvailabilityPreviewProps {
  pitchId: string
  enabled: boolean
  /** Opens the booking flow on a day that has slots (or is full: step 1 says so). */
  onPickDay: (date: string) => void
  onClosedDay: (message: string) => void
}

/** Today + six days, one dot each. UIUX_SPEC §6.2, E04-06. */
export function AvailabilityPreview({
  pitchId,
  enabled,
  onPickDay,
  onClosedDay,
}: AvailabilityPreviewProps) {
  const week = usePitchWeek(pitchId, enabled)
  return (
    <View style={styles.row}>
      {week.map(({ date, query }, i) => {
        const state = query.isError ? 'closed' : stateOf(query.data)
        const dow = dayOfWeek(date)
        return (
          <Pressable
            key={date}
            style={styles.column}
            disabled={state === 'loading'}
            accessibilityRole="button"
            accessibilityLabel={`${DAY_LONG[dow]} ${Number(date.slice(8))}: ${state}`}
            onPress={() =>
              state === 'closed'
                ? onClosedDay(
                    i === 0 && query.data && !query.data.isClosed
                      ? 'No more slots today'
                      : `This pitch is closed on ${DAY_LONG[dow]}`
                  )
                : onPickDay(date)
            }
          >
            <Text style={[styles.day, i === 0 && styles.today]}>
              {i === 0 ? 'Today' : DAY_SHORT[dow]}
            </Text>
            <Text style={styles.date}>{Number(date.slice(8))}</Text>
            {state === 'loading' ? (
              <LoadingDot />
            ) : (
              <View style={[styles.dot, { backgroundColor: DOT[state] }]} />
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  column: { alignItems: 'center', paddingVertical: 4, minWidth: 40 },
  day: { fontSize: 11, fontWeight: '500', color: colors.neutral[500] },
  today: { color: colors.primary[600] },
  date: { marginTop: 4, fontSize: 12, color: colors.neutral[700] },
  dot: { marginTop: 8, width: 8, height: 8, borderRadius: 4 },
})
