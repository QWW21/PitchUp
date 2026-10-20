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
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors } from './src/theme/tokens'
import { authEvents } from './src/lib/authEvents'
import { startPush } from './src/lib/push'
import { useAuthStore } from './src/stores/authStore'
import { useLocaleStore } from './src/stores/localeStore'
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
import { MyReviewsScreen } from './src/screens/bookings/MyReviewsScreen'
import { ProfileScreen } from './src/screens/profile/ProfileScreen'
import { TrustScoreDetailScreen } from './src/screens/profile/TrustScoreDetailScreen'
import { EditProfileScreen } from './src/screens/profile/EditProfileScreen'
import { VerifyPhoneScreen } from './src/screens/profile/VerifyPhoneScreen'
import { ChangePasswordScreen } from './src/screens/profile/ChangePasswordScreen'
import { DeleteAccountScreen } from './src/screens/profile/DeleteAccountScreen'
import { PaymentMethodsScreen } from './src/screens/profile/PaymentMethodsScreen'
import { NotificationsScreen } from './src/screens/notifications/NotificationsScreen'
import { NotificationSettingsScreen } from './src/screens/profile/NotificationSettingsScreen'
import { ManagerBookingsScreen } from './src/screens/manager/ManagerBookingsScreen'
import { ManagerBookingDetailScreen } from './src/screens/manager/ManagerBookingDetailScreen'
import type { AnalyticsPeriod, BookingTab } from '@pitchup/shared'
import { ManagerAnalyticsScreen } from './src/screens/manager/ManagerAnalyticsScreen'
import { ManagerPitchPerformanceScreen } from './src/screens/manager/ManagerPitchPerformanceScreen'

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
  /** E02-07: the last step of a Google sign-up. */
  SocialLogin: { idToken: string; name: string; email: string }
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
  /** E07-06. */
  MyReviews: undefined
  /** E08. Opened from the Discover header until there is a tab bar. */
  Profile: undefined
  TrustScore: undefined
  EditProfile: undefined
  /** #163: texted code for the number on the account. */
  VerifyPhone: { phone: string }
  ChangePassword: undefined
  DeleteAccount: undefined
  PaymentMethods: undefined
  Notifications: undefined
  /** E13-09. */
  NotificationSettings: undefined
  /** E11-09. A venue manager's bookings, opened from Profile. */
  ManagerBookings: undefined
  ManagerBookingDetail: { id: string }
  /** E14-10. The venue's analytics, opened from Profile. */
  ManagerAnalytics: undefined
  ManagerPitchPerformance: { period: AnalyticsPeriod }
}

const AuthStack = createNativeStackNavigator<AuthStackParamList>()
const queryClient = new QueryClient()
const AppStack = createNativeStackNavigator<AppStackParamList>()

/** Lets a tapped push navigate from outside any screen. */
const navigation = createNavigationContainerRef<AppStackParamList>()
const pushNavigator = {
  navigate: (screen: string, params?: object) => {
    // Screen names come from @pitchup/shared's notificationTarget, as strings.
    const go = navigation.navigate as (name: string, params?: object) => void
    if (navigation.isReady()) go(screen, params)
  },
}

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
      <AppStack.Screen name="MyReviews" component={MyReviewsScreen} />
      <AppStack.Screen name="Profile" component={ProfileScreen} />
      <AppStack.Screen name="TrustScore" component={TrustScoreDetailScreen} />
      <AppStack.Screen name="EditProfile" component={EditProfileScreen} />
      <AppStack.Screen name="VerifyPhone" component={VerifyPhoneScreen} />
      <AppStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <AppStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <AppStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <AppStack.Screen name="Notifications" component={NotificationsScreen} />
      <AppStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <AppStack.Screen name="ManagerBookings" component={ManagerBookingsScreen} />
      <AppStack.Screen name="ManagerBookingDetail" component={ManagerBookingDetailScreen} />
      <AppStack.Screen name="ManagerAnalytics" component={ManagerAnalyticsScreen} />
      <AppStack.Screen name="ManagerPitchPerformance" component={ManagerPitchPerformanceScreen} />
    </AppStack.Navigator>
  )
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export default function App() {
  const { status, checkSession, logout } = useAuthStore()
  const [showOnboarding, setShowOnboarding] = React.useState<boolean | null>(null)

  // Token validation, the onboarding flag and the saved language, in
  // parallel on mount; the language first, so the first screen is in it.
  useEffect(() => {
    checkSession()
    void Promise.all([
      AsyncStorage.getItem(ONBOARDING_SEEN_KEY),
      useLocaleStore.getState().load(),
    ]).then(([seen]) => setShowOnboarding(seen !== '1'))
  }, [checkSession])

  // Any 401 that exhausts the refresh cycle lands here.
  useEffect(() => {
    return authEvents.onUnauthorized(() => {
      logout()
    })
  }, [logout])

  // E08-10: push for whoever is signed in, from the moment the app's screens
  // can be navigated to (a push that launched the app opens its screen).
  const [navReady, setNavReady] = React.useState(false)
  useEffect(() => {
    if (status !== 'authenticated' || !navReady) return
    let stop: (() => void) | undefined
    let cancelled = false
    startPush(pushNavigator)
      .then(off => (cancelled ? off() : (stop = off)))
      .catch(caught => console.warn('[push] Could not start:', caught))
    return () => {
      cancelled = true
      stop?.()
    }
  }, [status, navReady])

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
        <NavigationContainer ref={navigation} onReady={() => setNavReady(true)}>
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
