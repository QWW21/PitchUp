import React, { type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Button } from '../ui/Button'
import { colors } from '../../theme/tokens'

interface EmptyStateProps {
  illustration: ReactNode
  title: string
  description: string
  ctaLabel?: string
  onCta?: () => void
  ctaVariant?: 'primary' | 'secondary'
}

/** Centred illustration, title, description and optional action. UIUX_SPEC §2.7, E03-05. */
export function EmptyState({
  illustration,
  title,
  description,
  ctaLabel,
  onCta,
  ctaVariant = 'secondary',
}: EmptyStateProps) {
  return (
    <View style={styles.root}>
      {illustration}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {ctaLabel && onCta ? (
        <View style={styles.cta}>
          <Button label={ctaLabel} onPress={onCta} variant={ctaVariant} fullWidth={false} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  title: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: colors.neutral[900],
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    maxWidth: 240,
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  cta: { marginTop: 20 },
})
