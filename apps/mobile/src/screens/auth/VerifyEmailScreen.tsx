/**
 * Email verification (OTP) — E02-04.
 *
 * Shows 6 digit boxes backed by a single hidden TextInput. Resend link
 * has a 60-second cooldown to mirror the server's per-recipient throttle.
 */
import React, { useEffect, useRef, useState } from 'react'
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
import { OtpInput } from '../../components/ui/OtpInput'
import { verifyEmail, resendCode } from '../../lib/authApi'
import { ApiError } from '../../lib/apiClient'
import { colors, spacing } from '../../theme/tokens'
import { useT } from '../../i18n'

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>

const RESEND_COOLDOWN = 60

export function VerifyEmailScreen({ navigation, route }: Props) {
  const t = useT()
  const { email } = route.params

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN)
    timerRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current)
    },
    []
  )

  async function handleVerify() {
    if (code.length < 6) {
      setError(t('auth.verify.enterCode'))
      return
    }
    setError('')
    setLoading(true)
    try {
      await verifyEmail(email, code)
      navigation.replace('Login')
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.code === 'RATE_LIMITED' ? t('auth.verify.tooMany') : t('auth.verify.wrong'))
      } else {
        setError(t('auth.connection'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResendLoading(true)
    setError('')
    try {
      await resendCode(email, 'EMAIL')
      startCooldown()
    } catch {
      setError(t('auth.verify.resendFailed'))
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.wordmark}>PitchUp</Text>
        <Text style={styles.heading}>{t('auth.verify.heading')}</Text>
        <Text style={styles.sub}>
          {t('auth.verify.sent')}
          {'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>

        <View style={styles.otpWrapper}>
          <OtpInput value={code} onChange={setCode} error={!!error} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label={t('auth.verify.verify')} onPress={handleVerify} loading={loading} />

        <View style={styles.resendRow}>
          <Text style={styles.resendText}>{t('auth.verify.noCode')}</Text>
          {cooldown > 0 ? (
            <Text style={styles.cooldown}>{t('auth.verify.resendIn', { n: cooldown })}</Text>
          ) : (
            <Pressable onPress={handleResend} disabled={resendLoading}>
              <Text style={styles.resendLink}>
                {resendLoading ? t('auth.verify.sending') : t('auth.verify.resend')}
              </Text>
            </Pressable>
          )}
        </View>

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.backRow}>
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
  email: { fontWeight: '600', color: colors.neutral[700] },
  otpWrapper: { paddingVertical: spacing.lg },
  error: { fontSize: 14, color: colors.error[600], textAlign: 'center' },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendText: { fontSize: 14, color: colors.neutral[500] },
  resendLink: { fontSize: 14, color: colors.primary[600], fontWeight: '600' },
  cooldown: { fontSize: 14, color: colors.neutral[400] },
  backRow: { alignItems: 'center', marginTop: spacing.sm },
  backText: { fontSize: 14, color: colors.neutral[500] },
})
