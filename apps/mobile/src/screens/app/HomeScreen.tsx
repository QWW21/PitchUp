/**
 * Home — placeholder. Real home screen arrives in pitch browsing tickets.
 */
import React from 'react'
import { Pressable, SafeAreaView, StyleSheet, Text } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../../App'
import { useAuthStore } from '../../stores/authStore'
import { colors, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>

export function HomeScreen(_props: Props) {
  const { user, logout } = useAuthStore()

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.wordmark}>PitchUp</Text>
      <Text style={styles.greeting}>Hello, {user?.name ?? 'Player'} 👋</Text>
      <Text style={styles.caption}>Pitch browsing coming soon.</Text>
      <Pressable onPress={logout} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    gap: spacing.md,
  },
  wordmark: { fontSize: 28, fontWeight: '800', color: colors.primary[600] },
  greeting: { fontSize: 20, fontWeight: '600', color: colors.neutral[900] },
  caption: { fontSize: 15, color: colors.neutral[500] },
  logoutBtn: { marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  logoutText: { fontSize: 15, color: colors.error[600], fontWeight: '600' },
})
