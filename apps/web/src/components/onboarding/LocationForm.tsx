'use client'

/**
 * Onboarding step 2 — E09-07. The address, and a map pin placed by looking
 * the address up in the browser (Google's geocoder, 800 ms after typing
 * stops) that the manager can drag. The pin's coordinates are sent with the
 * form; without a map (no key, or Google says no), the server tries itself.
 */
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { Loader2 } from 'lucide-react'
import { CITIES, CITY_NAMES, CompanyLocationSchema } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { TextField } from '@/components/ui/TextField'
import { env } from '@/lib/env'
import { send } from '@/lib/http'

interface Values {
  addressLine1: string
  addressLine2: string
  city: string
  county: string
  postalCode: string
  lat: number | null
  lng: number | null
}
type Field = 'addressLine1' | 'addressLine2' | 'city' | 'county' | 'postalCode'

export function LocationForm({ existing }: { existing: Values }) {
  const router = useRouter()
  const [v, setV] = useState(existing)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (field: Field) => (e: { target: { value: string } }) =>
    setV(prev => ({ ...prev, [field]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = CompanyLocationSchema.safeParse({
      ...v,
      lat: v.lat ?? undefined,
      lng: v.lng ?? undefined,
    })
    if (!parsed.success) {
      const found: Partial<Record<Field, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field | undefined
        if (key && !found[key]) found[key] = issue.message
      }
      setErrors(found)
      return
    }
    setErrors({})
    setBusy(true)
    try {
      await send('/api/v1/onboarding/location', 'PUT', parsed.data)
      router.push('/onboarding/step/3')
    } catch (caught) {
      setError((caught as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 space-y-5">
      <TextField
        label="Address"
        value={v.addressLine1}
        onChange={set('addressLine1')}
        placeholder="Str. Sportului 1"
        maxLength={100}
        error={errors.addressLine1}
        autoComplete="address-line1"
      />
      <TextField
        label="Address line 2 (optional)"
        value={v.addressLine2}
        onChange={set('addressLine2')}
        maxLength={100}
        autoComplete="address-line2"
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-neutral-900">
            City
          </label>
          <select
            id="city"
            value={v.city}
            onChange={set('city')}
            aria-invalid={errors.city ? true : undefined}
            className="h-12 w-full rounded-md border border-neutral-200 bg-white px-3 text-base"
          >
            <option value="">Choose a city</option>
            {CITY_NAMES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.city && <p className="mt-1.5 text-sm text-error-600">{errors.city}</p>}
        </div>
        <TextField
          label="Postal code"
          value={v.postalCode}
          onChange={set('postalCode')}
          maxLength={10}
          error={errors.postalCode}
          autoComplete="postal-code"
        />
        <TextField
          label="County"
          value={v.county}
          onChange={set('county')}
          maxLength={60}
          error={errors.county}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-900">Country</p>
          <p className="flex h-12 items-center rounded-md bg-neutral-100 px-3 text-base text-neutral-700">
            Romania
          </p>
        </div>
      </div>

      <AddressMap
        address={
          v.addressLine1.trim().length >= 5 && v.city ? `${v.addressLine1}, ${v.city}, Romania` : ''
        }
        city={v.city}
        position={v.lat !== null && v.lng !== null ? { lat: v.lat, lng: v.lng } : null}
        onMove={p => setV(prev => ({ ...prev, lat: p?.lat ?? null, lng: p?.lng ?? null }))}
      />

      {error && <Alert>{error}</Alert>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push('/onboarding/step/1')}
          className="h-12 rounded-md border border-neutral-200 px-5 font-semibold text-neutral-900 hover:bg-neutral-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={busy}
          className="h-12 flex-1 rounded-md bg-primary-600 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Next: contact & hours'}
        </button>
      </div>
    </form>
  )
}

type LatLng = { lat: number; lng: number }

function AddressMap(props: {
  address: string
  city: string
  position: LatLng | null
  onMove: (p: LatLng | null) => void
}) {
  const key = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) {
    return (
      <p className="rounded-md bg-neutral-100 p-3 text-sm text-neutral-700">
        The map isn&rsquo;t available here, so we&rsquo;ll place your venue from the address.
      </p>
    )
  }
  return <PinMap apiKey={key} {...props} />
}

function PinMap({
  apiKey,
  address,
  city,
  position,
  onMove,
}: {
  apiKey: string
  address: string
  city: string
  position: LatLng | null
  onMove: (p: LatLng | null) => void
}) {
  // The same loader options as the Discover map, so the script loads once.
  const { isLoaded, loadError } = useJsApiLoader({ id: 'google-maps', googleMapsApiKey: apiKey })
  const [state, setState] = useState<'idle' | 'locating' | 'found' | 'failed'>(
    position ? 'found' : 'idle'
  )
  const [lastLooked, setLastLooked] = useState('')

  // Look the address up 800 ms after it stops changing.
  useEffect(() => {
    if (!isLoaded || !address || address === lastLooked) return
    const timer = setTimeout(() => {
      setLastLooked(address)
      setState('locating')
      new google.maps.Geocoder()
        .geocode({ address, region: 'ro' })
        .then(({ results }) => {
          const loc = results[0]?.geometry.location
          if (!loc) throw new Error('none')
          onMove({ lat: loc.lat(), lng: loc.lng() })
          setState('found')
        })
        .catch(() => setState('failed'))
    }, 800)
    return () => clearTimeout(timer)
  }, [isLoaded, address, lastLooked, onMove])

  const centre = useMemo<LatLng>(() => {
    if (position) return position
    const c = CITIES.find(x => x.name === city)
    return c ? { lat: c.lat, lng: c.lng } : { lat: 45.9432, lng: 24.9668 } // Romania
  }, [position, city])

  if (loadError) {
    return (
      <p className="rounded-md bg-neutral-100 p-3 text-sm text-neutral-700">
        The map couldn&rsquo;t load, so we&rsquo;ll place your venue from the address.
      </p>
    )
  }
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm text-neutral-700" aria-live="polite">
        {state === 'locating' && (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Locating address…
          </>
        )}
        {state === 'found' && 'Drag the pin if it isn’t exactly on your venue.'}
        {state === 'failed' && 'Could not locate the address. Drag the pin to your venue.'}
        {state === 'idle' && 'Enter the address to place it on the map.'}
      </p>
      {isLoaded ? (
        <GoogleMap
          mapContainerClassName="h-[300px] w-full rounded-md"
          center={centre}
          zoom={position ? 16 : city ? 12 : 6}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
          onClick={e => {
            // Where the pin is missing (lookup failed), a click places it.
            if (!position && e.latLng) onMove({ lat: e.latLng.lat(), lng: e.latLng.lng() })
          }}
        >
          {(position || state === 'failed') && (
            <MarkerF
              position={position ?? centre}
              draggable
              title="Your venue"
              onDragEnd={e => e.latLng && onMove({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
            />
          )}
        </GoogleMap>
      ) : (
        <div className="h-[300px] w-full animate-pulse rounded-md bg-neutral-100" />
      )}
    </div>
  )
}
