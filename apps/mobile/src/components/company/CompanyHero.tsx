import React from 'react'
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import type { CompanyDetail } from '@pitchup/shared'
import { RatingLine } from '../common/Stars'
import { WorkingHoursAccordion } from './WorkingHoursAccordion'
import { colors, shadows } from '../../theme/tokens'
import { useT } from '../../i18n'

/** Logo, name, contact and hours. UIUX_SPEC §6.1, E04-04. */
export function CompanyHero({ company }: { company: CompanyDetail }) {
  const t = useT()
  const address = [company.addressLine1, company.addressLine2, company.city]
    .filter(Boolean)
    .join(', ')
  const mapsUrl =
    company.lat !== null && company.lng !== null
      ? `https://maps.google.com/?q=${company.lat},${company.lng}`
      : `https://maps.google.com/?q=${encodeURIComponent(address)}`

  return (
    <View style={styles.root}>
      {company.logoUrl ? (
        <Image source={{ uri: company.logoUrl }} style={styles.logo} />
      ) : (
        <View style={[styles.logo, styles.logoFallback]}>
          <Icon name="office-building" size={32} color={colors.neutral[400]} />
        </View>
      )}
      <View style={styles.nameRow}>
        <Text style={styles.name}>{company.name}</Text>
        {company.isVerified ? (
          <View style={styles.verified}>
            <Icon name="check-decagram" size={18} color={colors.primary[600]} />
            <Text style={styles.verifiedText}>{t('discover.company.verified')}</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={() => void Linking.openURL(mapsUrl)}
        style={styles.line}
        accessibilityRole="link"
        accessibilityLabel={t('discover.company.address', { address })}
      >
        <Icon name="map-marker" size={16} color={colors.neutral[400]} />
        <Text style={styles.address}>{address}</Text>
      </Pressable>

      {company.phone ? (
        <Pressable
          onPress={() => void Linking.openURL(`tel:${company.phone}`)}
          style={[styles.line, styles.tight]}
          accessibilityRole="link"
          accessibilityLabel={`Call ${company.phone}`}
        >
          <Icon name="phone" size={16} color={colors.primary[600]} />
          <Text style={styles.phone}>{company.phone}</Text>
        </Pressable>
      ) : null}

      <View style={styles.rating}>
        <RatingLine avgRating={company.avgRating} reviewCount={company.reviewCount} />
      </View>
      <View style={styles.hours}>
        <WorkingHoursAccordion week={company.workingHours} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingBottom: 16, backgroundColor: colors.neutral[0] },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginTop: -40,
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  name: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: colors.neutral[900] },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: 11, fontWeight: '500', color: colors.primary[600] },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  tight: { marginTop: 4 },
  address: { flex: 1, fontSize: 14, color: colors.neutral[500] },
  phone: { fontSize: 14, color: colors.primary[600] },
  rating: { marginTop: 8 },
  hours: { marginTop: 8 },
})
