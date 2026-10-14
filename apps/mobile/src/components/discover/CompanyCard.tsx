import React from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { REVIEW, type CompanyListItem } from '@pitchup/shared'
import { colors, shadows } from '../../theme/tokens'

interface CompanyCardProps {
  company: CompanyListItem
  onPress?: () => void
  /** No shadow or padding: the map preview sheet supplies its own. */
  bare?: boolean
}

/** Discover list card. UIUX_SPEC §5.1, E03-05. */
export function CompanyCard({ company, onPress, bare = false }: CompanyCardProps) {
  const rated = company.avgRating !== null && company.reviewCount >= REVIEW.MIN_FOR_PUBLIC_RATING

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${company.name}, from ${company.priceFrom} RON per hour`}
      style={[styles.row, !bare && styles.card]}
    >
      {company.logoUrl ? (
        <Image source={{ uri: company.logoUrl }} style={styles.logo} resizeMode="cover" />
      ) : (
        <View style={[styles.logo, styles.logoFallback]}>
          <Icon name="office-building" size={24} color={colors.neutral[400]} />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {company.name}
          </Text>
          {company.isOpenNow ? (
            <View style={styles.openBadge}>
              <Text style={styles.openText}>OPEN</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.metaRow, styles.gap4]}>
          <Icon name="map-marker" size={14} color={colors.neutral[400]} />
          <Text style={styles.address} numberOfLines={1}>
            {company.address}
          </Text>
        </View>

        <View style={[styles.metaRow, styles.gap4]}>
          {rated ? (
            <>
              <Icon name="star" size={12} color="#FBBF24" />
              <Text style={styles.rating} numberOfLines={1}>
                {company.avgRating!.toFixed(1)}
              </Text>
              <Text style={styles.muted}>({company.reviewCount})</Text>
            </>
          ) : (
            <Text style={styles.muted}>Not rated yet</Text>
          )}
          {company.distanceKm !== null ? (
            <>
              <Text style={styles.muted}>·</Text>
              <Text style={styles.distance}>{company.distanceKm.toFixed(1)} km</Text>
            </>
          ) : null}
        </View>

        <View style={styles.footerRow}>
          <View style={styles.pitchChip}>
            <Text style={styles.pitchChipText}>
              {company.pitchCount} {company.pitchCount === 1 ? 'pitch' : 'pitches'}
            </Text>
          </View>
          <Text style={styles.price}>
            from <Text style={styles.priceBold}>{company.priceFrom} RON</Text>/h
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  card: { backgroundColor: colors.neutral[0], borderRadius: 12, padding: 16, ...shadows.sm },
  logo: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.neutral[100] },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginLeft: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.neutral[900] },
  openBadge: {
    borderRadius: 4,
    backgroundColor: colors.success[50],
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  openText: { fontSize: 11, lineHeight: 12, fontWeight: '500', color: colors.success[500] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gap4: { marginTop: 4 },
  address: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.neutral[500] },
  rating: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.neutral[700] },
  muted: { fontSize: 12, lineHeight: 18, color: colors.neutral[400] },
  distance: { fontSize: 12, lineHeight: 18, color: colors.neutral[500] },
  footerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  pitchChip: {
    borderRadius: 9999,
    backgroundColor: colors.neutral[100],
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  pitchChipText: { fontSize: 11, fontWeight: '500', color: colors.neutral[700] },
  price: { flex: 1, textAlign: 'right', fontSize: 12, lineHeight: 18, color: colors.primary[700] },
  priceBold: { fontWeight: '700' },
})

/** Shared with CompanyCardSkeleton so the two keep the same footprint. */
export { styles as cardStyles }
