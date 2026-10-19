/**
 * Login — E02-05.
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
import { googleSignIn, login } from '../../lib/authApi'
import { ApiError } from '../../lib/apiClient'
import { googleIdToken } from '../../lib/google'
import { useAuthStore } from '../../stores/authStore'
import { colors, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>

export function LoginScreen({ navigation }: Props) {
  const setUser = useAuthStore(s => s.setUser)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleLogin() {
    setError('')
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    try {
      const user = await login({ email: trimmedEmail, password })
      setUser(user)
      // Navigation happens automatically: App.tsx watches status and swaps to AppNavigator.
    } catch (e) {
      if (e instanceof ApiError) {
        setError(
          e.code === 'RATE_LIMITED'
            ? 'Too many attempts. Try again in a few minutes.'
            : 'Incorrect email or password.'
        )
      } else {
        setError('Could not connect. Check your internet and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  /** E02-07: a known address signs in; a new one finishes on SocialLogin. */
  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    try {
      const idToken = await googleIdToken()
      if (!idToken) return
      const result = await googleSignIn({ idToken })
      if (result.status === 'SIGNED_IN') setUser(result.user)
      else navigation.push('SocialLogin', { idToken, name: result.name, email: result.email })
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.code === 'FORBIDDEN'
            ? 'This account is not available.'
            : e.code === 'RATE_LIMITED'
              ? 'Too many attempts. Try again in a few minutes.'
              : 'Google sign-in did not work. Try again, or use your email.'
          : 'Could not reach Google. Check your internet and try again.'
      )
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.wordmark}>PitchUp</Text>
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to your account</Text>

        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            textContentType="emailAddress"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            textContentType="password"
            rightElement={
              <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                <Text style={styles.toggle}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            }
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={() => navigation.push('ForgotPassword')}>
            <Text style={styles.forgot}>Forgot password?</Text>
          </Pressable>
        </View>

        <Button label="Sign in" onPress={handleLogin} loading={loading} />

        <View style={styles.dividerRow}>
          <View style={styles.line} />
          <Text style={styles.or}>or</Text>
          <View style={styles.line} />
        </View>

        <Button
          label="Continue with Google"
          variant="secondary"
          onPress={handleGoogle}
          loading={googleLoading}
        />

        <Pressable onPress={() => navigation.push('Register1')} style={styles.registerRow}>
          <Text style={styles.registerText}>
            Don't have an account? <Text style={styles.registerLink}>Sign up</Text>
          </Text>
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
    marginBottom: spacing.xl,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.neutral[900],
    textAlign: 'center',
  },
  sub: { fontSize: 15, color: colors.neutral[500], textAlign: 'center' },
  form: { gap: spacing.md, marginTop: spacing.sm },
  toggle: { fontSize: 13, color: colors.primary[600], fontWeight: '500' },
  error: { fontSize: 14, color: colors.error[600], textAlign: 'center' },
  forgot: { fontSize: 14, color: colors.primary[600], textAlign: 'right', fontWeight: '500' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.neutral[200] },
  or: { fontSize: 13, color: colors.neutral[400] },
  registerRow: { alignItems: 'center', marginTop: spacing.sm },
  registerText: { fontSize: 14, color: colors.neutral[500] },
  registerLink: { color: colors.primary[600], fontWeight: '600' },
})
