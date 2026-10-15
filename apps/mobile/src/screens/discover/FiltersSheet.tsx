/**
 * Filters bottom sheet — E03-06, UIUX_SPEC §5.4.
 *
 * Edits a draft. However the sheet is closed — backdrop, drag, or the
 * "Show results" button — the draft is applied; "Reset all" clears it. The
 * list behind therefore refetches once on close, not once per tap.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  AMENITY_FILTERS,
  DEFAULT_FILTERS,
  DISCOVER,
  FILTERABLE_SIZES,
  SIZE_LABELS,
  SURFACE_LABELS,
  priceBound,
  type DiscoverFilters,
  type SurfaceType,
} from '@pitchup/shared'
import { Button } from '../../components/ui/Button'
import { FilterChip, type ChipColors } from '../../components/filters/FilterChip'
import { FilterSection } from '../../components/filters/FilterSection'
import { SizeInfo } from '../../components/pitch/SizeInfo'
import { RangeSlider } from '../../components/filters/RangeSlider'
import { effectiveSort, useDiscoverStore } from '../../stores/discoverStore'
import { useCompanyCount } from '../../hooks/useCompanies'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { colors, shadows } from '../../theme/tokens'

const SURFACE_COLORS: Record<SurfaceType, ChipColors> = {
  NATURAL_GRASS: { background: '#F0FDF4', text: '#15803D' },
  ARTIFICIAL_GRASS: { background: '#EFF6FF', text: '#1D4ED8' },
  FUTSAL: { background: '#FEF3C7', text: '#92400E' },
}

const AMENITY_ICONS: Record<string, string> = {
  showers: 'shower',
  changing: 'hanger',
  parking: 'parking',
  lighting: 'stadium',
  ball: 'soccer',
  refreshments: 'food',
  lockers: 'lock-outline',
  referee: 'whistle',
  firstAid: 'medical-bag',
  wifi: 'wifi',
  wheelchair: 'wheelchair-accessibility',
}

const SURFACES = Object.keys(SURFACE_LABELS) as SurfaceType[]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}

interface FiltersSheetProps {
  visible: boolean
  onClose: () => void
}

export function FiltersSheet({ visible, onClose }: FiltersSheetProps) {
  const { height: screenHeight } = useWindowDimensions()
  const sheetHeight = Math.round(screenHeight * 0.8)
  const insets = useSafeAreaInsets()

  const applied = useDiscoverStore(s => s.filters)
  const setFilters = useDiscoverStore(s => s.setFilters)
  const city = useDiscoverStore(s => s.selectedCity)
  const search = useDiscoverStore(s => s.search)
  const coords = useDiscoverStore(s => s.userCoords)
  const sort = useDiscoverStore(s => s.sort)

  const [draft, setDraft] = useState<DiscoverFilters>(applied)
  // The slider moves continuously; the count waits until it settles.
  const [price, setPrice] = useState<{ low: number; high: number }>({
    low: DISCOVER.PRICE_MIN,
    high: DISCOVER.PRICE_MAX,
  })

  const translateY = useRef(new Animated.Value(sheetHeight)).current

  useEffect(() => {
    if (!visible) return
    setDraft(applied)
    setPrice({
      low: applied.priceMin ?? DISCOVER.PRICE_MIN,
      high: applied.priceMax ?? DISCOVER.PRICE_MAX,
    })
    translateY.setValue(sheetHeight)
    Animated.spring(translateY, {
      toValue: 0,
      damping: 20,
      stiffness: 300,
      useNativeDriver: true,
    }).start()
    // Only on open: re-syncing while open would discard the user's edits.
  }, [visible])

  const withPrice: DiscoverFilters = useMemo(
    () => ({
      ...draft,
      priceMin: priceBound(price.low, 'min'),
      priceMax: priceBound(price.high, 'max'),
    }),
    [draft, price]
  )
  const debounced = useDebouncedValue(withPrice, 500)
  const count = useCompanyCount(
    { city, search, coords, sort: effectiveSort(sort, coords), filters: debounced },
    visible
  )

  const closeRef = useRef<() => void>(() => undefined)
  closeRef.current = () => {
    setFilters(withPrice)
    Animated.timing(translateY, {
      toValue: sheetHeight,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onClose())
  }
  const close = () => closeRef.current()

  // Drag the handle down to dismiss (which applies, like any close).
  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_e, g) => translateY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 100 || g.vy > 1) closeRef.current()
          else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start()
        },
      }),
    [translateY]
  )

  const set = (patch: Partial<DiscoverFilters>) => setDraft(d => ({ ...d, ...patch }))

  function resetAll() {
    setDraft(DEFAULT_FILTERS)
    setPrice({ low: DISCOVER.PRICE_MIN, high: DISCOVER.PRICE_MAX })
  }

  const buttonLabel =
    count.data === undefined
      ? 'Show results'
      : `Show ${count.data} ${count.data === 1 ? 'result' : 'results'}`

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close filters" />
      <Animated.View style={[styles.sheet, { height: sheetHeight, transform: [{ translateY }] }]}>
        <View {...drag.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <Pressable onPress={resetAll} style={styles.reset} accessibilityRole="button">
            <Text style={styles.resetText}>Reset all</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <FilterSection title="Surface type" first>
            <View style={styles.chipRow}>
              {SURFACES.map(s => (
                <FilterChip
                  key={s}
                  label={SURFACE_LABELS[s]}
                  selected={draft.surfaces.includes(s)}
                  selectedColors={SURFACE_COLORS[s]}
                  onPress={() => set({ surfaces: toggle(draft.surfaces, s) })}
                />
              ))}
            </View>
          </FilterSection>

          <FilterSection title="Pitch size" titleAccessory={<SizeInfo />}>
            <View style={styles.chipRow}>
              {FILTERABLE_SIZES.map(s => (
                <FilterChip
                  key={s}
                  label={SIZE_LABELS[s]}
                  selected={draft.sizes.includes(s)}
                  onPress={() => set({ sizes: toggle(draft.sizes, s) })}
                />
              ))}
            </View>
          </FilterSection>

          <FilterSection title="Amenities">
            <View style={styles.grid}>
              {AMENITY_FILTERS.map(a => (
                <FilterChip
                  key={a.key}
                  label={a.label}
                  icon={AMENITY_ICONS[a.key]}
                  height={36}
                  style={styles.gridCell}
                  selected={draft.amenities.includes(a.key)}
                  onPress={() => set({ amenities: toggle(draft.amenities, a.key) })}
                />
              ))}
            </View>
          </FilterSection>

          <FilterSection title="Price per hour" aside={`${price.low} – ${price.high} RON`}>
            <RangeSlider
              min={DISCOVER.PRICE_MIN}
              max={DISCOVER.PRICE_MAX}
              step={DISCOVER.PRICE_STEP}
              low={price.low}
              high={price.high}
              onChange={(low, high) => setPrice({ low, high })}
            />
          </FilterSection>

          <FilterSection title="Availability">
            <ToggleRow
              label="Available now"
              value={draft.availableNow}
              onChange={v => set({ availableNow: v })}
            />
            <Text style={styles.hint}>
              Open, with a pitch free for the next {DISCOVER.AVAILABLE_NOW_WINDOW_HOURS} hours.
            </Text>
          </FilterSection>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          <Button
            label={buttonLabel}
            onPress={close}
            loading={count.isFetching && count.data === undefined}
          />
        </View>
      </Animated.View>
    </Modal>
  )
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary[600], false: colors.neutral[300] }}
        thumbColor={colors.neutral[0]}
        accessibilityLabel={label}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.neutral[500], marginTop: 4 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    ...shadows.xl,
  },
  handleArea: { paddingTop: 8, paddingBottom: 4, alignItems: 'center' },
  handle: { width: 32, height: 4, borderRadius: 2, backgroundColor: colors.neutral[300] },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  title: { flex: 1, fontSize: 18, lineHeight: 26, fontWeight: '600', color: colors.neutral[900] },
  reset: { height: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 16 },
  resetText: { fontSize: 13, fontWeight: '500', color: colors.primary[600] },
  content: { flex: 1 },
  contentInner: { paddingBottom: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Two columns: half the row minus half the gap.
  gridCell: { width: '48.5%' },
  toggleRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: { fontSize: 14, color: colors.neutral[900] },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
  },
})
