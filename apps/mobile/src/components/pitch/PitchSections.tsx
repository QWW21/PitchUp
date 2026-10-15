/**
 * Amenities grid and pricing card — E04-05, UIUX_SPEC §6.2.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import {
  ALL_AMENITIES,
  AMENITY_LABELS,
  formatShirtColours,
  type AmenityType,
  type PitchDetail,
} from '@pitchup/shared'
import { colors } from '../../theme/tokens'

/** The ticket's `locker-room` and `stadium-outline` are not in the installed icon set. */
const AMENITY_ICONS: Record<AmenityType, string> = {
  SHOWERS_FREE: 'shower',
  SHOWERS_PAID: 'shower',
  CHANGING_ROOMS: 'hanger',
  PARKING_FREE: 'parking',
  PARKING_PAID: 'parking',
  NIGHT_LIGHTING: 'stadium',
  BALL_RENTAL_FREE: 'soccer',
  BALL_RENTAL_PAID: 'soccer',
  REFRESHMENTS: 'food',
  LOCKERS: 'lock-outline',
  REFEREE: 'whistle',
  FIRST_AID: 'medical-bag',
  WHEELCHAIR: 'wheelchair-accessibility',
  WIFI: 'wifi',
}

/** All fourteen, available ones highlighted, the rest greyed and struck through. */
export function AmenitiesGrid({ amenities }: { amenities: PitchDetail['amenities'] }) {
  const have = new Set(amenities.map(a => a.amenityType))
  return (
    <View style={styles.grid}>
      {ALL_AMENITIES.map(type => {
        const available = have.has(type)
        return (
          <View
            key={type}
            style={styles.cell}
            accessible
            accessibilityLabel={`${AMENITY_LABELS[type]}, ${available ? 'available' : 'not available'}`}
          >
            <Icon
              name={AMENITY_ICONS[type]}
              size={20}
              color={available ? colors.primary[600] : colors.neutral[300]}
            />
            <Text style={[styles.amenity, !available && styles.unavailable]} numberOfLines={1}>
              {AMENITY_LABELS[type]}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

/** One hourly rate at any time of day; shirts are free. */
export function PricingCard({ pitch }: { pitch: PitchDetail }) {
  const colours = formatShirtColours(pitch.shirtInventory)
  return (
    <View style={styles.card}>
      <View style={styles.priceRow}>
        <Text style={styles.range}>Any time</Text>
        <Text style={styles.price}>
          {pitch.hourlyRate} RON<Text style={styles.per}>/h</Text>
        </Text>
      </View>
      <Text style={styles.note}>Min. {pitch.minBookingHours}h · Billed per 30 min</Text>
      {pitch.hasShirts ? (
        <View style={[styles.shirts, styles.divider]}>
          <Icon name="tshirt-crew" size={16} color={colors.neutral[500]} />
          <Text style={styles.shirtText}>
            <Text style={styles.bold}>Free shirts</Text>
            {colours ? ` in ${colours}` : ''}. Ask for them when you book: one set for every team
            but one.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', height: 36, flexDirection: 'row', alignItems: 'center', gap: 8 },
  amenity: { flex: 1, fontSize: 14, color: colors.neutral[900] },
  unavailable: { color: colors.neutral[400], textDecorationLine: 'line-through' },
  card: { borderRadius: 12, padding: 12, backgroundColor: colors.neutral[50] },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.neutral[200] },
  range: { flex: 1, fontSize: 12, color: colors.neutral[500] },
  price: { fontSize: 20, fontWeight: '700', color: colors.neutral[900], fontFamily: 'monospace' },
  per: { fontSize: 14, fontWeight: '400', color: colors.neutral[500] },
  note: { marginTop: 8, fontSize: 12, color: colors.neutral[400] },
  shirts: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8 },
  shirtText: { fontSize: 12, color: colors.neutral[700] },
  bold: { fontWeight: '700' },
})
