/**
 * Română / English. The choice is kept on the phone and, when signed in, on
 * the account (emails and pushes follow it). Every API call sends it too.
 */
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LOCALES, LOCALE_NAMES, type Locale } from '@pitchup/shared'
import { profileApi } from '../../lib/profileApi'
import { useAuthStore } from '../../stores/authStore'
import { useLocaleStore } from '../../stores/localeStore'
import { useT } from '../../i18n'
import { colors } from '../../theme/tokens'

export function LanguageToggle() {
  const t = useT()
  const locale = useLocaleStore(s => s.locale)
  const setLocale = useLocaleStore(s => s.setLocale)
  const signedIn = useAuthStore(s => s.status === 'authenticated')

  const choose = (next: Locale) => {
    if (next === locale) return
    setLocale(next)
    if (signedIn) void profileApi.update({ locale: next }).catch(() => undefined)
  }

  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('language.label')}
    >
      {LOCALES.map(l => (
        <Pressable
          key={l}
          onPress={() => choose(l)}
          accessibilityRole="radio"
          accessibilityState={{ checked: l === locale }}
          accessibilityLabel={LOCALE_NAMES[l]}
          style={[styles.pill, l === locale && styles.pillOn]}
        >
          <Text style={[styles.text, l === locale && styles.textOn]}>{l.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  pill: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillOn: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  text: { fontSize: 13, fontWeight: '600', color: colors.neutral[700] },
  textOn: { color: colors.neutral[0] },
})
