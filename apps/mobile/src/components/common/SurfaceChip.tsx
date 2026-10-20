import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SURFACE_COLORS, type SurfaceType } from '@pitchup/shared'
import { useT } from '../../i18n'

/** Surface type in its UIUX_SPEC §2.7 colours. */
export function SurfaceChip({ surface }: { surface: SurfaceType }) {
  const t = useT()
  const c = SURFACE_COLORS[surface]
  return (
    <View style={[styles.chip, { backgroundColor: c.background }]}>
      <Text style={[styles.text, { color: c.text }]}>{t(`surface.${surface}`)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { borderRadius: 9999, paddingVertical: 4, paddingHorizontal: 8 },
  text: { fontSize: 11, fontWeight: '500' },
})
