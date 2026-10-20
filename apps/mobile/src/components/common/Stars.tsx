import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { REVIEW } from '@pitchup/shared'
import { colors } from '../../theme/tokens'
import { useT } from '../../i18n'

const STAR = '#FBBF24'

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const t = useT()
  const full = Math.round(rating)
  return (
    <View
      style={styles.row}
      accessibilityRole="image"
      accessibilityLabel={t('discover.reviews.stars', { rating: rating.toFixed(1) })}
    >
      {[1, 2, 3, 4, 5].map(i => (
        <Icon
          key={i}
          name={i <= full ? 'star' : 'star-outline'}
          size={size}
          color={i <= full ? STAR : colors.neutral[300]}
        />
      ))}
    </View>
  )
}

/** "★★★★☆ 4.3 (127 reviews)", or "Not yet rated" below the public threshold. */
export function RatingLine({
  avgRating,
  reviewCount,
}: {
  avgRating: number | null
  reviewCount: number
}) {
  const t = useT()
  if (avgRating === null || reviewCount < REVIEW.MIN_FOR_PUBLIC_RATING) {
    return <Text style={styles.muted}>{t('discover.reviews.notYet')}</Text>
  }
  return (
    <View style={styles.line}>
      <Stars rating={avgRating} />
      <Text style={styles.value}>{avgRating.toFixed(1)}</Text>
      <Text style={styles.muted}>
        ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontSize: 12, fontWeight: '700', color: colors.neutral[700] },
  muted: { fontSize: 12, color: colors.neutral[400] },
})
