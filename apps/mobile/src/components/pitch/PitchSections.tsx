/**
 * Amenities grid and pricing card — E04-05, UIUX_SPEC §6.2.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import {
  ALL_AMENITIES,
  formatDayMonth,
  formatShirtColours,
  type AmenityType,
  type PitchDetail,
  formatShortDuration,
} from '@pitchup/shared'
import { colors } from '../../theme/tokens'
import { useLocale, useT } from '../../i18n'

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
  const t = useT()
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
            accessibilityLabel={t(
              available ? 'discover.pitch.available' : 'discover.pitch.notAvailable',
              { amenity: t(`amenity.${type}`) }
            )}
          >
            <Icon
              name={AMENITY_ICONS[type]}
              size={20}
              color={available ? colors.primary[600] : colors.neutral[300]}
            />
            <Text style={[styles.amenity, !available && styles.unavailable]} numberOfLines={1}>
              {t(`amenity.${type}`)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

/** One hourly rate at any time of day; shirts are free. */
export function PricingCard({ pitch }: { pitch: PitchDetail }) {
  const t = useT()
  const locale = useLocale()
  const colours = formatShirtColours(pitch.shirtInventory, locale)
  // C-14: the covered prices, for the seasons not over yet.
  const airs = (
    [
      ['COLD', pitch.coveredColdRate],
      ['HOT', pitch.coveredHotRate],
    ] as const
  ).filter((a): a is readonly ['COLD' | 'HOT', number] => typeof a[1] === 'number')
  const seasons = airs.length ? pitch.coveredSeasons : []
  return (
    <View style={styles.card}>
      <View style={styles.priceRow}>
        <Text style={styles.range}>
          {t(seasons.length ? 'discover.pitch.uncovered' : 'discover.pitch.anyTime')}
        </Text>
        <Text style={styles.price}>
          {pitch.hourlyRate} RON<Text style={styles.per}>/h</Text>
        </Text>
      </View>
      {seasons.map(s => (
        <View key={s.startDate} style={styles.divider}>
          <Text style={styles.range}>
            {t('discover.pitch.coveredSeason', {
              covered: t('covered'),
              from: formatDayMonth(s.startDate, locale),
              to: formatDayMonth(s.endDate, locale),
            })}
          </Text>
          {airs.map(([air, rate]) => (
            <View key={air} style={styles.priceRow}>
              <Text style={styles.range}>{t(`air.${air}`)}</Text>
              <Text style={styles.price}>
                {rate} RON<Text style={styles.per}>/h</Text>
              </Text>
            </View>
          ))}
        </View>
      ))}
      <Text style={styles.note}>
        {t('discover.pitch.minBilled', {
          duration: formatShortDuration(pitch.minBookingHours * 60),
        })}
      </Text>
      {pitch.hasShirts ? (
        <View style={[styles.shirts, styles.divider]}>
          <Icon name="tshirt-crew" size={16} color={colors.neutral[500]} />
          <Text style={styles.shirtText}>
            <Text style={styles.bold}>{t('discover.pitch.freeShirts')}</Text>
            {colours ? t('discover.pitch.shirtsIn', { colours }) : ''}
            {t('discover.pitch.shirtsHow')}
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
