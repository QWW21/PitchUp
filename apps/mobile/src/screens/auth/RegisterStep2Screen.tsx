/**
 * Player registration step 2 — E02-03.
 * Collects date of birth, password, confirm password. Submits to the API.
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
import { register } from '../../lib/authApi'
import { ApiError } from '../../lib/apiClient'
import { colors, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AuthStackParamList, 'Register2'>

/** yyyy-MM-dd → true if user will be ≥16 today */
function isAtLeast16(dob: string): boolean {
  const date = new Date(`${dob}T00:00:00Z`)
  if (isNaN(date.getTime())) return false
  const now = new Date()
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 16, now.getUTCMonth(), now.getUTCDate()))
  return date <= cutoff
}

export function RegisterStep2Screen({ navigation, route }: Props) {
  const { name, email, phone, city } = route.params

  const [dob, setDob] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      e.dob = 'Use the format YYYY-MM-DD (e.g. 1995-06-15).'
    } else if (!isAtLeast16(dob)) {
      e.dob = 'You must be at least 16 years old to register.'
    }
    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      e.password = 'At least 8 characters, one uppercase letter, one number.'
    }
    if (confirm !== password) {
      e.confirm = 'Passwords do not match.'
    }
    return e
  }

  async function handleSubmit() {
    setApiError('')
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setLoading(true)
    try {
      await register({ name, email, phone, city, password, dateOfBirth: dob })
      navigation.replace('VerifyEmail', { email })
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(
          err.code === 'CONFLICT'
            ? 'That phone number is already registered. Try logging in instead.'
            : err.code === 'RATE_LIMITED'
              ? 'Too many attempts. Try again in an hour.'
              : 'Could not create your account. Please try again.'
        )
      } else {
        setApiError('Could not connect. Check your internet and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.wordmark}>PitchUp</Text>
        <Text style={styles.heading}>Almost there</Text>

        <View style={styles.stepRow}>
          {[1, 2].map(n => (
            <View key={n} style={[styles.stepDot, styles.stepDotActive]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>Step 2 of 2 — Security</Text>

        <View style={styles.form}>
          <Input
            label="Date of birth"
            value={dob}
            onChangeText={setDob}
            placeholder="1995-06-15"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            error={errors.dob}
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            error={errors.password}
            rightElement={
              <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                <Text style={styles.toggle}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            }
          />
          <Input
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            error={errors.confirm}
          />

          {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}
        </View>

        <Button label="Create account" onPress={handleSubmit} loading={loading} />
        <Button
          label="Back"
          variant="ghost"
          onPress={() => navigation.goBack()}
          fullWidth={false}
        />
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
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stepDot: { width: 32, height: 6, borderRadius: 3, backgroundColor: colors.neutral[200] },
  stepDotActive: { backgroundColor: colors.primary[600] },
  stepLabel: { fontSize: 13, color: colors.neutral[500], textAlign: 'center' },
  form: { gap: spacing.md, marginTop: spacing.sm },
  toggle: { fontSize: 13, color: colors.primary[600], fontWeight: '500' },
  apiError: { fontSize: 14, color: colors.error[600], textAlign: 'center' },
})
