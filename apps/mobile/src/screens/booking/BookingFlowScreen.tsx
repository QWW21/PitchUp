/**
 * The booking flow — E05-01. A full-screen modal holding its own stack of
 * five steps. Opened from Book Now (or an availability day, which pre-picks
 * the date) with the pitch's id; the rest of the pitch comes from the cache
 * the pitch screen already filled.
 */
import React, { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { StripeProvider } from '@stripe/stripe-react-native'
import type { ShirtColour } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { usePitch } from '../../hooks/useVenue'
import { bookingApi } from '../../lib/bookingApi'
import { useBookingStore } from '../../stores/bookingStore'
import { ErrorState } from '../../components/common/ErrorState'
import { colors } from '../../theme/tokens'
import type { BookingStackParamList } from './navigation'
import { Step1DateScreen } from './Step1DateScreen'
import { Step2TimeScreen } from './Step2TimeScreen'
import { Step3TeamsScreen } from './Step3TeamsScreen'
import { Step4SummaryScreen } from './Step4SummaryScreen'
import { Step5ConfirmationScreen } from './Step5ConfirmationScreen'

const Stack = createNativeStackNavigator<BookingStackParamList>()

type Props = NativeStackScreenProps<AppStackParamList, 'BookingFlow'>

export function BookingFlowScreen({ route }: Props) {
  const { pitchId, date } = route.params
  const pitch = usePitch(pitchId)
  const config = useQuery({ queryKey: ['payment-config'], queryFn: bookingApi.paymentConfig })
  const start = useBookingStore(s => s.start)
  const reset = useBookingStore(s => s.reset)
  const ready = useBookingStore(s => s.pitch?.id === pitchId)

  useEffect(() => {
    const p = pitch.data
    if (!p) return
    start(
      {
        id: p.id,
        name: p.name,
        companyName: p.company.name,
        hourlyRate: p.hourlyRate,
        size: p.size,
        hasShirts: p.hasShirts,
        shirtStock: p.shirtInventory.map(s => ({
          colour: s.colour as ShirtColour,
          quantity: s.quantity,
        })),
        minBookingHours: p.minBookingHours,
        maxBookingHours: p.maxBookingHours,
        advanceBookingDays: p.advanceBookingDays,
      },
      date
    )
  }, [pitch.data, date, start])

  // Closing the flow (Discard, Back to Discover, back) forgets the booking.
  useEffect(() => reset, [reset])

  if (pitch.isError || config.isError) {
    return <ErrorState onRetry={() => (pitch.isError ? pitch.refetch() : config.refetch())} />
  }
  if (!ready || !config.data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary[600]} />
      </View>
    )
  }

  const steps = (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="BookingDate" component={Step1DateScreen} />
      <Stack.Screen name="BookingTime" component={Step2TimeScreen} />
      <Stack.Screen name="BookingTeams" component={Step3TeamsScreen} />
      <Stack.Screen name="BookingSummary" component={Step4SummaryScreen} />
      {/* No way back from a confirmed booking: back closes the flow. */}
      <Stack.Screen
        name="BookingConfirmation"
        component={Step5ConfirmationScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  )

  // Card entry needs the Stripe SDK only when Stripe is the provider.
  return config.data.provider === 'stripe' && config.data.publishableKey ? (
    <StripeProvider publishableKey={config.data.publishableKey}>{steps}</StripeProvider>
  ) : (
    steps
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
