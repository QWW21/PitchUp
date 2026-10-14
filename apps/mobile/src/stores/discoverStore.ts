/**
 * Discover state — E03-02, E03-04, E03-06.
 *
 * Only the city survives an app restart (AsyncStorage). Coordinates are
 * re-acquired each session, and sort, search, filters and view mode reset,
 * per the tickets.
 */
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  CITY_NAMES,
  DEFAULT_FILTERS,
  type CompanySort,
  type DiscoverFilters,
} from '@pitchup/shared'

export const SELECTED_CITY_KEY = 'selected_city'

export type Coords = { lat: number; lng: number }
export type ViewMode = 'list' | 'map'

interface DiscoverState {
  /** False until the stored city has been read; nothing should decide on `selectedCity` before. */
  hydrated: boolean
  selectedCity: string | null
  userCoords: Coords | null
  /** The automatic permission request happens once per session, on first visit. */
  autoDetectAttempted: boolean
  /** Null = the default for the current coordinates (Nearest, else Top rated). */
  sort: CompanySort | null
  search: string
  viewMode: ViewMode
  filters: DiscoverFilters

  hydrate: () => Promise<void>
  setCity: (city: string) => void
  setCoords: (coords: Coords) => void
  markAutoDetectAttempted: () => void
  setSort: (sort: CompanySort) => void
  setSearch: (search: string) => void
  setViewMode: (mode: ViewMode) => void
  setFilters: (filters: DiscoverFilters) => void
  resetFilters: () => void
}

export const useDiscoverStore = create<DiscoverState>(set => ({
  hydrated: false,
  selectedCity: null,
  userCoords: null,
  autoDetectAttempted: false,
  sort: null,
  search: '',
  viewMode: 'list',
  filters: DEFAULT_FILTERS,

  async hydrate() {
    const stored = await AsyncStorage.getItem(SELECTED_CITY_KEY).catch(() => null)
    // A city dropped from the list since it was saved is treated as none.
    set({ hydrated: true, selectedCity: stored && CITY_NAMES.includes(stored) ? stored : null })
  },

  setCity(city) {
    set({ selectedCity: city })
    void AsyncStorage.setItem(SELECTED_CITY_KEY, city)
  },

  setCoords: userCoords => set({ userCoords }),
  markAutoDetectAttempted: () => set({ autoDetectAttempted: true }),
  setSort: sort => set({ sort }),
  setSearch: search => set({ search }),
  setViewMode: viewMode => set({ viewMode }),
  setFilters: filters => set({ filters }),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
}))

/** The sort actually sent: Nearest needs coordinates, so it falls back to Top rated. */
export function effectiveSort(sort: CompanySort | null, coords: Coords | null): CompanySort {
  if (sort && !(sort === 'distance' && !coords)) return sort
  return coords ? 'distance' : 'rating'
}
