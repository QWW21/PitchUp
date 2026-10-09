/**
 * PitchUp mobile entry point.
 *
 * Screens and navigation arrive in E02-01 onwards; this renders a
 * placeholder so the app boots and the workspace link can be verified.
 */
import React from 'react'
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from './src/theme/tokens'
import { sharedPackageSummary } from './src/lib/sharedCheck'

function App(): React.JSX.Element {
  const shared = sharedPackageSummary()

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.neutral[0]} />
      <View style={styles.container}>
        <Text style={styles.wordmark}>PitchUp</Text>
        <Text style={styles.caption}>Book a football pitch near you</Text>
        <Text style={styles.caption}>
          shared: {shared.cities} cities · schema {shared.schemaWorks ? 'ok' : 'failed'}
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.neutral[0] },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary[600],
  },
  caption: {
    marginTop: spacing.sm,
    fontSize: 15,
    color: colors.neutral[500],
  },
})

export default App
