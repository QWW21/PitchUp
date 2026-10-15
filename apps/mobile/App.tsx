/**
 * PitchUp mobile entry point — E02-01 through E02-12.
 *
 * Navigation structure:
 *   AuthStack  — shown while unauthenticated (Login, Register, Verify, etc.)
 *   AppStack   — shown while authenticated (Discover, CompanyDetail, …)
 *
 * Which stack is rendered is driven purely by authStore.status so that any
 * part of the app can trigger a logout and navigation reacts automatically.
 */
import React, { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
import { DiscoverScreen } from './src/screens/discover/DiscoverScreen'
import { CompanyDetailScreen } from './src/screens/discover/CompanyDetailScreen'
import { PitchDetailScreen } from './src/screens/discover/PitchDetailScreen'
import { BookingFlowScreen } from './src/screens/booking/BookingFlowScreen'
import { MyBookingsScreen } from './src/screens/bookings/MyBookingsScreen'
import { BookingDetailScreen } from './src/screens/bookings/BookingDetailScreen'
import { ReviewScreen } from './src/screens/bookings/ReviewScreen'
import type { BookingTab } from '@pitchup/shared'

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
  Discover: undefined
  /** `name` lets the screen show a title before its own data loads. */
  CompanyDetail: {
    id: string
    name?: string
    /** "See all reviews" on a pitch opens here, filtered to that pitch. */
    initialTab?: 'pitches' | 'reviews'
    pitchId?: string | undefined
  }
  PitchDetail: { pitchId: string; companyId: string }
  /** E05. Opened from Book Now or an availability day. */
  BookingFlow: {
    pitchId: string
    pitchName: string
    companyName: string
    hourlyRate: number
    date?: string
  }
  /** E06. */
  /** `notice` is shown as a toast, e.g. after a cancellation. */
  MyBookings: { tab?: BookingTab; notice?: string } | undefined
  BookingDetail: { id: string }
  Review: { bookingId: string }
}

const AuthStack = createNativeStackNavigator<AuthStackParamList>()
const queryClient = new QueryClient()
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
      <AppStack.Screen name="Discover" component={DiscoverScreen} />
      <AppStack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
      <AppStack.Screen name="PitchDetail" component={PitchDetailScreen} />
      <AppStack.Screen
        name="BookingFlow"
        component={BookingFlowScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <AppStack.Screen name="MyBookings" component={MyBookingsScreen} />
      <AppStack.Screen name="BookingDetail" component={BookingDetailScreen} />
      <AppStack.Screen name="Review" component={ReviewScreen} />
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
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          {status === 'authenticated' ? (
            <AppNavigator />
          ) : (
            <AuthNavigator showOnboarding={showOnboarding} />
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
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
