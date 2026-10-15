import React, { useRef } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { AUTH } from '@pitchup/shared'
import { colors, radius, spacing } from '../../theme/tokens'

interface OtpInputProps {
  value: string
  onChange: (v: string) => void
  error?: boolean
}

/**
 * Six individual digit boxes backed by a single hidden TextInput.
 *
 * The hidden input captures keyboard events; the boxes render the digits
 * visually. This avoids fragile multi-ref focus dancing while preserving
 * a clean UI.
 */
export function OtpInput({ value, onChange, error = false }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null)
  const digits = value.padEnd(AUTH.OTP_LENGTH, ' ').split('')

  return (
    <View style={styles.wrapper}>
      {/* Hidden full-width input captures all keystrokes */}
      <TextInput
        ref={inputRef}
        accessibilityLabel="Verification code"
        value={value}
        onChangeText={t => onChange(t.replace(/\D/g, '').slice(0, AUTH.OTP_LENGTH))}
        keyboardType="number-pad"
        maxLength={AUTH.OTP_LENGTH}
        style={styles.hidden}
        autoFocus
        caretHidden
      />

      {/* Visual digit boxes */}
      {digits.map((d, i) => (
        <View
          key={i}
          style={[styles.box, value.length === i && styles.boxActive, error && styles.boxError]}
        >
          {/* Cursor line when this box is focused */}
          {d.trim() === '' && value.length === i && <View style={styles.cursor} />}
          {d.trim() !== '' && (
            <TextInput value={d} editable={false} style={styles.digit} pointerEvents="none" />
          )}
        </View>
      ))}
    </View>
  )
}

const BOX = 48

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  hidden: {
    position: 'absolute',
    width: '100%',
    height: BOX,
    opacity: 0,
  },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.primary[600] },
  boxError: { borderColor: colors.error[500] },
  digit: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.neutral[900],
    textAlign: 'center',
    padding: 0,
  },
  cursor: {
    width: 2,
    height: 24,
    backgroundColor: colors.primary[600],
  },
})
