'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  List,
  Map as MapIcon,
  MapPin,
  Search,
  SearchX,
  SlidersHorizontal,
  WifiOff,
  X,
} from 'lucide-react'
import {
  CITY_NAMES,
  DEFAULT_FILTERS,
  DISCOVER,
  companyListQueryString,
  hasActiveFilters,
  nearestCity,
  type CompanyListPage,
  type CompanySort,
} from '@pitchup/shared'
import { Button } from '@/components/ui/Button'
import { CompanyCard, CompanyCardSkeleton } from '@/components/discover/CompanyCard'
import { FilterSidebar } from '@/components/discover/FilterSidebar'
import { CityDialog, type DetectResult } from '@/components/discover/CityDialog'
import { MapView } from '@/components/discover/MapView'
import { readUrlState, writeUrlState, type DiscoverUrlState } from '@/lib/discover/url-state'
import { useT } from '@/i18n/client'

const CITY_STORAGE_KEY = 'pitchup.city'

type Coords = { lat: number; lng: number }

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 10_000,
      maximumAge: 5 * 60 * 1000,
      enableHighAccuracy: false,
    })
  )
}

async function fetchCompanies(query: string): Promise<CompanyListPage> {
  const res = await fetch(`/api/v1/companies?${query}`)
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.data) throw new Error(body?.error?.message ?? res.statusText)
  return body.data as CompanyListPage
}

