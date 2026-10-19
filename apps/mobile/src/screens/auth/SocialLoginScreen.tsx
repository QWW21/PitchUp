/**
 * Google sign-up, the last step — E02-07.
 *
 * Google has confirmed the name and email; PitchUp also needs a phone, a city
 * and a date of birth (the same rules as registering with a password). The
 * Google token from the login screen is sent again with them, and the new
 * account is signed straight in: the email needs no code.
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
import { CITY_NAMES, GoogleSignInSchema } from '@pitchup/shared'
import type { AuthStackParamList } from '../../../App'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { googleSignIn } from '../../lib/authApi'
import { ApiError } from '../../lib/apiClient'
import { useAuthStore } from '../../stores/authStore'
import { colors, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AuthStackParamList, 'SocialLogin'>
type Field = 'phone' | 'city' | 'dateOfBirth'

export function SocialLoginScreen({ navigation, route }: Props) {
  const { idToken, name, email } = route.params
  const setUser = useAuthStore(s => s.setUser)
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setApiError('')
    const parsed = GoogleSignInSchema.safeParse({
      idToken,
      profile: { phone: phone.trim(), city, dateOfBirth: dateOfBirth.trim() },
    })
    if (!parsed.success) {
      const found: Partial<Record<Field, string>> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[1] as Field | undefined
        if (field && !found[field]) found[field] = issue.message
      }
      if (!city) found.city = 'Select your city.'
      setErrors(found)
      return
    }
    setErrors({})
    setLoading(true)
    try {
      const result = await googleSignIn(parsed.data)
      if (result.status === 'SIGNED_IN') setUser(result.user)
      else setApiError('Could not create your account. Please try again.')
    } catch (e) {
      setApiError(
        e instanceof ApiError
          ? e.code === 'CONFLICT'
            ? 'That phone number is already registered. Sign in with your email instead.'
            : e.code === 'UNAUTHORIZED'
              ? 'Your Google sign-in expired. Go back and try again.'
              : 'Could not create your account. Please try again.'
          : 'Could not connect. Check your internet and try again.'
      )
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
        <Text style={styles.heading} accessibilityRole="header">
          Almost there{name ? `, ${name.split(' ')[0]}` : ''}
        </Text>
        <Text style={styles.sub}>
          You&apos;re signing up with {email}. We need a few more details to book pitches.
        </Text>

        <View style={styles.form}>
          <Input
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+40712345678"
            keyboardType="phone-pad"
            autoComplete="tel"
            {...(errors.phone ? { error: errors.phone } : {})}
          />
          <View style={styles.gap}>
            <Text style={styles.label}>City</Text>
            <View style={styles.cities} accessibilityRole="radiogroup" accessibilityLabel="City">
              {CITY_NAMES.map(c => (
                <Pressable
                  key={c}
                  onPress={() => setCity(c)}
                  style={[styles.city, city === c && styles.cityOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: city === c }}
                >
                  <Text style={[styles.cityText, city === c && styles.cityTextOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            {errors.city ? <Text style={styles.error}>{errors.city}</Text> : null}
          </View>
          <Input
            label="Date of birth"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="1995-06-15"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            {...(errors.dateOfBirth ? { error: errors.dateOfBirth } : {})}
          />
          {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}
        </View>

        <Button label="Create account" onPress={submit} loading={loading} />
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
  sub: { fontSize: 15, color: colors.neutral[500], textAlign: 'center', lineHeight: 22 },
  form: { gap: spacing.md, marginTop: spacing.sm },
  gap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[700] },
  error: { fontSize: 13, color: colors.error[600] },
  apiError: { fontSize: 14, color: colors.error[600], textAlign: 'center' },
  cities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  city: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cityOn: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  cityText: { fontSize: 14, color: colors.neutral[700] },
  cityTextOn: { color: colors.neutral[0], fontWeight: '600' },
})
