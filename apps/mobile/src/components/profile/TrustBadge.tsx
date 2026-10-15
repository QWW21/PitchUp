/**
 * The trust score at a glance — E08-04 / E08-05.
 *
 * Deviation, agreed with the owner: the tickets draw an SVG ring, which
 * needs react-native-svg (a native module the app does not have). This is
 * a circle in the tier's colour with the score inside, and a bar below that
 * fills to the score when it appears. No new native code.
 */
import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { TRUST_TIER_COLOURS, trustTier } from '@pitchup/shared'
import { colors } from '../../theme/tokens'

export function TrustBadge({
  score,
  size = 60,
  duration = 600,
}: {
  score: number
  size?: number
  /** 600 ms on the profile card, 800 ms on the detail screen (the tickets). */
  duration?: number
}) {
  const tier = trustTier(score)
  const colour = TRUST_TIER_COLOURS[tier.label]
  const fill = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim = Animated.timing(fill, {
      toValue: Math.max(0, Math.min(100, score)) / 100,
      duration,
      // Width is a layout property: the native driver cannot animate it.
      useNativeDriver: false,
    })
    anim.start()
    return () => anim.stop()
  }, [fill, score, duration])

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Trust score ${score} out of 100, ${tier.label}`}
    >
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, borderColor: colour },
        ]}
      >
        <Text style={[styles.score, { fontSize: size * 0.36 }]}>{score}</Text>
      </View>
      <View style={[styles.track, { width: size }]}>
        <Animated.View
          style={[
            styles.bar,
            {
              backgroundColor: colour,
              width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 6 },
  circle: { borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  score: { fontWeight: '700', color: colors.neutral[900] },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.neutral[200], overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2 },
})
