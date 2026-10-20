import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import type { ReviewPage } from '@pitchup/shared'
import { Stars } from '../common/Stars'
import { colors } from '../../theme/tokens'
import { useT } from '../../i18n'

function Bar({ share }: { share: number }) {
  const fill = useRef(new Animated.Value(0)).current
  useEffect(() => {
    // Width is a layout property, so this cannot use the native driver.
    Animated.timing(fill, { toValue: share, duration: 600, useNativeDriver: false }).start()
  }, [fill, share])
  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.fill,
          { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  )
}

/** Big rating, stars, count, and a 5★→1★ bar chart. UIUX_SPEC §6.1, E04-07. */
export function RatingBreakdown({ page }: { page: ReviewPage }) {
  const t = useT()
  const total = page.total || 1
  return (
    <View style={styles.root}>
      <View style={styles.headline}>
        <Text style={styles.big}>{page.avgRating !== null ? page.avgRating.toFixed(1) : '–'}</Text>
        <Text style={styles.outOf}>{t('discover.reviews.outOf')}</Text>
      </View>
      {page.avgRating !== null ? <Stars rating={page.avgRating} size={24} /> : null}
      <Text style={styles.count}>{t('discover.reviews.count', { count: page.total })}</Text>
      <View style={styles.bars}>
        {([5, 4, 3, 2, 1] as const).map(star => (
          <View key={star} style={styles.barRow}>
            <Text style={styles.barLabel}>{star} ★</Text>
            <Bar share={page.distribution[star] / total} />
            <Text style={styles.barCount}>{page.distribution[star]}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { paddingVertical: 16 },
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  big: { fontSize: 30, lineHeight: 38, fontWeight: '700', color: colors.neutral[900] },
  outOf: { fontSize: 14, color: colors.neutral[500] },
  count: { marginTop: 8, fontSize: 12, color: colors.neutral[500] },
  bars: { marginTop: 12, gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 32, fontSize: 12, color: colors.neutral[500] },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral[200],
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary[600] },
  barCount: { width: 32, textAlign: 'right', fontSize: 12, color: colors.neutral[500] },
})
