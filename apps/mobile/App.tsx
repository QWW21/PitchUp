/**
 * PitchUp mobile entry point — E02-01 through E02-12.
 *
 * Navigation structure:
 *   AuthStack  — shown while unauthenticated (Login, Register, Verify, etc.)
 *   AppStack   — shown while authenticated (Home, …)
 *
 * Which stack is rendered is driven purely by authStore.status so that any
 * part of the app can trigger a logout and navigation reacts automatically.
 */
import React, { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors } from './src/theme/tokens'
import { authEvents } from './src/lib/authEvents'
import { useAuthStore } from './src/stores/authStore'
import { ONBOARDING_SEEN_KEY, OnboardingScreen } from './src/screens/auth/OnboardingScreen'
import { LoginScreen } from './src/screens/auth/LoginScreen'
import { RegisterStep1Screen } from './src/screens/auth/RegisterStep1Screen'
import { RegisterStep2Screen } from './src/screens/auth/RegisterStep2Screen'
import { VerifyEmailScreen } from './src/screens/auth/VerifyEmailScreen'
import { ForgotPasswordScreen } from './src/screens/auth/ForgotPasswordScreen'
import { SocialLoginScreen } from './src/screens/auth/SocialLoginScreen'
import { HomeScreen } from './src/screens/app/HomeScreen'

// ---------------------------------------------------------------------------
// Navigation param types — exported so screen files can import them without
// creating a circular dependency through App.tsx.
// ---------------------------------------------------------------------------
export type AuthStackParamList = {
  Onboarding: undefined
  Login: undefined
  Register1: undefined
  Register2: { name: string; email: string; phone: string; city: string }
  VerifyEmail: { email: string }
  ForgotPassword: undefined
  SocialLogin: undefined
}

export type AppStackParamList = {
  Home: undefined
}

const AuthStack = createNativeStackNavigator<AuthStackParamList>()
const AppStack = createNativeStackNavigator<AppStackParamList>()

function AuthNavigator({ showOnboarding }: { showOnboarding: boolean }) {
  return (
    <AuthStack.Navigator
      initialRouteName={showOnboarding ? 'Onboarding' : 'Login'}
      screenOptions={{ headerShown: false }}
    >
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register1" component={RegisterStep1Screen} />
      <AuthStack.Screen name="Register2" component={RegisterStep2Screen} />
      <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="SocialLogin" component={SocialLoginScreen} />
    </AuthStack.Navigator>
  )
}

function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Home" component={HomeScreen} />
    </AppStack.Navigator>
  )
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export default function App() {
  const { status, checkSession, logout } = useAuthStore()
  const [showOnboarding, setShowOnboarding] = React.useState<boolean | null>(null)

  // Run token validation and onboarding check in parallel on mount.
  useEffect(() => {
    checkSession()
    AsyncStorage.getItem(ONBOARDING_SEEN_KEY).then(value => {
      setShowOnboarding(value !== '1')
    })
  }, [checkSession])

  // Any 401 that exhausts the refresh cycle lands here.
  useEffect(() => {
    return authEvents.onUnauthorized(() => {
      logout()
    })
  }, [logout])

  // Wait until both status and onboarding flag are resolved before rendering.
  if (status === 'unknown' || showOnboarding === null) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {status === 'authenticated' ? (
          <AppNavigator />
        ) : (
          <AuthNavigator showOnboarding={showOnboarding} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
  },
})
