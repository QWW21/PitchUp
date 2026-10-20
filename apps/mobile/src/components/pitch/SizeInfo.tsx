import React from 'react'
import { Alert, Pressable } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { colors } from '../../theme/tokens'
import { useT } from '../../i18n'

/**
 * An (i) beside a pitch size. A phone has no hover, so a tap shows the
 * explanation the web shows as a tooltip: the size is the owner's
 * recommendation, not a limit.
 */
export function SizeInfo() {
  const t = useT()
  return (
    <Pressable
      onPress={() => Alert.alert(t('discover.pitch.sizeTitle'), t('size.info'))}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('discover.pitch.aboutSizes')}
    >
      <Icon name="information-outline" size={16} color={colors.neutral[500]} />
    </Pressable>
  )
}
