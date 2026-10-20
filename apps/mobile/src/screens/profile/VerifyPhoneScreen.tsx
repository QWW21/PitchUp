/**
 * Verify phone number — #163. Opened from Profile while the number is not
 * verified. The code is texted only when the person asks for it, then typed
 * in here; success goes back to Profile, which refetches.
 */
import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useQueryClient } from '@tanstack/react-query'
import type { AppStackParamList } from '../../../App'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ApiError } from '../../lib/apiClient'
import { profileApi } from '../../lib/profileApi'
import { colors, spacing } from '../../theme/tokens'
import { PROFILE_KEY } from './ProfileScreen'
import { useT } from '../../i18n'

type Props = NativeStackScreenProps<AppStackParamList, 'VerifyPhone'>

export function VerifyPhoneScreen({ navigation, route }: Props) {
  const t = useT()
  const { phone } = route.params
  const queryClient = useQueryClient()
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const message = (e: unknown) =>
    e instanceof ApiError ? e.message : t('profile.phone.connection')

  async function sendCode() {
    setError('')
    setBusy(true)
    try {
      await profileApi.sendPhoneCode()
      setSent(true)
      setCode('')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CONFLICT') {
        await queryClient.invalidateQueries({ queryKey: PROFILE_KEY })
        navigation.goBack()
        return
      }
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    if (code.length !== 6) {
      setError(t('profile.phone.enterCode'))
      return
    }
    setError('')
    setBusy(true)
    try {
      await profileApi.verifyPhone(code)
      await queryClient.invalidateQueries({ queryKey: PROFILE_KEY })
      navigation.goBack()
    } catch (e) {
      setError(message(e))
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('profile.back')}
        >
          <Icon name="chevron-left" size={26} color={colors.neutral[900]} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('profile.phone.title')}
        </Text>
      </View>
      <View style={styles.body}>
        {!sent ? (
          <>
            <Text style={styles.text}>{t('profile.phone.willText', { phone })}</Text>
            <Button label={t('profile.phone.textMe')} onPress={sendCode} loading={busy} />
          </>
        ) : (
          <>
            <Text style={styles.text}>We texted a code to {phone}.</Text>
            <Input
              label={t('profile.phone.code')}
              value={code}
              onChangeText={text => setCode(text.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              returnKeyType="done"
              onSubmitEditing={verify}
            />
            <Button label={t('profile.phone.verify')} onPress={verify} loading={busy} />
            <Button
              label={t('profile.phone.sendNew')}
              variant="ghost"
              onPress={sendCode}
              disabled={busy}
            />
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  header: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: spacing.xs },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  body: { padding: spacing.md, gap: spacing.md },
  text: { fontSize: 15, color: colors.neutral[700], lineHeight: 22 },
  error: { fontSize: 14, color: colors.error[600] },
})
