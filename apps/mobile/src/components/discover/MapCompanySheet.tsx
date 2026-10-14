import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, StyleSheet, View } from 'react-native'
import type { CompanyListItem } from '@pitchup/shared'
import { Button } from '../ui/Button'
import { CompanyCard } from './CompanyCard'
import { colors, shadows } from '../../theme/tokens'

export const MAP_SHEET_HEIGHT = 200

interface MapCompanySheetProps {
  /** Null slides the sheet away. */
  company: CompanyListItem | null
  bottomInset: number
  onView: (company: CompanyListItem) => void
  onDismiss: () => void
}

/** Preview of the tapped marker's company. UIUX_SPEC §5.2, E03-07. */
export function MapCompanySheet({ company, bottomInset, onView, onDismiss }: MapCompanySheetProps) {
  const height = MAP_SHEET_HEIGHT + bottomInset
  const translateY = useRef(new Animated.Value(height)).current
  // Keeps the last company on screen while the sheet slides out.
  const [shown, setShown] = useState<CompanyListItem | null>(company)

  useEffect(() => {
    if (company) {
      setShown(company)
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 300,
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(translateY, { toValue: height, duration: 200, useNativeDriver: true }).start(
        ({ finished }) => finished && setShown(null)
      )
    }
  }, [company, height, translateY])

  const drag = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 4,
        onPanResponderMove: (_e, g) => translateY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 60 || g.vy > 1) onDismiss()
          else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start()
        },
      }),
    [translateY, onDismiss]
  )

  if (!shown) return null

  return (
    <Animated.View
      {...drag.panHandlers}
      style={[
        styles.sheet,
        { height, paddingBottom: 12 + bottomInset, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.handle} />
      <View style={styles.card}>
        <CompanyCard company={shown} bare />
      </View>
      <View style={styles.button}>
        <Button label="View company" onPress={() => onView(shown)} />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    ...shadows.xl,
  },
  handle: {
    alignSelf: 'center',
    marginTop: 8,
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
  },
  card: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  button: { paddingHorizontal: 12 },
})
