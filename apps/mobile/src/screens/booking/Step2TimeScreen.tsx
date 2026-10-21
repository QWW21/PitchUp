/**
 * Step 2: the time — C-6 (replacing E05-03's grid). First how long, then a
 * start time, grouped into morning, afternoon and evening. Only starts with
 * room for the whole length can be picked, so the length chosen is the
 * length booked. Which lengths and starts are possible comes from
 * @pitchup/shared (durationChoices, startOptions), the same rules as the web.
 */
import React, { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useQuery } from '@tanstack/react-query'
import {
  bookingPrice,
  durationChoices,
  formatShortDuration,
  rangeFrom,
  rangeTimes,
  startOptions,
  type AirType,
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
  const savedAir = useBookingStore(s => s.airType)
  const setTime = useBookingStore(s => s.setTime)
  const [minutes, setMinutes] = useState<number | null>(null)
  const [startTime, setStartTime] = useState<string | null>(null)
  const [pickedAir, setAir] = useState<AirType | null>(null)

  const day = useQuery({
    queryKey: ['booking-slots', pitch.id, date],
    queryFn: () => bookingApi.day(pitch.id, date),
    staleTime: 0,
  })
  const slots = day.data?.slots ?? []
  // C-14: on a covered day, the air on offer; cold first and by default.
  const airOptions = day.data?.airOptions ?? []
  const air = airOptions.find(o => o.airType === (pickedAir ?? savedAir)) ?? airOptions[0] ?? null
  const rate = air?.hourlyRate ?? day.data?.hourlyRate ?? pitch.hourlyRate
  const minMinutes = pitch.minBookingHours * 60
  const maxMinutes = pitch.maxBookingHours * 60
  const durations = durationChoices(slots, minMinutes, maxMinutes)
  // Starts are judged against the chosen length. Kept as a time, not a
  // position in the list, so a refreshed list can never move it.
  const starts = startOptions(slots, minutes ?? minMinutes)
  const startIndex = starts.findIndex(s => s.time === startTime && s.state === 'available')

  // The length starts at the one chosen before, if it still fits somewhere,
  // else the shortest that does; a start chosen before comes back if free.
  useEffect(() => {
    if (!slots.length || minutes !== null) return
    const fitting = durationChoices(slots, minMinutes, maxMinutes).filter(d => d.fits)
    const length = fitting.find(d => d.minutes === savedMinutes)?.minutes ?? fitting[0]?.minutes
    if (length === undefined) return
    setMinutes(length)
    if (
      savedStart &&
      startOptions(slots, length).some(s => s.time === savedStart && s.state === 'available')
    ) {
      setStartTime(savedStart)
    }
  }, [slots, minutes, savedStart, savedMinutes, minMinutes, maxMinutes])

  const pickLength = (m: number) => {
    setMinutes(m)
    // A start without room for the new length is let go, never shortened.
    if (!startOptions(slots, m).some(s => s.time === startTime && s.state === 'available')) {
      setStartTime(null)
    }
  }

  const chosen =
    startIndex >= 0 && minutes !== null ? rangeTimes(slots, rangeFrom(startIndex, minutes)) : null
  const price = chosen ? bookingPrice(rate, chosen.minutes) : null
  const noneFree =
    day.isSuccess && !startOptions(slots, minMinutes).some(s => s.state === 'available')

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
          {airOptions.length === 1 && air ? (
            <Text style={styles.covered}>
              {t('booking.time.coveredDay', {
                covered: t('covered'),
                air: t(`air.${air.airType}`),
                rate: air.hourlyRate,
              })}
            </Text>
          ) : null}
          {airOptions.length > 1 ? (
            <>
              <Text style={styles.heading}>{t('booking.time.airHeading')}</Text>
              <Text style={styles.hint}>{t('booking.time.airHint')}</Text>
              <View style={styles.chips}>
                {airOptions.map(o => {
                  const label = t('booking.time.airOption', {
                    air: t(`air.${o.airType}`),
                    rate: o.hourlyRate,
                  })
                  return (
                    <Chip
                      key={o.airType}
                      label={label}
                      accessibilityLabel={label}
                      on={air?.airType === o.airType}
                      disabled={false}
                      onPress={() => setAir(o.airType)}
                    />
                  )
                })}
              </View>
            </>
          ) : null}
          <Text style={styles.heading}>{t('booking.time.howLong')}</Text>
          <View style={styles.chips}>
            {durations.map(d => (
              <Chip
                key={d.minutes}
                label={formatShortDuration(d.minutes)}
                accessibilityLabel={`${formatShortDuration(d.minutes)}${d.fits ? '' : t('booking.time.noFit')}`}
                on={minutes === d.minutes}
                disabled={!d.fits}
                onPress={() => pickLength(d.minutes)}
              />
            ))}
          </View>
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
                      accessibilityLabel={`${o.time}, ${startIndex === o.index ? t('booking.time.selected') : t(`booking.time.state.${o.state}`)}`}
                      on={startIndex === o.index}
                      disabled={o.state !== 'available'}
                      onPress={() => setStartTime(o.time)}
                    />
                  ))}
                </View>
              </View>
            )
          })}
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
            setTime(chosen.startTime, chosen.endTime, chosen.minutes, {
              airType: air?.airType ?? null,
              rate,
            })
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
  covered: {
    fontSize: 14,
    color: colors.neutral[900],
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.neutral[50],
  },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  summary: { fontSize: 15, fontWeight: '600', color: colors.neutral[900], textAlign: 'center' },
})
