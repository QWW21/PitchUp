/**
 * Placeholder for the booking flow (E05), so Book Now and the availability
 * days have a real route to open with their parameters.
 */
import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../../App'
import { colors } from '../../theme/tokens'

type Props = NativeStackScreenProps<AppStackParamList, 'BookingFlow'>

export function BookingFlowScreen({ route, navigation }: Props) {
  const { pitchName, companyName, date } = route.params
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Booking is coming soon</Text>
      <Text style={styles.body}>
        {pitchName} · {companyName}
        {date ? `\n${date}` : ''}
      </Text>
      <Text style={styles.body}>The booking flow is built in E05.</Text>
      <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
        <Text style={styles.back}>Back</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 20, fontWeight: '600', color: colors.neutral[900] },
  body: { fontSize: 14, color: colors.neutral[500], textAlign: 'center' },
  back: { marginTop: 12, fontSize: 15, fontWeight: '600', color: colors.primary[600] },
})
