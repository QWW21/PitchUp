import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native'
import { colors, radius, spacing } from '../../theme/tokens'

interface InputProps extends TextInputProps {
  label: string
  error?: string
  rightElement?: React.ReactNode
}

export function Input({ label, error, rightElement, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, focused && styles.rowFocused, !!error && styles.rowError]}>
        <TextInput
          // The visible label is a sibling Text; this is what a screen reader announces.
          accessibilityLabel={label}
          style={styles.input}
          placeholderTextColor={colors.neutral[400]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {rightElement ? <View style={styles.right}>{rightElement}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

/** Pressable wrapper so callers can render a show/hide password toggle. */
export function InputIconButton({
  onPress,
  children,
}: {
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <Pressable onPress={onPress} style={styles.iconButton} hitSlop={8}>
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[700] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[0],
    minHeight: 52,
  },
  rowFocused: { borderColor: colors.primary[600] },
  rowError: { borderColor: colors.error[500] },
  input: { flex: 1, fontSize: 15, color: colors.neutral[900], paddingVertical: spacing.sm },
  right: { marginLeft: spacing.sm },
  error: { fontSize: 13, color: colors.error[600] },
  iconButton: { padding: 4 },
})
