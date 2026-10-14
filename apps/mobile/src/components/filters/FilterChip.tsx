import React from 'react'
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { colors } from '../../theme/tokens'

export interface ChipColors {
  background: string
  text: string
}

interface FilterChipProps {
  label: string
  selected: boolean
  onPress: () => void
  icon?: string
  /** Overrides the selected look, e.g. per surface type. UIUX_SPEC §2.7. */
  selectedColors?: ChipColors
  /** 28px for plain chips, 36px for icon chips in the amenity grid. */
  height?: number
  style?: StyleProp<ViewStyle>
}

/** Multi-select chip. Also used for the Discover sort row. E03-06. */
export function FilterChip({
  label,
  selected,
  onPress,
  icon,
  selectedColors,
  height = 28,
  style,
}: FilterChipProps) {
  const textColor = selected ? (selectedColors?.text ?? colors.primary[700]) : colors.neutral[700]
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8 }}
      style={[
        styles.chip,
        { height },
        selected
          ? [styles.selected, selectedColors && { backgroundColor: selectedColors.background }]
          : styles.unselected,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={textColor} /> : null}
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9999,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  unselected: { backgroundColor: colors.neutral[100], borderColor: colors.neutral[100] },
  selected: { backgroundColor: colors.primary[100], borderColor: colors.primary[600] },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
})
