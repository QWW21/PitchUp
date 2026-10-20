/**
 * Onboarding — E02-01.
 *
 * Three slides shown on first launch. After the user taps "Get Started",
 * AsyncStorage records that they've seen it so it never shows again.
 */
import React, { useRef, useState } from 'react'
import { Dimensions, FlatList, StyleSheet, Text, View, type ViewToken } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../../App'
import { Button } from '../../components/ui/Button'
import { colors, spacing } from '../../theme/tokens'
import { useT } from '../../i18n'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export const ONBOARDING_SEEN_KEY = 'onboardingSeen'

const SLIDES = [
  { emoji: '📍', key: 0 },
  { emoji: '⚡', key: 1 },
  { emoji: '⚽', key: 2 },
] as const

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>

export function OnboardingScreen({ navigation }: Props) {
  const t = useT()
  const [current, setCurrent] = useState(0)
  const listRef = useRef<FlatList>(null)
  const isLast = current === SLIDES.length - 1

  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setCurrent(viewableItems[0].index)
  })

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1')
    navigation.replace('Login')
  }

  function next() {
    if (isLast) {
      finish()
    } else {
      listRef.current?.scrollToIndex({ index: current + 1, animated: true })
    }
  }

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        // Android Fabric crashes on unmount with subview clipping on; three
        // slides are not worth clipping anyway. See the comment on `slide`.
        removeClippedSubviews={false}
        renderItem={({ item }) => (
          // Without this the layout-only wrapper is flattened away and the
          // three Texts become direct children of the scroll content view,
          // so the list's item count no longer matches the native children.
          <View style={styles.slide} collapsable={false}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>
              {t(`auth.onboarding.slides.${(item as (typeof SLIDES)[number]).key}.title`)}
            </Text>
            <Text style={styles.body}>
              {t(`auth.onboarding.slides.${(item as (typeof SLIDES)[number]).key}.body`)}
            </Text>
          </View>
        )}
      />

      {/* Dot indicators */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          label={isLast ? t('auth.onboarding.start') : t('auth.onboarding.next')}
          onPress={next}
        />
        {!isLast && (
          <Button
            label={t('auth.onboarding.skip')}
            variant="ghost"
            onPress={finish}
            fullWidth={false}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emoji: { fontSize: 72, marginBottom: spacing.lg },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.neutral[900],
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral[200],
  },
  dotActive: { backgroundColor: colors.primary[600], width: 20 },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
})
