/**
 * Social login — E02-07.
 *
 * Google Sign-In requires adding @react-native-google-signin/google-signin
 * and native configuration (GoogleService-Info.plist / google-services.json),
 * which needs credentials that aren't available in this phase. This screen
 * is a placeholder that will be replaced when those credentials land.
 */
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../../App'
import { colors, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AuthStackParamList, 'SocialLogin'>

export function SocialLoginScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.wordmark}>PitchUp</Text>
      <Text style={styles.emoji}>🔜</Text>
      <Text style={styles.heading}>Google Sign-In</Text>
      <Text style={styles.body}>
        Social login is coming soon. It requires native configuration (OAuth credentials,
        GoogleService-Info.plist / google-services.json) that will be added in a later ticket.
      </Text>
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>← Back to login</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  wordmark: { fontSize: 28, fontWeight: '800', color: colors.primary[600] },
  emoji: { fontSize: 64, marginTop: spacing.xl },
  heading: { fontSize: 24, fontWeight: '700', color: colors.neutral[900] },
  body: { fontSize: 15, color: colors.neutral[500], textAlign: 'center', lineHeight: 22 },
  back: { marginTop: spacing.lg },
  backText: { fontSize: 14, color: colors.neutral[500] },
})
