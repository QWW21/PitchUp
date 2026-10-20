/**
 * Newest | Highest | Lowest | Unanswered — E07-07. A choice resets the list
 * (it is a new query) and fetches again.
 */
import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { REVIEW_SORTS, type ReviewSort } from '@pitchup/shared'
import { colors } from '../../theme/tokens'
import { useT } from '../../i18n'

export function ReviewSortSelector({
  value,
  onChange,
}: {
  value: ReviewSort
  onChange: (sort: ReviewSort) => void
}) {
  const t = useT()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={t('discover.reviews.sort')}
    >
      {REVIEW_SORTS.map(s => {
        const on = s === value
        return (
          <Pressable
            key={s}
            onPress={() => onChange(s)}
            style={[styles.pill, on && styles.pillOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.text, on && styles.textOn]}>{t(`reviewSort.${s}`)}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 8 },
  pill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  pillOn: { backgroundColor: colors.primary[600] },
  text: { fontSize: 14, fontWeight: '500', color: colors.neutral[700] },
  textOn: { color: colors.neutral[0] },
})
