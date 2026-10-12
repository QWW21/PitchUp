/**
 * PitchUp mobile entry point — ticket E02-12.
 *
 * Wires navigation and session checking. Actual screens arrive in E02-01..07;
 * this file just decides which navigator to show based on auth state, and
 * forwards unauthorised signals from the API client to the navigation layer.
 */
import React, { useEffect, useRef } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { colors } from './src/theme/tokens'
import { authEvents } from './src/lib/authEvents'
import { useAuthStore } from './src/stores/authStore'

// ---------------------------------------------------------------------------
// Placeholder screens — replaced one-by-one as E02-01..07 land.
// ---------------------------------------------------------------------------
import { SafeAreaView, Text } from 'react-native'

function PlaceholderScreen({ name }: { name: string }): React.JSX.Element {
  return (
    <SafeAreaView style={styles.placeholder}>
      <Text style={styles.placeholderText}>{name}</Text>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Navigator types — exported so screen components can use typed navigation
// props without touching App.tsx once they exist.
// ---------------------------------------------------------------------------
export type AuthStackParamList = {
  Login: undefined
  Register: undefined
  VerifyEmail: { email: string }
  ForgotPassword: undefined
}

export type AppStackParamList = {
  Home: undefined
}

const AuthStack = createNativeStackNavigator<AuthStackParamList>()
const AppStack = createNativeStackNavigator<AppStackParamList>()

function AuthNavigator(): React.JSX.Element {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login">{() => <PlaceholderScreen name="Login" />}</AuthStack.Screen>
      <AuthStack.Screen name="Register">
        {() => <PlaceholderScreen name="Register" />}
      </AuthStack.Screen>
      <AuthStack.Screen name="VerifyEmail">
        {() => <PlaceholderScreen name="Verify Email" />}
      </AuthStack.Screen>
      <AuthStack.Screen name="ForgotPassword">
        {() => <PlaceholderScreen name="Forgot Password" />}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  )
}

function AppNavigator(): React.JSX.Element {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Home">{() => <PlaceholderScreen name="Home" />}</AppStack.Screen>
    </AppStack.Navigator>
  )
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------
export default function App(): React.JSX.Element {
  const { status, checkSession, logout } = useAuthStore()
  const navRef = useRef<NavigationContainerRef<AppStackParamList>>(null)

  // Validate any stored tokens on launch.
  useEffect(() => {
    checkSession()
  }, [checkSession])

  // Forward API-level unauthorised events into a logout, clearing local state.
  // The navigation reacts to the resulting status change rather than being
  // navigated imperatively, which avoids races during startup.
  useEffect(() => {
    return authEvents.onUnauthorized(() => {
      logout()
    })
  }, [logout])

  if (status === 'unknown') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    )
  }

  return (
    <NavigationContainer ref={navRef}>
      {status === 'authenticated' ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.neutral[700],
  },
})
