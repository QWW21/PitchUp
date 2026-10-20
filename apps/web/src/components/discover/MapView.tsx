'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { GoogleMap, OverlayViewF, OverlayView, useJsApiLoader } from '@react-google-maps/api'
import { MapPinOff, X } from 'lucide-react'
import { mapCenter, type CompanyListItem } from '@pitchup/shared'
import { env } from '@/lib/env'
import { CompanyLogo, CompanySummary } from './CompanyCard'
import { useT } from '@/i18n/client'

interface MapViewProps {
  companies: CompanyListItem[]
  city: string
  coords: { lat: number; lng: number } | null
}

/** Discover map: a price pill per company, preview card on click. E03-08. */
export function MapView(props: MapViewProps) {
  const t = useT()
  const apiKey = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return <MapMessage>{t('discover.mapView.noKey')}</MapMessage>
  return <GoogleMapView apiKey={apiKey} {...props} />
}

function GoogleMapView({ apiKey, companies, city, coords }: MapViewProps & { apiKey: string }) {
  const t = useT()
  const { isLoaded, loadError } = useJsApiLoader({ id: 'google-maps', googleMapsApiKey: apiKey })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // On the user when they are in the selected city, otherwise on that city's
  // centre. Memoised so a re-render does not snap the map back while the
  // user is panning; a new city moves it.
  const center = useMemo(() => mapCenter(city, coords), [coords, city])

  // A company without coordinates is a data error; leave it off the map.
  const placed = companies.filter(c => c.lat !== null && c.lng !== null)
  const selected = placed.find(c => c.id === selectedId) ?? null

  if (loadError) return <MapMessage>{t('discover.mapView.loadError')}</MapMessage>
  if (!isLoaded) return <div className="h-[600px] animate-pulse rounded-xl bg-neutral-100" />

  return (
    <div
      data-testid="discover-map"
      className="relative h-[600px] overflow-hidden rounded-xl shadow-sm"
    >
      <GoogleMap
        mapContainerClassName="h-full w-full"
        center={center}
        zoom={12}
        onClick={() => setSelectedId(null)}
        options={{ streetViewControl: false, mapTypeControl: false, clickableIcons: false }}
      >
        {placed.map(c => (
          <OverlayViewF
            key={c.id}
            position={{ lat: c.lat!, lng: c.lng! }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={(w, h) => ({ x: -w / 2, y: -h })}
          >
            <PricePill
              label={t('discover.mapView.pill', { name: c.name, price: c.priceFrom })}
              priceFrom={c.priceFrom}
              selected={c.id === selectedId}
              onSelect={() => setSelectedId(c.id)}
            />
          </OverlayViewF>
        ))}
      </GoogleMap>

      {selected && (
        <div className="absolute inset-x-3 bottom-3 rounded-xl bg-white p-4 shadow-xl sm:left-auto sm:w-96">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label={t('discover.mapView.closePreview')}
            className="absolute right-2 top-2 rounded-full p-1 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex gap-3 pr-6">
            <CompanyLogo url={selected.logoUrl} name={selected.name} />
            <CompanySummary company={selected} />
          </div>
          <Link
            href={`/discover/${selected.id}`}
            className="mt-3 flex h-10 items-center justify-center rounded-md bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {t('discover.mapView.viewCompany')}
          </Link>
        </div>
      )}
    </div>
  )
}

interface PricePillProps {
  label: string
  priceFrom: number
  selected: boolean
  onSelect: () => void
}

/**
 * The listener is attached natively, not through onClick. Google Maps stops
 * events inside its panes before they bubble to React's root listener, so a
 * React onClick on overlay content never fires. Stopping propagation here
 * also keeps the map's own click (which deselects) from running.
 */
function PricePill({ label, priceFrom, selected, onSelect }: PricePillProps) {
  const t = useT()
  const ref = useRef<HTMLButtonElement>(null)
  const latest = useRef(onSelect)
  latest.current = onSelect

  useEffect(() => {
    const button = ref.current
    if (!button) return
    const handle = (e: Event) => {
      e.stopPropagation()
      latest.current()
    }
    button.addEventListener('click', handle)
    return () => button.removeEventListener('click', handle)
  }, [])

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={selected}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium shadow-md transition-transform ${
        selected ? 'z-10 scale-110 bg-primary-600 text-white' : 'bg-white text-neutral-900'
      }`}
    >
      {t('discover.mapView.pillText', { price: priceFrom })}
    </button>
  )
}

function MapMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[600px] flex-col items-center justify-center gap-3 rounded-xl bg-white p-8 text-center text-sm text-neutral-500 shadow-sm">
      <MapPinOff className="h-10 w-10 text-neutral-300" aria-hidden="true" />
      <p className="max-w-sm">{children}</p>
    </div>
  )
}
