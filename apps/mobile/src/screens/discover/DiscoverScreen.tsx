/**
 * Discover — E03-02 … E03-07, UIUX_SPEC §5.1.
 *
 * Header, location banner, search and sort stay fixed; the list or the map
 * fills the rest. Once opened, the map stays mounted while the list is shown,
 * so switching back does not reload tiles or lose the viewport.
 */
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import {
  COMPANY_SORTS,
  DISCOVER,
  SORT_LABELS,
  hasActiveFilters,
  type CompanyListItem,
} from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { FilterChip } from '../../components/filters/FilterChip'
import { effectiveSort, useDiscoverStore } from '../../stores/discoverStore'
import { useCompanies } from '../../hooks/useCompanies'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useLocation } from '../../hooks/useLocation'
import { colors, shadows } from '../../theme/tokens'
import { CityBlocker } from './CityBlocker'
import { CitySelector } from './CitySelector'
import { DiscoverListView } from './DiscoverListView'
import { DiscoverMapView } from './DiscoverMapView'
import { FiltersSheet } from './FiltersSheet'

type Props = NativeStackScreenProps<AppStackParamList, 'Discover'>

export function DiscoverScreen({ navigation }: Props) {
  const store = useDiscoverStore()
  const { requestAndDetect } = useLocation()

  const [citySelectorOpen, setCitySelectorOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [permissionBlocked, setPermissionBlocked] = useState(false)
  const [mapMounted, setMapMounted] = useState(store.viewMode === 'map')

  useEffect(() => {
    if (!store.hydrated) void store.hydrate()
  }, [store])

  // First visit with no saved city: ask for location once, automatically.
  // Denial is not an error — the blocker offers manual selection.
  useEffect(() => {
    if (!store.hydrated || store.selectedCity || store.autoDetectAttempted) return
    store.markAutoDetectAttempted()
    setDetecting(true)
    void requestAndDetect().then(result => {
      setDetecting(false)
      if (result === 'blocked') setPermissionBlocked(true)
    })
  }, [store, requestAndDetect])

  // Search: typed text is local; the query follows 300ms after typing stops.
  const [searchInput, setSearchInput] = useState(store.search)
  const debouncedSearch = useDebouncedValue(searchInput, DISCOVER.SEARCH_DEBOUNCE_MS)
  useEffect(() => {
    if (debouncedSearch !== store.search) store.setSearch(debouncedSearch)
  }, [debouncedSearch, store])

  const sort = effectiveSort(store.sort, store.userCoords)
  const query = useCompanies({
    city: store.selectedCity,
    search: store.search,
    sort,
    coords: store.userCoords,
    filters: store.filters,
  })
  const companies = query.data?.pages.flatMap(p => p.companies) ?? []

  // "Nearest" only exists when there is a position to be near.
  const sorts = COMPANY_SORTS.filter(s => s !== 'distance' || store.userCoords)

  function openCompany(company: CompanyListItem) {
    navigation.navigate('CompanyDetail', { id: company.id, name: company.name })
  }

  function toggleView() {
    const next = store.viewMode === 'list' ? 'map' : 'list'
    if (next === 'map') setMapMounted(true)
    store.setViewMode(next)
  }

  const showBlocker = store.hydrated && !store.selectedCity && !detecting
  const filtersActive = hasActiveFilters(store.filters)

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>PitchUp</Text>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={filtersActive ? 'Filters, active' : 'Filters'}
          disabled={!store.selectedCity}
        >
          <Icon name="tune" size={24} color={colors.neutral[900]} />
          {filtersActive ? <View style={styles.badge} /> : null}
        </Pressable>
      </View>

      <Pressable
        onPress={() => setCitySelectorOpen(true)}
        style={styles.banner}
        accessibilityRole="button"
        accessibilityLabel={`Pitches in ${store.selectedCity ?? 'no city'}. Change city`}
      >
        <Icon name="map-marker" size={18} color={colors.primary[600]} />
        <Text style={styles.bannerText} numberOfLines={1}>
          Pitches in <Text style={styles.bannerCity}>{store.selectedCity ?? '—'}</Text>
        </Text>
        <Text style={styles.change}>Change</Text>
      </Pressable>

      <View style={styles.search}>
        <Icon name="magnify" size={18} color={colors.neutral[400]} />
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search companies..."
          placeholderTextColor={colors.neutral[400]}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.searchInput}
          accessibilityLabel="Search companies"
        />
        {searchInput ? (
          <Pressable
            onPress={() => setSearchInput('')}
            style={styles.clear}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Icon name="close-circle" size={18} color={colors.neutral[400]} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.sortRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortChips}
        >
          {sorts.map(s => (
            <FilterChip
              key={s}
              label={SORT_LABELS[s]}
              selected={s === sort}
              onPress={() => store.setSort(s)}
            />
          ))}
        </ScrollView>
        <Pressable
          onPress={toggleView}
          style={styles.toggle}
          accessibilityRole="button"
          accessibilityLabel={store.viewMode === 'list' ? 'Show map' : 'Show list'}
        >
          <Icon
            name={store.viewMode === 'list' ? 'map-outline' : 'format-list-bulleted'}
            size={20}
            color={colors.neutral[900]}
          />
        </Pressable>
      </View>

      <View style={styles.body}>
        {store.selectedCity ? (
          <>
            <View
              style={[StyleSheet.absoluteFill, store.viewMode !== 'list' && styles.hidden]}
              pointerEvents={store.viewMode === 'list' ? 'auto' : 'none'}
            >
              <DiscoverListView
                companies={companies}
                city={store.selectedCity}
                isLoading={query.isPending}
                isError={query.isError}
                isRefreshing={query.isRefetching && !query.isFetchingNextPage}
                isFetchingNextPage={query.isFetchingNextPage}
                hasNextPage={query.hasNextPage}
                onRefresh={() => void query.refetch()}
                onEndReached={() => void query.fetchNextPage()}
                onClearFilters={() => {
                  store.resetFilters()
                  setSearchInput('')
                }}
                onOpenCompany={openCompany}
              />
            </View>
            {mapMounted ? (
              <View
                style={[StyleSheet.absoluteFill, store.viewMode !== 'map' && styles.hidden]}
                pointerEvents={store.viewMode === 'map' ? 'auto' : 'none'}
              >
                <DiscoverMapView companies={companies} onOpenCompany={openCompany} />
              </View>
            ) : null}
          </>
        ) : null}

        {!store.hydrated || detecting ? (
          <View style={styles.detecting}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.detectingText}>Finding pitches near you…</Text>
          </View>
        ) : null}
      </View>

      {showBlocker ? (
        <CityBlocker
          onSelectManually={() => setCitySelectorOpen(true)}
          permissionBlocked={permissionBlocked}
          onPermissionBlocked={() => setPermissionBlocked(true)}
        />
      ) : null}

      <CitySelector visible={citySelectorOpen} onClose={() => setCitySelectorOpen(false)} />
      <FiltersSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[50] },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 6,
    backgroundColor: colors.neutral[0],
    zIndex: 1,
    ...shadows.xs,
  },
  wordmark: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: colors.primary[600],
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[600],
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.neutral[700] },
  bannerCity: { fontWeight: '700' },
  change: { fontSize: 13, fontWeight: '500', color: colors.primary[600] },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingLeft: 16,
    borderRadius: 9999,
    backgroundColor: colors.neutral[100],
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.neutral[900], paddingVertical: 0 },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sortRow: { flexDirection: 'row', alignItems: 'center' },
  sortChips: { paddingLeft: 16, paddingRight: 72, paddingVertical: 8, gap: 8 },
  toggle: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },
  body: { flex: 1 },
  hidden: { opacity: 0 },
  detecting: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.neutral[50],
  },
  detectingText: { fontSize: 14, color: colors.neutral[500] },
})
