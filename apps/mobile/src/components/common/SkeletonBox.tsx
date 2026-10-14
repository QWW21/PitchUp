import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { colors } from '../../theme/tokens'

interface SkeletonBoxProps {
  width?: DimensionValue
  height: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Grey placeholder with a light band sweeping across it. Transform only, so
 * the animation runs on the native driver. E03-05.
 */
export function SkeletonBox({ width = '100%', height, radius = 4, style }: SkeletonBoxProps) {
  const shimmer = useRef(new Animated.Value(0)).current
  const [boxWidth, setBoxWidth] = useState(0)

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1500, useNativeDriver: true })
    )
    loop.start()
    return () => loop.stop()
  }, [shimmer])

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-boxWidth, boxWidth],
  })

  return (
    <View
      onLayout={e => setBoxWidth(e.nativeEvent.layout.width)}
      style={[styles.box, { width, height, borderRadius: radius }, style]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.band, { transform: [{ translateX }] }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.neutral[100], overflow: 'hidden' },
  band: { width: '60%', backgroundColor: 'rgba(255,255,255,0.6)' },
})
