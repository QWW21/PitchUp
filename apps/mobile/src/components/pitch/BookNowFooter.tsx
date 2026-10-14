import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../theme/tokens'

export const FOOTER_HEIGHT = 72

export type BookBlock = null | 'unavailable' | 'restricted'

interface BookNowFooterProps {
  priceFrom: number
  block: BookBlock
  onBook: () => void
}

const LABELS: Record<Exclude<BookBlock, null>, string> = {
  unavailable: 'Not available',
  restricted: 'Account restricted',
}

/**
 * Price and Book Now, fixed above the safe area. UIUX_SPEC §6.2, E04-06.
 * The app's screens are all behind sign-in, so the ticket's "Sign in to book"
 * state cannot occur here; it exists on the web, where browsing is public.
 */
export function BookNowFooter({ priceFrom, block, onBook }: BookNowFooterProps) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
      <Text style={styles.from}>
        from <Text style={styles.price}>{priceFrom} RON</Text>/h
      </Text>
      <Pressable
        onPress={onBook}
        disabled={!!block}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!block }}
        style={({ pressed }) => [
          styles.button,
          block ? styles.disabled : pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.label, block && styles.labelDisabled]}>
          {block ? LABELS[block] : 'Book Now'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  from: { fontSize: 14, color: colors.neutral[500] },
  price: { fontSize: 20, fontWeight: '700', color: colors.neutral[900], fontFamily: 'monospace' },
  button: {
    width: 140,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent[500],
  },
  pressed: { backgroundColor: colors.accent[600] },
  disabled: { backgroundColor: colors.neutral[200] },
  label: { fontSize: 16, fontWeight: '600', color: colors.neutral[0] },
  labelDisabled: { color: colors.neutral[500] },
})
