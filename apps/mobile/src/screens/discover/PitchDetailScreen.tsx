/**
 * Pitch Detail — E04-05 (gallery, info, amenities, pricing) and E04-06
 * (availability preview, reviews preview, Book Now footer).
 */
import React, { useRef, useState } from 'react'
import { Animated, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { SIZE_LABELS, formatPitchSize, trustTier } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { usePitch } from '../../hooks/useVenue'
import { useAuthStore } from '../../stores/authStore'
import { CollapsingHeader } from '../../components/common/CollapsingHeader'
import { RatingLine } from '../../components/common/Stars'
import { SurfaceChip } from '../../components/common/SurfaceChip'
import { SkeletonBox } from '../../components/common/SkeletonBox'
import { EmptyState } from '../../components/common/EmptyState'
import { useToast } from '../../components/common/Toast'
import { GALLERY_HEIGHT, PhotoGallery } from '../../components/pitch/PhotoGallery'
import { AmenitiesGrid, PricingCard } from '../../components/pitch/PitchSections'
import { AvailabilityPreview } from '../../components/pitch/AvailabilityPreview'
import { BookNowFooter, FOOTER_HEIGHT, type BookBlock } from '../../components/pitch/BookNowFooter'
import { ReviewCard } from '../../components/reviews/ReviewCard'
import { colors } from '../../theme/tokens'
import { SHARE_BASE_URL } from './CompanyDetailScreen'

type Props = NativeStackScreenProps<AppStackParamList, 'PitchDetail'>

const DESCRIPTION_LINES = 4

export function PitchDetailScreen({ route, navigation }: Props) {
  const { pitchId, companyId } = route.params
  const pitch = usePitch(pitchId)
  const user = useAuthStore(s => s.user)
  const scrollY = useRef(new Animated.Value(0)).current
  const [expanded, setExpanded] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const { show: toast, toast: toastView } = useToast(FOOTER_HEIGHT + 24)

  const header = (
    <CollapsingHeader
      scrollY={scrollY}
      heroHeight={GALLERY_HEIGHT}
      title={pitch.data?.name ?? ''}
      onBack={() => navigation.goBack()}
      onShare={() => {
        const url = `${SHARE_BASE_URL}/${companyId}/${pitchId}`
        void Share.share(Platform.OS === 'ios' ? { url } : { message: url })
      }}
    />
  )

  if (pitch.isPending) {
    return (
      <View style={styles.root}>
        {header}
        <SkeletonBox height={GALLERY_HEIGHT} radius={0} />
        <View style={styles.padded}>
          <SkeletonBox width="60%" height={24} style={styles.gap} />
          <SkeletonBox width="40%" height={14} style={styles.gap} />
          <SkeletonBox height={96} radius={12} style={styles.gapLg} />
        </View>
      </View>
    )
  }

  if (pitch.isError || !pitch.data) {
    return (
      <View style={styles.root}>
        {header}
        <EmptyState
          illustration={<Icon name="wifi-off" size={64} color={colors.neutral[300]} />}
          title="Couldn't load pitch"
          description="Check your connection and try again"
          ctaLabel="Retry"
          ctaVariant="primary"
          onCta={() => void pitch.refetch()}
        />
      </View>
    )
  }

  const p = pitch.data
  // PRD §9.1: a Suspended tier cannot book. The booking API enforces it again (E05).
  const block: BookBlock = !p.isBookable
    ? 'unavailable'
    : typeof user?.trustScore === 'number' && !trustTier(user.trustScore).canBook
      ? 'restricted'
      : null

  const book = (date?: string) =>
    navigation.navigate('BookingFlow', {
      pitchId: p.id,
      pitchName: p.name,
      companyName: p.company.name,
      offPeakRate: p.offPeakRate,
      peakRate: p.peakRate,
      ...(date ? { date } : {}),
    })

  return (
    <View style={styles.root}>
      {header}
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        // Nothing hides behind the fixed footer.
        contentContainerStyle={{ paddingBottom: FOOTER_HEIGHT + 32 }}
      >
        <PhotoGallery photos={p.photos} />

        <View style={styles.padded}>
          <Text style={styles.name}>{p.name}</Text>
          <View style={[styles.row, styles.gapSm]}>
            <SurfaceChip surface={p.surfaceType} />
            <Text style={styles.size}>
              {formatPitchSize(SIZE_LABELS[p.size], p.widthMeters, p.lengthMeters)}
            </Text>
          </View>
          <View style={styles.gapSm}>
            <RatingLine avgRating={p.avgRating} reviewCount={p.reviewCount} />
          </View>
          <Pressable
            onPress={() =>
              navigation.navigate('CompanyDetail', { id: p.company.id, name: p.company.name })
            }
            style={[styles.row, styles.gapSm]}
            accessibilityRole="link"
          >
            <Text style={styles.company}>{p.company.name}</Text>
            <Icon name="chevron-right" size={16} color={colors.neutral[300]} />
          </Pressable>

          {p.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this pitch</Text>
              <Text
                style={styles.body}
                numberOfLines={expanded ? undefined : DESCRIPTION_LINES}
                // Measured once, unclamped lines reported on first layout.
                onTextLayout={e => {
                  if (!expanded && !truncated && e.nativeEvent.lines.length > DESCRIPTION_LINES) {
                    setTruncated(true)
                  }
                }}
              >
                {p.description}
              </Text>
              {truncated ? (
                <Pressable onPress={() => setExpanded(x => !x)} style={styles.more}>
                  <Text style={styles.moreText}>{expanded ? 'Show less' : 'Show more'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <AmenitiesGrid amenities={p.amenities} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing</Text>
            <PricingCard pitch={p} />
          </View>

          {p.isBookable ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Availability</Text>
              <AvailabilityPreview
                pitchId={p.id}
                enabled={p.isBookable}
                onPickDay={date => (block ? toast('Booking is not available') : book(date))}
                onClosedDay={toast}
              />
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.reviewsHead}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              <RatingLine avgRating={p.avgRating} reviewCount={p.reviewCount} />
            </View>
            {p.reviewCount === 0 ? (
              <Text style={styles.noReviews}>No reviews yet</Text>
            ) : (
              <>
                {p.recentReviews.slice(0, 2).map(r => (
                  <ReviewCard key={r.id} review={r} compact />
                ))}
                <Pressable
                  onPress={() =>
                    navigation.navigate('CompanyDetail', {
                      id: p.company.id,
                      name: p.company.name,
                      initialTab: 'reviews',
                      pitchId: p.id,
                    })
                  }
                  style={[styles.row, styles.gapSm]}
                >
                  <Text style={styles.seeAll}>
                    See all {p.reviewCount} {p.reviewCount === 1 ? 'review' : 'reviews'}
                  </Text>
                  <Icon name="chevron-right" size={16} color={colors.primary[600]} />
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      <BookNowFooter priceFrom={p.offPeakRate} block={block} onBook={() => book()} />
      {toastView}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  padded: { paddingHorizontal: 16, paddingTop: 16 },
  name: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: colors.neutral[900] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  size: { fontSize: 14, color: colors.neutral[500] },
  company: { fontSize: 14, color: colors.neutral[500] },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[900], marginBottom: 12 },
  body: { fontSize: 14, lineHeight: 20, color: colors.neutral[700] },
  more: { alignSelf: 'flex-end', marginTop: 4 },
  moreText: { fontSize: 13, fontWeight: '500', color: colors.primary[600] },
  reviewsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noReviews: { paddingVertical: 16, textAlign: 'center', fontSize: 14, color: colors.neutral[400] },
  seeAll: { fontSize: 13, fontWeight: '500', color: colors.primary[600] },
  gapSm: { marginTop: 8 },
  gap: { marginTop: 12 },
  gapLg: { marginTop: 24 },
})
