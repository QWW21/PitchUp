/**
 * Delete account — E08-06. What deleting does, the password, an optional
 * reason, then "Are you absolutely sure?". On success the app signs out and
 * shows the sign-in screens, with no way back.
 */
import React, { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppStackParamList } from '../../../App'
import { profileApi } from '../../lib/profileApi'
import { ApiError } from '../../lib/apiClient'
import { useAuthStore } from '../../stores/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { colors, spacing } from '../../theme/tokens'
import { useT } from '../../i18n'

type Props = NativeStackScreenProps<AppStackParamList, 'DeleteAccount'>

export function DeleteAccountScreen({ navigation }: Props) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const logout = useAuthStore(s => s.logout)
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [passwordError, setPasswordError] = useState<string | undefined>()

  const remove = useMutation({
    mutationFn: () => profileApi.deleteAccount({ password, reason }),
    onSuccess: async () => {
      // Signing out swaps in the sign-in screens: nothing to go back to.
      await logout()
      queryClient.clear()
    },
    onError: e => {
      if (
        e instanceof ApiError &&
        (e.details as { reason?: string } | undefined)?.reason === 'WRONG_PASSWORD'
      ) {
        setPasswordError(e.message)
      }
    },
  })

  const press = () => {
    if (!password) {
      setPasswordError(t('profile.deleteAccount.enterPassword'))
      return
    }
    setPasswordError(undefined)
    Alert.alert(t('profile.deleteAccount.sureTitle'), t('profile.deleteAccount.sureBody'), [
      { text: t('profile.cancel'), style: 'cancel' },
      { text: t('profile.delete'), style: 'destructive', onPress: () => remove.mutate() },
    ])
  }

  const otherError =
    remove.isError && !passwordError
      ? remove.error instanceof ApiError
        ? remove.error.message
        : t('profile.deleteAccount.failed')
      : null

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
          {t('profile.deleteAccount.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>{t('profile.deleteAccount.warning')}</Text>
          {([0, 1, 2, 3] as const).map(i => (
            <Text key={i} style={styles.bullet}>
              • {t(`profile.deleteAccount.points.${i}`)}
            </Text>
          ))}
        </View>
        <Input
          label={t('profile.deleteAccount.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          {...(passwordError ? { error: passwordError } : {})}
        />
        <View style={styles.gap}>
          <Text style={styles.label}>{t('profile.deleteAccount.why')}</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            maxLength={300}
            multiline
            style={styles.reason}
            accessibilityLabel={t('profile.deleteAccount.why')}
          />
        </View>
        {otherError ? <Text style={styles.error}>{otherError}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          onPress={press}
          disabled={remove.isPending}
          style={[styles.destructive, remove.isPending && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.deleteAccount.submit')}
        >
          <Text style={styles.destructiveText}>
            {remove.isPending
              ? t('profile.deleteAccount.deleting')
              : t('profile.deleteAccount.submit')}
          </Text>
        </Pressable>
        <Button
          label={t('profile.deleteAccount.never')}
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
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
  warning: {
    backgroundColor: colors.error[50],
    borderLeftWidth: 3,
    borderLeftColor: colors.error[500],
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    padding: 12,
    gap: 4,
  },
  warningTitle: { fontSize: 15, fontWeight: '600', color: colors.neutral[900] },
  bullet: { fontSize: 14, color: colors.neutral[900] },
  gap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[700] },
  reason: {
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.neutral[900],
    textAlignVertical: 'top',
  },
  error: { fontSize: 13, color: colors.error[600] },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  destructive: {
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.error[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  destructiveText: { fontSize: 16, fontWeight: '600', color: colors.neutral[0] },
})
