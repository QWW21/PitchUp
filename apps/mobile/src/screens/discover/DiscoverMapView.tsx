/**
 * Discover map — E03-07, UIUX_SPEC §5.2.
 *
 * Clustering uses supercluster directly instead of react-native-map-clustering,
 * which wraps MapView and lags behind react-native-maps releases; the pinned
 * maps version already needs patches to build on RN 0.76.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Region } from 'react-native-maps'
import Supercluster from 'supercluster'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { mapCenter, type CompanyListItem } from '@pitchup/shared'
import { ClusterMarker, MapMarker } from '../../components/discover/MapMarker'
import { MAP_SHEET_HEIGHT, MapCompanySheet } from '../../components/discover/MapCompanySheet'
import { useDiscoverStore } from '../../stores/discoverStore'
import { useLocation } from '../../hooks/useLocation'
import { colors, shadows } from '../../theme/tokens'

/** Roughly a 12 km radius around the centre. */
const SPAN = 0.22

type PointProps = { companyId: string }

interface DiscoverMapViewProps {
  companies: CompanyListItem[]
  onOpenCompany: (company: CompanyListItem) => void
}

function regionAround(lat: number, lng: number, span = SPAN): Region {
  return { latitude: lat, longitude: lng, latitudeDelta: span, longitudeDelta: span }
}

export function DiscoverMapView({ companies, onOpenCompany }: DiscoverMapViewProps) {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)
  const coords = useDiscoverStore(s => s.userCoords)
  const city = useDiscoverStore(s => s.selectedCity)
  const { requestAndDetect } = useLocation()

  // On the player when they are in the selected city, otherwise on that
  // city: a player browsing another city wants to see its venues.
  const initialRegion = useMemo(() => {
    const c = mapCenter(city, coords)
    return city || coords ? regionAround(c.lat, c.lng) : regionAround(c.lat, c.lng, 6)
    // The map owns its region after mount; see the effect below for a new city.
  }, [])
  const [region, setRegion] = useState<Region>(initialRegion)

  // A different city chosen while the map is open moves the map there.
  const shownCity = useRef(city)
  useEffect(() => {
    if (city === shownCity.current) return
    shownCity.current = city
    const c = mapCenter(city, coords)
    mapRef.current?.animateToRegion(regionAround(c.lat, c.lng), 400)
  }, [city, coords])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const lastTap = useRef(0)

  // A company without coordinates is a data error; leave it off the map.
  const placed = useMemo(() => companies.filter(c => c.lat !== null && c.lng !== null), [companies])
  const byId = useMemo(() => new Map(placed.map(c => [c.id, c])), [placed])

  const index = useMemo(() => {
    const sc = new Supercluster<PointProps>({ radius: 60, maxZoom: 16 })
    sc.load(
      placed.map(c => ({
        type: 'Feature' as const,
        properties: { companyId: c.id },
        geometry: { type: 'Point' as const, coordinates: [c.lng!, c.lat!] },
      }))
    )
    return sc
  }, [placed])

  const zoom = Math.max(0, Math.min(20, Math.round(Math.log2(360 / region.longitudeDelta))))
  const clusters = useMemo(() => {
    const west = region.longitude - region.longitudeDelta / 2
    const east = region.longitude + region.longitudeDelta / 2
    const south = region.latitude - region.latitudeDelta / 2
    const north = region.latitude + region.latitudeDelta / 2
    return index.getClusters([west, south, east, north], zoom)
  }, [index, region, zoom])

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null

  function selectCompany(id: string) {
    // Rapid taps on neighbouring pins would restart the sheet animation each time.
    const now = Date.now()
    if (now - lastTap.current < 100) return
    lastTap.current = now
    setSelectedId(id)
  }

  function zoomIntoCluster(clusterId: number, lat: number, lng: number) {
    const target = Math.min(index.getClusterExpansionZoom(clusterId), 18)
    const delta = 360 / 2 ** target
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta },
      300
    )
  }

  async function goToMyLocation() {
    if (coords) {
      mapRef.current?.animateToRegion(regionAround(coords.lat, coords.lng, 0.05), 400)
      return
    }
    // The fresh fix lands in the store; follow it on the next tap.
    await requestAndDetect()
  }

  const locateBottom = insets.bottom + 56 + (selected ? MAP_SHEET_HEIGHT : 0)

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        // Google tiles on Android; Apple Maps on iOS, where the Google SDK is not installed.
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        mapType="standard"
        initialRegion={initialRegion}
        showsUserLocation={!!coords}
        showsMyLocationButton={false}
        onRegionChangeComplete={setRegion}
        onPress={e => {
          // Android reports marker taps to the map as well.
          if ((e.nativeEvent as { action?: string }).action === 'marker-press') return
          setSelectedId(null)
        }}
      >
        {clusters.map(feature => {
          const [lng, lat] = feature.geometry.coordinates as [number, number]
          const props = feature.properties as PointProps & {
            cluster?: boolean
            cluster_id?: number
            point_count?: number
          }

          if (props.cluster && props.cluster_id !== undefined) {
            return (
              <Marker
                key={`cluster-${props.cluster_id}`}
                coordinate={{ latitude: lat, longitude: lng }}
                tracksViewChanges={false}
                onPress={() => zoomIntoCluster(props.cluster_id!, lat, lng)}
              >
                <ClusterMarker count={props.point_count ?? 0} />
              </Marker>
            )
          }

          const company = byId.get(props.companyId)
          if (!company) return null
          const isSelected = company.id === selectedId
          return (
            <Marker
              // Keyed by selection so the snapshot is retaken when it changes.
              key={`${company.id}-${isSelected ? 'on' : 'off'}`}
              coordinate={{ latitude: lat, longitude: lng }}
              tracksViewChanges={false}
              zIndex={isSelected ? 2 : 1}
              onPress={() => selectCompany(company.id)}
            >
              <MapMarker priceFrom={company.priceFrom} isSelected={isSelected} />
            </Marker>
          )
        })}
      </MapView>

      <Pressable
        onPress={goToMyLocation}
        style={[styles.locate, { bottom: locateBottom }]}
        accessibilityRole="button"
        accessibilityLabel="Show my location"
      >
        <Icon name="crosshairs-gps" size={20} color={colors.primary[600]} />
      </Pressable>

      <MapCompanySheet
        company={selected}
        bottomInset={insets.bottom}
        onView={onOpenCompany}
        onDismiss={() => setSelectedId(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  locate: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    ...shadows.md,
  },
})
