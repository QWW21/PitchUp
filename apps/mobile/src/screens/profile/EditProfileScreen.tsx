/**
 * Edit profile — E08-06. Name, phone and city, checked with the same schema
 * as the API; Save stays disabled until something changed. Email is shown
 * but cannot be changed.
 *
 * Deviations, agreed with the owner (no new native modules):
 * - the photo is shown but changed on the website: picking one needs
 *   react-native-image-picker;
 * - the city is a list on this screen rather than the Discover city sheet,
 *   which is tied to Discover's own city.
 */
import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CITY_NAMES, UpdateProfileSchema, type Profile } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { profileApi } from '../../lib/profileApi'
import { ApiError } from '../../lib/apiClient'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ErrorState } from '../../components/common/ErrorState'
import { colors, spacing } from '../../theme/tokens'
import { PROFILE_KEY, ProfileAvatar, useProfile } from './ProfileScreen'
import { useT } from '../../i18n'

type Props = NativeStackScreenProps<AppStackParamList, 'EditProfile'>
type Field = 'name' | 'phone' | 'city'

export function EditProfileScreen({ navigation }: Props) {
  const profile = useProfile()
  if (profile.isError) return <ErrorState onRetry={() => profile.refetch()} />
  if (!profile.data) return null
  return (
    <Form
      profile={profile.data}
      onDone={() => navigation.goBack()}
      onBack={() => navigation.goBack()}
    />
  )
}

function Form({
  profile,
  onDone,
  onBack,
}: {
  profile: Profile
  onDone: () => void
  onBack: () => void
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone)
  const [city, setCity] = useState(profile.city ?? '')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})

  const changes = {
    ...(name.trim() !== profile.name ? { name } : {}),
    ...(phone.trim() !== profile.phone ? { phone: phone.trim() } : {}),
    ...(city && city !== profile.city ? { city } : {}),
  }
  const changed = Object.keys(changes).length > 0

  const save = useMutation({
    mutationFn: (body: Parameters<typeof profileApi.update>[0]) => profileApi.update(body),
    onSuccess: data => {
      queryClient.setQueryData(PROFILE_KEY, data)
      onDone()
    },
  })

  const submit = () => {
    const parsed = UpdateProfileSchema.safeParse(changes)
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field | undefined
        if (key && !next[key]) next[key] = t.text(issue.message)
      }
      setErrors(next)
      return
    }
    setErrors({})
    save.mutate(parsed.data)
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('profile.back')}
        >
          <Icon name="chevron-left" size={26} color={colors.neutral[900]} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('profile.edit.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.center}>
          <ProfileAvatar profile={profile} />
          <Text style={styles.muted}>{t('profile.edit.photoOnWeb')}</Text>
        </View>
        <Input
          label={t('profile.edit.fullName')}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          {...(errors.name ? { error: errors.name } : {})}
        />
        <View style={styles.gap}>
          <Input
            label={t('profile.edit.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            {...(errors.phone ? { error: errors.phone } : {})}
          />
          {changes.phone ? <Text style={styles.muted}>{t('profile.edit.reverify')}</Text> : null}
        </View>
        <View style={styles.gap}>
          <Text style={styles.label}>{t('profile.edit.email')}</Text>
          <Text style={styles.value}>{profile.email}</Text>
          <Text style={styles.muted}>{t('profile.edit.emailFixed')}</Text>
        </View>
        <View style={styles.gap}>
          <Text style={styles.label}>{t('profile.edit.city')}</Text>
          <View
            style={styles.cities}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('profile.edit.city')}
          >
            {CITY_NAMES.map(c => (
              <Pressable
                key={c}
                onPress={() => setCity(c)}
                style={[styles.city, city === c && styles.cityOn]}
                accessibilityRole="radio"
                accessibilityState={{ checked: city === c }}
              >
                <Text style={[styles.cityText, city === c && styles.cityTextOn]}>{c}</Text>
              </Pressable>
            ))}
          </View>
          {errors.city ? <Text style={styles.error}>{errors.city}</Text> : null}
        </View>
        {save.isError ? (
          <Text style={styles.error}>
            {save.error instanceof ApiError ? save.error.message : t('profile.edit.failed')}
          </Text>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={t('profile.edit.save')}
          onPress={submit}
          disabled={!changed}
          loading={save.isPending}
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
  center: { alignItems: 'center', gap: 8 },
  gap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[700] },
  value: { fontSize: 15, color: colors.neutral[900] },
  muted: { fontSize: 13, color: colors.neutral[400] },
  error: { fontSize: 13, color: colors.error[600] },
  cities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  city: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cityOn: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  cityText: { fontSize: 14, color: colors.neutral[700] },
  cityTextOn: { color: colors.neutral[0], fontWeight: '600' },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
})
