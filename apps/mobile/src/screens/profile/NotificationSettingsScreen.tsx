/**
 * Notification settings — E13-09. Channel switches (push, email) and a
 * switch per kind of notification; each saves at once and goes back if the
 * save fails.
 */
import React from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  preferenceGroupsFor,
  type NotificationPreferences,
  type NotificationPreferencesInput,
  type NotificationType,
} from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { profileApi } from '../../lib/profileApi'
import { useAuthStore } from '../../stores/authStore'
import { ApiError } from '../../lib/apiClient'
import { ErrorState } from '../../components/common/ErrorState'
import { colors, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AppStackParamList, 'NotificationSettings'>
const KEY = ['notification-preferences'] as const

const CHANNELS: {
  key: 'pushEnabled' | 'emailEnabled'
  label: string
  hint: string
}[] = [
  { key: 'pushEnabled', label: 'Push notifications', hint: 'On this phone' },
  { key: 'emailEnabled', label: 'Email', hint: 'To the address on your account' },
]

export function NotificationSettingsScreen({ navigation }: Props) {
  const role = useAuthStore(s => s.user?.role ?? 'PLAYER')
  const queryClient = useQueryClient()
  const prefs = useQuery({ queryKey: KEY, queryFn: () => profileApi.notificationPreferences() })
  const save = useMutation({
    mutationFn: (patch: NotificationPreferencesInput) =>
      profileApi.updateNotificationPreferences(patch),
    onMutate: async patch => {
      await queryClient.cancelQueries({ queryKey: KEY })
      const previous = queryClient.getQueryData<NotificationPreferences>(KEY)
      if (previous) queryClient.setQueryData(KEY, { ...previous, ...patch })
      return { previous }
    },
    onError: (e, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(KEY, context.previous)
      Alert.alert('Not saved', e instanceof ApiError ? e.message : 'Try again.')
    },
    onSuccess: data => queryClient.setQueryData(KEY, data),
  })

  if (prefs.isError) return <ErrorState onRetry={() => prefs.refetch()} />
  if (!prefs.data) return <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
  const p = prefs.data

  const toggleChannel = (key: (typeof CHANNELS)[number]['key']) => save.mutate({ [key]: !p[key] })
  const muted = (types: readonly NotificationType[]) =>
    types.every(t => p.disabledTypes.includes(t))
  const toggleGroup = (types: readonly NotificationType[]) =>
    save.mutate({
      disabledTypes: muted(types)
        ? p.disabledTypes.filter(t => !types.includes(t))
        : [...new Set([...p.disabledTypes, ...types])],
    })

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="chevron-left" size={26} color={colors.neutral[900]} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Notification settings
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.section}>CHANNELS</Text>
        <View style={styles.card}>
          {CHANNELS.map(c => (
            <Row
              key={c.key}
              label={c.label}
              hint={c.hint}
              value={p[c.key]}
              onChange={() => toggleChannel(c.key)}
            />
          ))}
        </View>
        <Text style={styles.section}>WHAT WE TELL YOU ABOUT</Text>
        <View style={styles.card}>
          {preferenceGroupsFor(role).map(g => (
            <Row
              key={g.key}
              label={g.label}
              hint={g.description}
              value={!muted(g.types)}
              onChange={() => toggleGroup(g.types)}
            />
          ))}
        </View>
        <Text style={styles.note}>Venue approval and security messages are always sent.</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: boolean
  onChange: () => void
}) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary[600], false: colors.neutral[300] }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[50] },
  loading: { marginTop: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, height: 52 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  body: { padding: spacing.md, gap: spacing.sm },
  section: { fontSize: 12, fontWeight: '600', color: colors.neutral[500], marginTop: spacing.sm },
  card: { backgroundColor: colors.neutral[0], borderRadius: 8, paddingHorizontal: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  flex: { flex: 1 },
  label: { fontSize: 15, color: colors.neutral[900] },
  hint: { fontSize: 12, color: colors.neutral[500] },
  note: { fontSize: 12, color: colors.neutral[500], marginTop: spacing.sm },
})