/** Player Discover page — E03-08. All view state lives in the URL. */
export function DiscoverClient() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const state = useMemo(
    () => readUrlState(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  const update = useCallback(
    (patch: Partial<DiscoverUrlState>) => {
      const next = writeUrlState({ ...state, ...patch })
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    },
    [state, router, pathname]
  )

  const [coords, setCoords] = useState<Coords | null>(null)
  const [cityDialogOpen, setCityDialogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [resolvingCity, setResolvingCity] = useState(!state.city)

  const detect = useCallback(async (): Promise<DetectResult> => {
    if (!('geolocation' in navigator)) return 'unsupported'
    try {
      const { coords: c } = await getPosition()
      setCoords({ lat: c.latitude, lng: c.longitude })
      const city = nearestCity(c.latitude, c.longitude)
      if (!city) return 'error'
      localStorage.setItem(CITY_STORAGE_KEY, city.name)
      update({ city: city.name })
      setCityDialogOpen(false)
      return 'detected'
    } catch (caught) {
      return (caught as GeolocationPositionError).code === 1 ? 'denied' : 'error'
    }
  }, [update])

  // First visit without ?city: the remembered city, else ask the browser,
  // else the picker. Runs once; later changes go through the banner.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true

    // Already granted earlier: take the position quietly for distances,
    // without a prompt the user did not ask for.
    void navigator.permissions
      ?.query({ name: 'geolocation' })
      .then(status => {
        if (status.state !== 'granted') return
        return getPosition().then(p =>
          setCoords({ lat: p.coords.latitude, lng: p.coords.longitude })
        )
      })
      .catch(() => undefined)

    if (state.city) {
      localStorage.setItem(CITY_STORAGE_KEY, state.city)
      return
    }
    const remembered = localStorage.getItem(CITY_STORAGE_KEY)
    if (remembered && CITY_NAMES.includes(remembered)) {
      update({ city: remembered })
      setResolvingCity(false)
      return
    }
    void detect().then(result => {
      setResolvingCity(false)
      if (result !== 'detected') setCityDialogOpen(true)
    })
  }, [state.city, update, detect])

  // Search box: local for typing, written to the URL after 300ms idle.
  const [searchInput, setSearchInput] = useState(state.search)
  useEffect(() => setSearchInput(state.search), [state.search])
  useEffect(() => {
    if (searchInput === state.search) return
    const timer = setTimeout(() => update({ search: searchInput }), DISCOVER.SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput, state.search, update])

  // Nearest is only meaningful with a position; without one the API would
  // fall back to rating anyway, so say so in the UI too.
  const sort: CompanySort =
    state.sort && !(state.sort === 'distance' && !coords)
      ? state.sort
      : coords
        ? 'distance'
        : 'rating'

  const baseQuery = state.city
    ? companyListQueryString({
        city: state.city,
        search: state.search,
        sort,
        coords,
        filters: state.filters,
      })
    : ''

  const query = useInfiniteQuery({
    queryKey: ['companies', baseQuery],
    queryFn: ({ pageParam }) =>
      fetchCompanies(
        pageParam ? `${baseQuery}&cursor=${encodeURIComponent(pageParam)}` : baseQuery
      ),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    enabled: !!state.city,
  })

  const companies = query.data?.pages.flatMap(p => p.companies) ?? []
  const total = query.data?.pages[0]?.total
  const filtersActive = hasActiveFilters(state.filters)

  const sidebar = (
    <FilterSidebar
      filters={state.filters}
      sort={sort}
      canSortByDistance={!!coords}
      onFiltersChange={filters => update({ filters })}
      onSortChange={s => update({ sort: s })}
      onReset={() => update({ filters: DEFAULT_FILTERS })}
    />
  )

  return (
    <>
      <div className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 lg:px-6">
          <MapPin className="h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
          <p className="text-base text-neutral-700">
            {state.city ? (
              <ShowingIn city={state.city} />
            ) : resolvingCity ? (
              t('discover.findingCity')
            ) : (
              t('discover.chooseCity')
            )}
          </p>
          <button
            type="button"
            onClick={() => setCityDialogOpen(true)}
            className="ml-2 text-sm font-medium text-primary-600 hover:underline"
          >
            {t('discover.change')}
          </button>
        </div>
      </div>

      <main className="mx-auto flex max-w-7xl gap-8 px-4 py-6 lg:px-6">
        <aside className="hidden w-[280px] shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6 pr-2">
            {sidebar}
          </div>
        </aside>

        <section className="min-w-0 flex-1" aria-label={t('discover.companies')}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 focus-within:ring-2 focus-within:ring-primary-600">
              <Search className="h-4 w-4 text-neutral-500" aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder={t('discover.search')}
                aria-label={t('discover.searchLabel')}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-500 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label={t('discover.clearSearch')}
                >
                  <X className="h-4 w-4 text-neutral-500" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="relative flex h-10 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {t('discover.filters')}
              {filtersActive && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary-600" />
              )}
            </button>

            <div
              role="tablist"
              aria-label={t('discover.view')}
              className="flex h-10 rounded-md border border-neutral-200 bg-white p-1"
            >
              {(['list', 'map'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={state.view === mode}
                  onClick={() => update({ view: mode })}
                  className={`flex items-center gap-1.5 rounded px-3 text-sm font-medium ${
                    state.view === mode
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {mode === 'list' ? <List className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
                  {mode === 'list' ? t('discover.list') : t('discover.map')}
                </button>
              ))}
            </div>
          </div>

          {total !== undefined && (
            <p className="mt-4 text-sm text-neutral-500" aria-live="polite">
              {t('discover.venues', { count: total })}
            </p>
          )}

          <div className="mt-3">
            {!state.city ? null : query.isPending ? (
              <Grid>
                {Array.from({ length: 6 }, (_, i) => (
                  <CompanyCardSkeleton key={i} />
                ))}
              </Grid>
            ) : query.isError ? (
              <EmptyState
                icon={<WifiOff className="h-16 w-16 text-neutral-300" aria-hidden="true" />}
                title={t('discover.loadError')}
                description={t('discover.loadErrorHint')}
                action={<Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>}
              />
            ) : companies.length === 0 ? (
              <EmptyState
                icon={<SearchX className="h-16 w-16 text-neutral-300" aria-hidden="true" />}
                title={t('discover.none', { city: state.city })}
                description={t('discover.noneHint')}
                action={
                  <Button
                    variant="secondary"
                    onClick={() => update({ filters: DEFAULT_FILTERS, search: '' })}
                  >
                    {t('discover.clearFilters')}
                  </Button>
                }
              />
            ) : state.view === 'map' ? (
              <MapView companies={companies} city={state.city} coords={coords} />
            ) : (
              <>
                <Grid>
                  {companies.map(c => (
                    <CompanyCard key={c.id} company={c} />
                  ))}
                </Grid>
                {query.hasNextPage && (
                  <div className="mt-6 flex justify-center">
                    <div className="w-48">
                      <Button
                        variant="secondary"
                        loading={query.isFetchingNextPage}
                        onClick={() => void query.fetchNextPage()}
                      >
                        {t('discover.loadMore')}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('discover.filters')}
            onClick={e => e.stopPropagation()}
            className="absolute inset-y-0 left-0 flex w-[min(320px,90vw)] flex-col bg-white shadow-xl"
          >
            <div className="flex-1 overflow-y-auto p-4">{sidebar}</div>
            <div className="border-t border-neutral-200 p-4">
              <Button onClick={() => setDrawerOpen(false)}>
                {total !== undefined
                  ? t('discover.showCount', { count: total })
                  : t('discover.showResults')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <CityDialog
        open={cityDialogOpen}
        selected={state.city}
        dismissible={!!state.city}
        onClose={() => setCityDialogOpen(false)}
        onSelect={city => {
          localStorage.setItem(CITY_STORAGE_KEY, city)
          update({ city })
          setCityDialogOpen(false)
        }}
        onDetect={detect}
      />
    </>
  )
}

/** "Showing pitches in **Cluj-Napoca**", the city in bold wherever the language puts it. */
function ShowingIn({ city }: { city: string }) {
  const t = useT()
  const [before, after = ''] = t('discover.showingIn', { city: '\u0000' }).split('\u0000')
  return (
    <>
      {before}
      <strong className="text-neutral-900">{city}</strong>
      {after}
    </>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">{children}</div>
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      {icon}
      <h2 className="mt-4 text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="mt-2 max-w-[240px] text-sm text-neutral-500">{description}</p>
      <div className="mt-5 w-40">{action}</div>
    </div>
  )
}
