import React, { useMemo, useRef, useState } from 'react'
import { PanResponder, StyleSheet, Text, View } from 'react-native'
import { colors, shadows } from '../../theme/tokens'
import { useT } from '../../i18n'

interface RangeSliderProps {
  min: number
  max: number
  step: number
  low: number
  high: number
  /** Fires continuously while dragging; the parent decides when to use it. */
  onChange: (low: number, high: number) => void
  unit?: string
}

const THUMB = 24

/**
 * Two-handle slider built on PanResponder rather than a native dependency:
 * the slider libraries for RN either take one value or need a native build
 * step that the pinned RN 0.76 tree has been fragile about. E03-06.
 */
export function RangeSlider({
  min,
  max,
  step,
  low,
  high,
  onChange,
  unit = 'RON',
}: RangeSliderProps) {
  const t = useT()
  const [trackWidth, setTrackWidth] = useState(0)

  // PanResponder handlers are created once, so they read live values from refs.
  const live = useRef({ low, high, trackWidth, onChange })
  live.current = { low, high, trackWidth, onChange }

  const span = max - min
  const toX = (value: number) => ((value - min) / span) * trackWidth
  const snap = (value: number) =>
    Math.min(max, Math.max(min, Math.round((value - min) / step) * step + min))

  const makeResponder = (thumb: 'low' | 'high') => {
    let startValue = 0
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the gesture even if the parent ScrollView wants it.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startValue = live.current[thumb]
      },
      onPanResponderMove: (_e, g) => {
        const { trackWidth: w, low: lo, high: hi, onChange: emit } = live.current
        if (w === 0) return
        const next = snap(startValue + (g.dx / w) * span)
        // The handles stop one step apart and never cross.
        if (thumb === 'low') emit(Math.min(next, hi - step), hi)
        else emit(lo, Math.max(next, lo + step))
      },
    })
  }

  // Rebuilt only when the scale changes; the handlers read everything else from `live`.
  const lowResponder = useMemo(() => makeResponder('low'), [min, max, step])
  const highResponder = useMemo(() => makeResponder('high'), [min, max, step])

  return (
    <View>
      <View
        style={styles.track}
        onLayout={e => setTrackWidth(e.nativeEvent.layout.width - THUMB)}
        accessibilityRole="adjustable"
        accessibilityLabel={t('discover.priceRange', { low, high, unit })}
      >
        <View style={styles.rail} />
        <View style={[styles.fill, { left: toX(low) + THUMB / 2, width: toX(high) - toX(low) }]} />
        <View
          {...lowResponder.panHandlers}
          style={[styles.thumb, { left: toX(low) }]}
          hitSlop={12}
        />
        <View
          {...highResponder.panHandlers}
          style={[styles.thumb, { left: toX(high) }]}
          hitSlop={12}
        />
      </View>
      <View style={styles.labels}>
        <Text style={styles.bound}>
          {min} {unit}
        </Text>
        <Text style={styles.bound}>
          {max} {unit}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  track: { height: THUMB, justifyContent: 'center' },
  rail: {
    position: 'absolute',
    left: THUMB / 2,
    right: THUMB / 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
  },
  fill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: colors.primary[600] },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.neutral[0],
    borderWidth: 2,
    borderColor: colors.primary[600],
    ...shadows.sm,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  bound: { fontSize: 13, fontWeight: '500', color: colors.neutral[500] },
})
