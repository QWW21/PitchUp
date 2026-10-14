import React from 'react'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { EmptyState } from './EmptyState'
import { colors } from '../../theme/tokens'

/** Network or server failure in place of a list. E03-05. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      illustration={<Icon name="wifi-off" size={64} color={colors.neutral[300]} />}
      title="Couldn't load pitches"
      description="Check your connection and try again"
      ctaLabel="Retry"
      ctaVariant="primary"
      onCta={onRetry}
    />
  )
}
