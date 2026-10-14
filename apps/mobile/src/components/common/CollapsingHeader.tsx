import React from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { colors } from '../../theme/tokens'

interface CollapsingHeaderProps {
  scrollY: Animated.Value
  /** Height of the image the header floats over. */
  heroHeight: number
  title: string
  onBack: () => void
  onShare?: () => void
}

export const HEADER_HEIGHT = 56

/**
 * Transparent over the hero, white with a shadow once scrolled past half of
 * it; the title fades in between 50 and 100 px. UIUX_SPEC §6.1, E04-04.
 * Colour and shadow animate on the JS driver (they are not transforms).
 */
export function CollapsingHeader({
  scrollY,
  heroHeight,
  title,
  onBack,
  onShare,
}: CollapsingHeaderProps) {
  const insets = useSafeAreaInsets()
  const background = scrollY.interpolate({
    inputRange: [0, heroHeight * 0.5],
    outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,1)'],
    extrapolate: 'clamp',
  })
  const shadow = scrollY.interpolate({
    inputRange: [heroHeight * 0.4, heroHeight * 0.5],
    outputRange: [0, 0.08],
    extrapolate: 'clamp',
  })
  const titleOpacity = scrollY.interpolate({
    inputRange: [50, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })
  // The buttons' white discs fade out as the bar behind them turns white.
  const discOpacity = scrollY.interpolate({
    inputRange: [0, heroHeight * 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  const button = (icon: string, label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.tap}
    >
      <Animated.View style={[styles.disc, { opacity: discOpacity }]} />
      <Icon name={icon} size={24} color={colors.neutral[900]} />
    </Pressable>
  )

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          paddingTop: insets.top,
          height: HEADER_HEIGHT + insets.top,
          backgroundColor: background,
          shadowOpacity: shadow,
          elevation: scrollY.interpolate({
            inputRange: [heroHeight * 0.4, heroHeight * 0.5],
            outputRange: [0, 4],
            extrapolate: 'clamp',
          }),
        },
      ]}
    >
      {button('chevron-left', 'Back', onBack)}
      <Animated.Text style={[styles.title, { opacity: titleOpacity }]} numberOfLines={1}>
        {title}
      </Animated.Text>
      {onShare ? button('share-variant', 'Share', onShare) : <View style={styles.tap} />}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  tap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disc: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
  },
})
