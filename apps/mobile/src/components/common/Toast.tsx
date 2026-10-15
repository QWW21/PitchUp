import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { colors } from '../../theme/tokens'

/**
 * A short message near the bottom of the screen that fades out on its own.
 * No toast library is installed; this covers the one-line notices the
 * pitch screens need ("This pitch is closed on Monday").
 */
export function useToast(bottom: number) {
  const [message, setMessage] = useState<string | null>(null)
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A screen can close while its toast is showing (e.g. after a cancellation).
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const show = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current)
      setMessage(text)
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start()
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
          setMessage(null)
        )
      }, 2500)
    },
    [opacity]
  )

  const toast = message ? (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { bottom, opacity }]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  ) : null

  return { show, toast }
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: colors.neutral[900],
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  text: { color: colors.neutral[0], fontSize: 14 },
})
