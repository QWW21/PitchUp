import React from 'react'
import { Alert, Pressable } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { SIZE_INFO } from '@pitchup/shared'
import { colors } from '../../theme/tokens'

/**
 * An (i) beside a pitch size. A phone has no hover, so a tap shows the
 * explanation the web shows as a tooltip: the size is the owner's
 * recommendation, not a limit.
 */
export function SizeInfo() {
  return (
    <Pressable
      onPress={() => Alert.alert('Pitch size', SIZE_INFO)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="About pitch sizes"
    >
      <Icon name="information-outline" size={16} color={colors.neutral[500]} />
    </Pressable>
  )
}
