import React from 'react'
import { View } from 'react-native'
import { SkeletonBox } from '../common/SkeletonBox'
import { cardStyles as styles } from './CompanyCard'

/** Same footprint as CompanyCard, so nothing jumps when data arrives. E03-05. */
export function CompanyCardSkeleton() {
  return (
    <View
      style={[styles.row, styles.card]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SkeletonBox width={56} height={56} radius={8} />
      <View style={[styles.body, { gap: 8, paddingTop: 2 }]}>
        <SkeletonBox width="60%" height={16} />
        <SkeletonBox width="80%" height={12} />
        <SkeletonBox width="50%" height={12} />
        <SkeletonBox width="40%" height={12} />
      </View>
    </View>
  )
}
