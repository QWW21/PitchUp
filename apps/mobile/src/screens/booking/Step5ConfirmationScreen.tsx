/**
 * Step 5: confirmation — E05-06 (UIUX_SPEC §7.5). The booking is read back
 * from the server, which also settles a Stripe payment the webhook has not
 * reported yet. No back button: Android's back closes the flow instead of
 * returning to the paid summary.
 *
 * The checkmark uses React Native's Animated rather than react-native-svg +
 * Reanimated (the ticket's choice): neither is installed, and this needs no
 * native code.
 */
import React, { useEffect, useRef } from 'react'
import { ActivityIndicator, Animated, BackHandler, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useQuery } from '@tanstack/react-query'
import { formatDateLong, formatDuration, paymentStatusLine } from '@pitchup/shared'
import { bookingApi } from '../../lib/bookingApi'
import { Button } from '../../components/ui/Button'
import { colors, spacing } from '../../theme/tokens'
import { BookingHeader } from './BookingHeader'
import type { BookingScreenProps } from './navigation'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../../App'

export function Step5ConfirmationScreen({
  navigation,
  route,
}: BookingScreenProps<'BookingConfirmation'>) {
  const insets = useSafeAreaInsets()
  const booking = useQuery({
    queryKey: ['booking', route.params.bookingId],
    queryFn: () => bookingApi.get(route.params.bookingId),
    // A Stripe payment can still be settling: look again every two seconds.
    refetchInterval: q => (q.state.data?.status === 'PENDING' ? 2000 : false),
  })

  const scale = useRef(new Animated.Value(0)).current
  const tick = useRef(new Animated.Value(0)).current

  const close = () => navigation.getParent()?.goBack()
  // The booking flow is a modal over the app stack: swap it for the booking.
  const viewBooking = () =>
    navigation
      .getParent<NativeStackNavigationProp<AppStackParamList>>()
      ?.replace('BookingDetail', { id: route.params.bookingId })

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close()
      return true
    })
    return () => sub.remove()
    // Registered once: close only reads navigation.
  }, [])

  // C-13: at a venue that confirms by hand, the paid booking waits for it.
  const waiting = booking.data?.status === 'AWAITING_APPROVAL'
  const confirmed = booking.data?.status === 'CONFIRMED' || waiting
  useEffect(() => {
    if (!confirmed) return
    Animated.sequence([
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(tick, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.05, duration: 400, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start()
  }, [confirmed, scale, tick])

  const b = booking.data
  return (
    <View style={styles.root}>
      <BookingHeader step={5} onBack={null} onClose={null} />
      <View style={styles.body}>
        {!b || b.status === 'PENDING' ? (
          <View style={styles.center} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primary[600]} />
            <Text style={styles.sub}>Confirming your payment…</Text>
          </View>
        ) : !confirmed ? (
          <View style={styles.center}>
            <Text style={styles.title}>The payment didn&apos;t go through</Text>
            <Text style={styles.sub}>{b.cancellationReason ?? 'Nothing was booked.'}</Text>
          </View>
        ) : (
          <>
            <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
              <Animated.View style={{ opacity: tick, transform: [{ scale: tick }] }}>
                <Icon name="check" size={48} color={colors.neutral[0]} />
              </Animated.View>
            </Animated.View>
            <Text style={styles.title} accessibilityRole="header">
              {waiting ? 'Sent to the venue' : 'Booking confirmed!'}
            </Text>
            <Text style={styles.sub}>
              {waiting
                ? `${b.company.name} confirms each booking. You'll be told when they answer; if they decline, all your money comes back.`
                : 'Get ready to play!'}
            </Text>
            <View style={styles.card}>
              <Text style={styles.reference}>{b.reference}</Text>
              <Text style={styles.pitch}>{b.pitch.name}</Text>
              <Text style={styles.sub}>{b.company.name}</Text>
              <Text style={styles.when}>
                {formatDateLong(b.date)}, {b.startTime}–{b.endTime} ({formatDuration(b.minutes)})
              </Text>
              {b.shirtSets > 0 ? (
                <Text style={styles.when}>
                  Free shirts: {b.shirtSets} {b.shirtSets === 1 ? 'set' : 'sets'}
                </Text>
              ) : null}
              <Text style={styles.paid}>{paymentStatusLine(b)}</Text>
            </View>
          </>
        )}
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="View my booking" onPress={viewBooking} disabled={!confirmed} />
        <Button label="Back to Discover" variant="ghost" onPress={close} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: spacing.lg,
    fontSize: 26,
    fontWeight: '700',
    color: colors.neutral[900],
    textAlign: 'center',
  },
  sub: { marginTop: spacing.sm, fontSize: 15, color: colors.neutral[500], textAlign: 'center' },
  card: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    backgroundColor: colors.neutral[50],
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  reference: { fontFamily: 'Courier New', fontSize: 12, color: colors.neutral[500] },
  pitch: { fontSize: 17, fontWeight: '600', color: colors.neutral[900] },
  when: { fontSize: 15, color: colors.neutral[700], textAlign: 'center' },
  paid: { marginTop: spacing.xs, fontSize: 14, fontWeight: '600', color: colors.primary[700] },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
})
