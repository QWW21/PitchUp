import React from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import type { PitchSummary } from '@pitchup/shared'
import { RatingLine } from '../common/Stars'
import { SurfaceChip } from '../common/SurfaceChip'
import { colors, shadows } from '../../theme/tokens'
import { useT } from '../../i18n'

/** A pitch on its company's page. UIUX_SPEC §6.1, E04-04. */
export function PitchListCard({ pitch, onPress }: { pitch: PitchSummary; onPress: () => void }) {
  const t = useT()
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={t('discover.card.pitchLabel', {
        name: pitch.name,
        price: pitch.hourlyRate,
      })}
    >
      {pitch.coverPhotoUrl ? (
        <Image source={{ uri: pitch.coverPhotoUrl }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Icon name="image-off" size={24} color={colors.neutral[400]} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {pitch.name}
        </Text>
        <View style={styles.row}>
          <SurfaceChip surface={pitch.surfaceType} />
          <Text style={styles.size}>{t(`size.${pitch.size}`)}</Text>
        </View>
        <Text style={styles.price}>
          <Text style={styles.priceBold}>{pitch.hourlyRate} RON</Text>/h
        </Text>
        <RatingLine avgRating={pitch.avgRating} reviewCount={pitch.reviewCount} />
      </View>
      <Icon name="chevron-right" size={18} color={colors.neutral[300]} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },
  thumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: colors.neutral[100] },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 6 },
  name: { fontSize: 16, fontWeight: '600', color: colors.neutral[900] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  size: { fontSize: 12, color: colors.neutral[500] },
  price: { fontSize: 12, color: colors.neutral[700] },
  priceBold: { fontWeight: '700', color: colors.primary[700] },
})
