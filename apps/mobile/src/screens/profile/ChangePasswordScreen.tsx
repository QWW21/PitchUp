/**
 * Change password — E08-06. Current password (wrong → shown under it), a
 * new one with a four-step strength bar, and its confirmation. On success
 * every session ends, so the app says so and signs out.
 */
import React, { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { passwordSchema, scorePassword } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { profileApi } from '../../lib/profileApi'
import { ApiError } from '../../lib/apiClient'
import { useAuthStore } from '../../stores/authStore'
import { Button } from '../../components/ui/Button'
import { Input, InputIconButton } from '../../components/ui/Input'
import { colors, spacing } from '../../theme/tokens'
import { useT } from '../../i18n'

type Props = NativeStackScreenProps<AppStackParamList, 'ChangePassword'>

const LEVELS = [
  colors.neutral[200],
  colors.error[500],
  colors.warning[500],
  colors.primary[500],
  colors.primary[600],
]

export function StrengthBar({ password }: { password: string }) {
  const t = useT()
  if (!password) return null
  const score = scorePassword(password)
  return (
    <View style={styles.strength}>
      <View style={styles.segments}>
        {[1, 2, 3, 4].map(n => (
          <View
            key={n}
            style={[
              styles.segment,
              { backgroundColor: n <= score ? LEVELS[score]! : colors.neutral[200] },
            ]}
          />
        ))}
      </View>
      <Text style={styles.muted}>
        {t('profile.password.strength', {
          level: t(`profile.password.levels.${(score || 1) as 1 | 2 | 3 | 4}`),
        })}
      </Text>
    </View>
  )
}

function Secret({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string | undefined
}) {
  const [shown, setShown] = useState(false)
  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChange}
      secureTextEntry={!shown}
      autoCapitalize="none"
      {...(error ? { error } : {})}
      rightElement={
        <InputIconButton onPress={() => setShown(s => !s)}>
          <Icon
            name={shown ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.neutral[500]}
            accessibilityLabel={
              shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`
            }
          />
        </InputIconButton>
      }
    />
  )
}

export function ChangePasswordScreen({ navigation }: Props) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const logout = useAuthStore(s => s.logout)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})

  const change = useMutation({
    mutationFn: () => profileApi.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () =>
      Alert.alert(t('profile.password.updated'), t('profile.password.loggedOut'), [
        {
          text: t('profile.ok'),
          onPress: async () => {
            await logout()
            queryClient.clear()
          },
        },
      ]),
    onError: e => {
      if (
        e instanceof ApiError &&
        (e.details as { reason?: string } | undefined)?.reason === 'WRONG_PASSWORD'
      ) {
        setErrors({ current: e.message })
      }
    },
  })

  const submit = () => {
    const found: typeof errors = {}
    if (!current) found.current = t('profile.password.enterCurrent')
    const strong = passwordSchema.safeParse(next)
    if (!strong.success)
      found.next = t.text(strong.error.issues[0]?.message ?? t('profile.password.stronger'))
    else if (next === current) found.next = t('profile.password.different')
    if (confirm && confirm !== next) found.confirm = t('profile.password.mismatch')
    if (!confirm) found.confirm = t('profile.password.confirmIt')
    setErrors(found)
    if (!Object.keys(found).length) change.mutate()
  }

  const otherError =
    change.isError && !errors.current
      ? change.error instanceof ApiError
        ? change.error.message
        : t('profile.password.failed')
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
          {t('profile.password.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Secret
          label={t('profile.password.current')}
          value={current}
          onChange={setCurrent}
          error={errors.current}
        />
        <View>
          <Secret
            label={t('profile.password.new')}
            value={next}
            onChange={setNext}
            error={errors.next}
          />
          <StrengthBar password={next} />
        </View>
        <Secret
          label={t('profile.password.confirm')}
          value={confirm}
          onChange={v => {
            setConfirm(v)
            setErrors(e => ({
              ...e,
              confirm: v && v !== next ? t('profile.password.mismatch') : undefined,
            }))
          }}
          error={errors.confirm}
        />
        {otherError ? <Text style={styles.error}>{otherError}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label={t('profile.password.submit')} onPress={submit} loading={change.isPending} />
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
  strength: { marginTop: 8, gap: 4 },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  muted: { fontSize: 12, color: colors.neutral[500] },
  error: { fontSize: 13, color: colors.error[600] },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
})
