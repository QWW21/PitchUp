/**
 * Step 2: the time — C-6 (replacing E05-03's grid). Choose a start time,
 * grouped into morning, afternoon and evening, then how long. Which starts
 * and durations are possible comes from @pitchup/shared (startOptions,
 * durationOptions), the same rules as the web.
 */
import React, { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useQuery } from '@tanstack/react-query'
import {
  bookingPrice,
  durationOptions,
  formatShortDuration,
  keepDuration,
  rangeFrom,
  rangeTimes,
  startOptions,
  type DayPeriod,
} from '@pitchup/shared'
import { bookingApi } from '../../lib/bookingApi'
import { useBookingStore } from '../../stores/bookingStore'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { colors, spacing } from '../../theme/tokens'
import { BookingHeader } from './BookingHeader'
import type { BookingScreenProps } from './navigation'
import { useT } from '../../i18n'

const PERIODS: DayPeriod[] = ['Morning', 'Afternoon', 'Evening']
function Chip({
  label,
  accessibilityLabel,
  on,
  disabled,
  onPress,
  testID,
}: {
  label: string
  accessibilityLabel: string
  on: boolean
  disabled: boolean
  onPress: () => void
  testID?: string
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: on, disabled }}
      style={[styles.chip, on && styles.chipOn, disabled && styles.chipOff]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn, disabled && styles.chipTextOff]}>
        {label}
      </Text>
    </Pressable>
  )
}

export function Step2TimeScreen({ navigation }: BookingScreenProps<'BookingTime'>) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const pitch = useBookingStore(s => s.pitch)!
  const date = useBookingStore(s => s.date)!
  const savedStart = useBookingStore(s => s.startTime)
  const savedMinutes = useBookingStore(s => s.minutes)
  const setTime = useBookingStore(s => s.setTime)
  const [start, setStart] = useState<number | null>(null)
  const [minutes, setMinutes] = useState<number | null>(null)

  const day = useQuery({
    queryKey: ['booking-slots', pitch.id, date],
    queryFn: () => bookingApi.day(pitch.id, date),
    staleTime: 0,
  })
  const slots = day.data?.slots ?? []
  const minMinutes = pitch.minBookingHours * 60
  const maxMinutes = pitch.maxBookingHours * 60
  const starts = startOptions(slots, minMinutes)
  const durations = start === null ? [] : durationOptions(slots, start, minMinutes, maxMinutes)

  // Restores a time chosen earlier, if it is still free.
  useEffect(() => {
    if (!slots.length || !savedStart || !savedMinutes || start !== null) return
    const i = slots.findIndex(s => s.time === savedStart)
    if (i < 0) return
    const fits = durationOptions(slots, i, minMinutes, maxMinutes).some(
      d => d.minutes === savedMinutes && d.fits
    )
    if (fits) {
      setStart(i)
      setMinutes(savedMinutes)
    }
  }, [slots, savedStart, savedMinutes, start, minMinutes, maxMinutes])

  const pickStart = (i: number) => {
    setStart(i)
    setMinutes(m => keepDuration(durationOptions(slots, i, minMinutes, maxMinutes), m))
  }

  const chosen =
    start !== null && minutes !== null ? rangeTimes(slots, rangeFrom(start, minutes)) : null
  const price = chosen ? bookingPrice(pitch.hourlyRate, chosen.minutes) : null
  const noneFree = day.isSuccess && !starts.some(s => s.state === 'available')

  return (
    <View style={styles.root}>
      <BookingHeader
        step={2}
        onBack={() => navigation.goBack()}
        onClose={() => navigation.getParent()?.goBack()}
      />

      {day.isError ? (
        <ErrorState onRetry={() => day.refetch()} />
      ) : noneFree ? (
        <EmptyState
          illustration={<Icon name="calendar-remove" size={64} color={colors.neutral[300]} />}
          title={t('booking.time.noSlots')}
          description={t('booking.time.allGone')}
          ctaLabel={t('booking.time.changeDate')}
          onCta={() => navigation.goBack()}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.heading}>{t('booking.time.heading')}</Text>
          {PERIODS.map(period => {
            const group = starts.filter(s => s.period === period)
            if (!group.length) return null
            return (
              <View key={period} style={styles.group}>
                <Text style={styles.period} accessibilityRole="header">
                  {t(`dayPeriod.${period}`).toUpperCase()}
                </Text>
                <View style={styles.chips}>
                  {group.map(o => (
                    <Chip
                      key={o.time}
                      testID={`start-${o.time}`}
                      label={o.time}
                      accessibilityLabel={`${o.time}, ${start === o.index ? t('booking.time.selected') : t(`booking.time.state.${o.state}`)}`}
                      on={start === o.index}
                      disabled={o.state !== 'available'}
                      onPress={() => pickStart(o.index)}
                    />
                  ))}
                </View>
              </View>
            )
          })}

          <Text style={styles.heading}>{t('booking.time.howLong')}</Text>
          {start === null ? (
            <Text style={styles.hint}>{t('booking.time.startFirst')}</Text>
          ) : (
            <View style={styles.chips}>
              {durations.map(d => (
                <Chip
                  key={d.minutes}
                  label={formatShortDuration(d.minutes)}
                  accessibilityLabel={`${formatShortDuration(d.minutes)}${d.fits ? '' : t('booking.time.noFit')}`}
                  on={minutes === d.minutes}
                  disabled={!d.fits}
                  onPress={() => setMinutes(d.minutes)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Text style={styles.summary} accessibilityLiveRegion="polite">
          {chosen && price
            ? `${chosen.startTime}–${chosen.endTime} · ${formatShortDuration(chosen.minutes)} · ${price.total} RON`
            : t('booking.time.choose')}
        </Text>
        <Button
          label={t('booking.next')}
          disabled={!chosen}
          onPress={() => {
            if (!chosen) return
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
  body: { padding: spacing.md, gap: spacing.md },
  heading: { fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  group: { gap: spacing.sm },
  period: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, color: colors.neutral[500] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: 72,
    height: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  chipOff: { backgroundColor: colors.neutral[100], borderColor: colors.neutral[100] },
  chipText: { fontSize: 15, fontWeight: '500', color: colors.neutral[900] },
  chipTextOn: { color: colors.neutral[0] },
  chipTextOff: { color: colors.neutral[500], textDecorationLine: 'line-through' },
  hint: { fontSize: 14, color: colors.neutral[500] },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  summary: { fontSize: 15, fontWeight: '600', color: colors.neutral[900], textAlign: 'center' },
})
