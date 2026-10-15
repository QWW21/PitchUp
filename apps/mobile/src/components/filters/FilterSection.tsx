import React, { type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../../theme/tokens'

interface FilterSectionProps {
  title: string
  /** Shown right-aligned beside the title, e.g. the current price range. */
  aside?: string
  /** Shown right after the title, e.g. an info button. */
  titleAccessory?: ReactNode
  children: ReactNode
  /** The first section has no divider above it. */
  first?: boolean
}

/** Label + content block in the Filters sheet. UIUX_SPEC §5.4, E03-06. */
export function FilterSection({
  title,
  aside,
  titleAccessory,
  children,
  first = false,
}: FilterSectionProps) {
  return (
    <View style={[styles.root, !first && styles.divider]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {titleAccessory}
        </View>
        {aside ? <Text style={styles.aside}>{aside}</Text> : null}
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 8 },
  divider: { borderTopWidth: 1, borderTopColor: colors.neutral[100] },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.neutral[900] },
  aside: { fontSize: 13, fontWeight: '500', color: colors.neutral[900] },
})
