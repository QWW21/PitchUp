/**
 * Placeholder so Discover's cards and map preview have somewhere to go.
 * The real company detail screen is E04 (Player: Pitch Detail).
 */
import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../../App'
import { colors } from '../../theme/tokens'

type Props = NativeStackScreenProps<AppStackParamList, 'CompanyDetail'>

export function CompanyDetailScreen({ route, navigation }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>{route.params.name ?? 'Company'}</Text>
      <Text style={styles.body}>Company details are coming in E04.</Text>
      <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
        <Text style={styles.back}>Back to Discover</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 20, fontWeight: '600', color: colors.neutral[900], textAlign: 'center' },
  body: { fontSize: 14, color: colors.neutral[500] },
  back: { marginTop: 12, fontSize: 15, fontWeight: '600', color: colors.primary[600] },
})
