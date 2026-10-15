/**
 * Company Detail — E04-04 (hero, header, Pitches tab) and E04-07 (Reviews tab).
 *
 * One Animated.ScrollView: hero, then the tab bar (sticky via
 * stickyHeaderIndices), then the active tab's content. Tabs switch on tap;
 * swiping between them would need react-native-tab-view or a pager, neither
 * of which is installed.
 */
import React, { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import type { AppStackParamList } from '../../../App'
import { useCompany, useReviews } from '../../hooks/useVenue'
import { CollapsingHeader } from '../../components/common/CollapsingHeader'
import { CompanyHero } from '../../components/company/CompanyHero'
import { PitchListCard } from '../../components/company/PitchListCard'
import { RatingBreakdown } from '../../components/reviews/RatingBreakdown'
import { ReviewCard } from '../../components/reviews/ReviewCard'
import { ReviewSortSelector } from '../../components/reviews/ReviewSortSelector'
import type { ReviewSort } from '@pitchup/shared'
import { SkeletonBox } from '../../components/common/SkeletonBox'
import { EmptyState } from '../../components/common/EmptyState'
import { colors } from '../../theme/tokens'

type Props = NativeStackScreenProps<AppStackParamList, 'CompanyDetail'>
type Tab = 'pitches' | 'reviews'

const HERO_HEIGHT = 200
export const SHARE_BASE_URL = 'https://pitchup.ro/discover'

export function CompanyDetailScreen({ route, navigation }: Props) {
  const { id, initialTab, pitchId } = route.params
  const company = useCompany(id)
  const [tab, setTab] = useState<Tab>(initialTab ?? 'pitches')
  const scrollY = useRef(new Animated.Value(0)).current
  const [sort, setSort] = useState<ReviewSort>('newest')
  const reviews = useReviews({ companyId: id, pitchId, sort })

  const title = company.data?.name ?? route.params.name ?? ''

  function share() {
    const url = `${SHARE_BASE_URL}/${id}`
    void Share.share(Platform.OS === 'ios' ? { url } : { message: url })
  }

  const header = (
    <CollapsingHeader
      scrollY={scrollY}
      heroHeight={HERO_HEIGHT}
      title={title}
      onBack={() => navigation.goBack()}
      onShare={share}
    />
  )

  if (company.isPending) {
    return (
      <View style={styles.root}>
        {header}
        <SkeletonBox height={HERO_HEIGHT} radius={0} />
        <View style={styles.padded}>
          <SkeletonBox width={80} height={80} radius={12} style={styles.skeletonLogo} />
          <SkeletonBox width="70%" height={24} />
          <SkeletonBox width="90%" height={14} style={styles.gap} />
          <SkeletonBox height={112} radius={12} style={styles.gapLg} />
          <SkeletonBox height={112} radius={12} style={styles.gap} />
        </View>
      </View>
    )
  }

  if (company.isError || !company.data) {
    return (
      <View style={styles.root}>
        {header}
        <EmptyState
          illustration={<Icon name="wifi-off" size={64} color={colors.neutral[300]} />}
          title="Couldn't load company"
          description="Check your connection and try again"
          ctaLabel="Retry"
          ctaVariant="primary"
          onCta={() => void company.refetch()}
        />
      </View>
    )
  }

  const c = company.data
  const cover = c.pitches.find(p => p.coverPhotoUrl)?.coverPhotoUrl ?? null
  const reviewItems = reviews.data?.pages.flatMap(p => p.reviews) ?? []
  const firstPage = reviews.data?.pages[0]

  return (
    <View style={styles.root}>
      {header}
      <Animated.ScrollView
        stickyHeaderIndices={[1]}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
          listener: (e: {
            nativeEvent: {
              layoutMeasurement: { height: number }
              contentOffset: { y: number }
              contentSize: { height: number }
            }
          }) => {
            // Infinite reviews: load the next page within 300px of the end.
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
            const nearEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 300
            if (
              tab === 'reviews' &&
              nearEnd &&
              reviews.hasNextPage &&
              !reviews.isFetchingNextPage
            ) {
              void reviews.fetchNextPage()
            }
          },
        })}
        contentContainerStyle={styles.content}
      >
        <View>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.hero} resizeMode="cover" />
          ) : (
            <View style={[styles.hero, styles.heroFallback]} />
          )}
          <CompanyHero company={c} />
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {(['pitches', 'reviews'] as const).map(t => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'pitches' ? 'Pitches' : 'Reviews'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'pitches' ? (
          <View style={styles.list}>
            {c.pitches.length === 0 ? (
              <Text style={styles.empty}>No pitches available</Text>
            ) : (
              c.pitches.map(p => (
                <PitchListCard
                  key={p.id}
                  pitch={p}
                  onPress={() =>
                    navigation.navigate('PitchDetail', { pitchId: p.id, companyId: c.id })
                  }
                />
              ))
            )}
          </View>
        ) : (
          <View style={styles.padded}>
            {pitchId ? (
              <Pressable
                onPress={() => navigation.setParams({ pitchId: undefined })}
                style={styles.filter}
              >
                <Text style={styles.filterText}>
                  Showing {c.pitches.find(p => p.id === pitchId)?.name ?? 'one pitch'} · Show all
                </Text>
              </Pressable>
            ) : null}
            {reviews.isPending ? (
              <ActivityIndicator style={styles.gapLg} color={colors.primary[600]} />
            ) : reviews.isError ? (
              <EmptyState
                illustration={<Icon name="wifi-off" size={64} color={colors.neutral[300]} />}
                title="Couldn't load reviews"
                description="Check your connection and try again"
                ctaLabel="Retry"
                ctaVariant="primary"
                onCta={() => void reviews.refetch()}
              />
            ) : firstPage && firstPage.total === 0 ? (
              <EmptyState
                illustration={<Icon name="message-outline" size={64} color={colors.neutral[300]} />}
                title="No reviews yet"
                description="Be the first to review after your booking"
              />
            ) : (
              <>
                {firstPage ? <RatingBreakdown page={firstPage} /> : null}
                <ReviewSortSelector value={sort} onChange={setSort} />
                {reviewItems.map(r => (
                  <ReviewCard key={r.id} review={r} />
                ))}
                {reviews.isFetchingNextPage ? (
                  <ActivityIndicator style={styles.gap} color={colors.primary[600]} />
                ) : null}
              </>
            )}
          </View>
        )}
      </Animated.ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { paddingBottom: 32 },
  hero: { width: '100%', height: HERO_HEIGHT },
  heroFallback: { backgroundColor: colors.primary[50] },
  tabs: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    paddingHorizontal: 16,
    gap: 24,
  },
  tab: { justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary[600] },
  tabText: { fontSize: 16, fontWeight: '600', color: colors.neutral[400] },
  tabTextActive: { color: colors.neutral[900] },
  list: { padding: 16, gap: 12 },
  padded: { paddingHorizontal: 16 },
  empty: { paddingVertical: 40, textAlign: 'center', fontSize: 14, color: colors.neutral[500] },
  filter: { paddingTop: 12 },
  filterText: { fontSize: 13, fontWeight: '500', color: colors.primary[600] },
  skeletonLogo: { marginTop: -40, marginBottom: 12 },
  gap: { marginTop: 12 },
  gapLg: { marginTop: 24 },
})
