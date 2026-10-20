import React from 'react'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { EmptyState } from './EmptyState'
import { colors } from '../../theme/tokens'
import { useT } from '../../i18n'

/** Network or server failure in place of a list. E03-05. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useT()
  return (
    <EmptyState
      illustration={<Icon name="wifi-off" size={64} color={colors.neutral[300]} />}
      title={t('discover.loadPitchesFailed')}
      description={t('discover.checkConnection')}
      ctaLabel={t('discover.retry')}
      ctaVariant="primary"
      onCta={onRetry}
    />
  )
}
