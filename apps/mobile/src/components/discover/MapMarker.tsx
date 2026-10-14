import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, shadows } from '../../theme/tokens'

/**
 * Price pill drawn inside a map Marker. UIUX_SPEC §5.2, E03-07.
 *
 * Static rather than spring-animated: markers render with
 * tracksViewChanges={false}, so Android snapshots the view once and would
 * never show the animation. The selected state is a re-mount (keyed by
 * selection) at 1.1× instead.
 */
export function MapMarker({ priceFrom, isSelected }: { priceFrom: number; isSelected: boolean }) {
  return (
    // Padding gives the shadow room inside the snapshot bounds.
    <View style={styles.wrap}>
      <View style={[styles.pill, isSelected && styles.selected]}>
        <Text style={[styles.text, isSelected && styles.selectedText]}>from {priceFrom} RON</Text>
      </View>
    </View>
  )
}

/** Grey count bubble for a group of nearby companies. */
export function ClusterMarker({ count }: { count: number }) {
  const size = count > 20 ? 48 : count > 5 ? 40 : 32
  return (
    <View style={styles.wrap}>
      <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.clusterText}>{count}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { padding: 6 },
  pill: {
    backgroundColor: colors.neutral[0],
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    ...shadows.md,
  },
  selected: { backgroundColor: colors.primary[600], transform: [{ scale: 1.1 }] },
  text: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.neutral[900] },
  selectedText: { color: colors.neutral[0] },
  cluster: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[500],
    ...shadows.sm,
  },
  clusterText: { fontSize: 13, fontWeight: '600', color: colors.neutral[0] },
})
