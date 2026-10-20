/**
 * Forgot password — E02-06.
 *
 * The API always returns the same message regardless of whether the email is
 * registered, so the UI mirrors that — one success state for all outcomes.
 */
import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../../App'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { forgotPassword } from '../../lib/authApi'
import { ApiError } from '../../lib/apiClient'
import { colors, spacing } from '../../theme/tokens'
import { useT } from '../../i18n'

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>

export function ForgotPasswordScreen({ navigation }: Props) {
  const t = useT()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit() {
    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t('auth.forgot.badEmail'))
      return
    }
    setError('')
    setLoading(true)
    try {
      await forgotPassword(trimmed)
      setSent(true)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'RATE_LIMITED') {
        setError(t('auth.forgot.tooMany'))
      } else {
        // On network error still show success — avoids revealing account existence.
        setSent(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <View style={styles.sentRoot}>
        <Text style={styles.wordmark}>PitchUp</Text>
        <Text style={styles.sentEmoji}>📬</Text>
        <Text style={styles.sentHeading}>{t('auth.forgot.inbox')}</Text>
        <Text style={styles.sentSub}>{t('auth.forgot.sent')}</Text>
        <Button label={t('auth.forgot.backToLogin')} onPress={() => navigation.navigate('Login')} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.wordmark}>PitchUp</Text>
        <Text style={styles.heading}>{t('auth.forgot.heading')}</Text>
        <Text style={styles.sub}>{t('auth.forgot.sub')}</Text>

        <View style={styles.form}>
          <Input
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            textContentType="emailAddress"
            error={error}
          />
        </View>

        <Button label={t('auth.forgot.send')} onPress={handleSubmit} loading={loading} />
        <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
          <Text style={styles.backText}>{t('auth.backToLogin')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.neutral[0] },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary[600],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  heading: { fontSize: 24, fontWeight: '700', color: colors.neutral[900], textAlign: 'center' },
  sub: { fontSize: 15, color: colors.neutral[500], textAlign: 'center', lineHeight: 22 },
  form: { marginTop: spacing.sm },
  backRow: { alignItems: 'center', marginTop: spacing.sm },
  backText: { fontSize: 14, color: colors.neutral[500] },
  // Sent state
  sentRoot: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    gap: spacing.md,
    alignItems: 'center',
  },
  sentEmoji: { fontSize: 64, marginTop: spacing.xl },
  sentHeading: { fontSize: 24, fontWeight: '700', color: colors.neutral[900], textAlign: 'center' },
  sentSub: { fontSize: 15, color: colors.neutral[500], textAlign: 'center', lineHeight: 22 },
})
