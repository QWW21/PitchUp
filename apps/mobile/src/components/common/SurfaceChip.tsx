import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SURFACE_COLORS, SURFACE_LABELS, type SurfaceType } from '@pitchup/shared'

/** Surface type in its UIUX_SPEC §2.7 colours. */
export function SurfaceChip({ surface }: { surface: SurfaceType }) {
  const c = SURFACE_COLORS[surface]
  return (
    <View style={[styles.chip, { backgroundColor: c.background }]}>
      <Text style={[styles.text, { color: c.text }]}>{SURFACE_LABELS[surface]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { borderRadius: 9999, paddingVertical: 4, paddingHorizontal: 8 },
  text: { fontSize: 11, fontWeight: '500' },
})
