/**
 * Profile — E08-04 (UIUX_SPEC §10.1). Who you are, your trust score, and
 * the account menu: edit profile, password, cards, bookings, reviews,
 * notifications, legal, support, log out, delete account.
 *
 * Opened from the Discover header: the app has no tab bar yet. The profile
 * is refetched whenever the screen comes back into focus.
 */
import React, { useCallback } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { tierDescription, trustTier, type Profile } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { profileApi } from '../../lib/profileApi'
import { LEGAL } from '../../lib/links'
import { useAuthStore } from '../../stores/authStore'
import { ErrorState } from '../../components/common/ErrorState'
import { TrustBadge } from '../../components/profile/TrustBadge'
import { colors, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>

export const PROFILE_KEY = ['profile'] as const

export function useProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: profileApi.get })
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts.at(-1)![0] : ''}`.toUpperCase()
}

export function ProfileAvatar({ profile, size = 80 }: { profile: Profile; size?: number }) {
  const round = { width: size, height: size, borderRadius: size / 2 }
  return profile.avatarUrl ? (
    <Image source={{ uri: profile.avatarUrl }} style={round} accessibilityIgnoresInvertColors />
  ) : (
    <View style={[round, styles.initials]}>
      <Text style={[styles.initialsText, { fontSize: size * 0.32 }]}>{initials(profile.name)}</Text>
    </View>
  )
}

export function ProfileScreen({ navigation }: Props) {
  const queryClient = useQueryClient()
  const logout = useAuthStore(s => s.logout)
  const profile = useProfile()

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY })
    }, [queryClient])
  )

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You can sign in again any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout()
          // The app switches to the sign-in screens; nothing of this user stays cached.
          queryClient.clear()
        },
      },
    ])

  if (profile.isError) return <ErrorState onRetry={() => profile.refetch()} />
  if (!profile.data) {
    return <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
  }
  const p = profile.data
  const tier = trustTier(p.trustScore)

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
          Profile
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <ProfileAvatar profile={p} />
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.muted}>{p.email}</Text>
          <Text style={styles.muted}>{p.phone}</Text>
          {!p.phoneVerified ? (
            <Pressable
              onPress={() => navigation.navigate('VerifyPhone', { phone: p.phone })}
              accessibilityRole="link"
            >
              <Text style={styles.link}>Verify phone number →</Text>
            </Pressable>
          ) : null}
          {p.city ? (
            <View style={styles.chip}>
              <Icon name="map-marker" size={14} color={colors.neutral[500]} />
              <Text style={styles.chipText}>{p.city}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            style={styles.editButton}
            accessibilityRole="button"
          >
            <Text style={styles.editText}>Edit profile</Text>
          </Pressable>
        </View>

        <View style={[styles.card, styles.trustCard]}>
          <View style={styles.trustLeft}>
            <TrustBadge score={p.trustScore} />
            <Text style={styles.tierLabel}>{tier.label}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Your trust score</Text>
            <Text style={styles.body2}>{tierDescription(tier)}</Text>
            <Pressable onPress={() => navigation.navigate('TrustScore')} accessibilityRole="link">
              <Text style={styles.link}>View history →</Text>
            </Pressable>
          </View>
        </View>

        <Section title="Account">
          <Item
            icon="account-edit"
            label="Edit profile"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <Item
            icon="lock-reset"
            label="Change password"
            onPress={() => navigation.navigate('ChangePassword')}
          />
          <Item
            icon="credit-card-outline"
            label="Payment methods"
            onPress={() => navigation.navigate('PaymentMethods')}
          />
          <Item
            icon="calendar-check"
            label="My bookings"
            onPress={() => navigation.navigate('MyBookings')}
          />
          <Item
            icon="star-outline"
            label="My reviews"
            onPress={() => navigation.navigate('MyReviews')}
          />
          <Item
            icon="bell-outline"
            label="Notifications"
            onPress={() => navigation.navigate('Notifications')}
          />
          <Item
            icon="bell-cog-outline"
            label="Notification settings"
            onPress={() => navigation.navigate('NotificationSettings')}
          />
        </Section>
        {p.role === 'MANAGER' ? (
          <Section title="Your venue">
            <Item
              icon="calendar-multiple"
              label="Venue bookings"
              onPress={() => navigation.navigate('ManagerBookings')}
            />
            <Item
              icon="chart-bar"
              label="Analytics"
              onPress={() => navigation.navigate('ManagerAnalytics')}
            />
          </Section>
        ) : null}
        <Section title="Legal">
          <Item
            icon="file-document-outline"
            label="Terms of Service"
            onPress={() => void Linking.openURL(LEGAL.terms)}
            external
          />
          <Item
            icon="shield-account-outline"
            label="Privacy Policy"
            onPress={() => void Linking.openURL(LEGAL.privacy)}
            external
          />
        </Section>
        <Section title="Support">
          <Item
            icon="help-circle-outline"
            label="Help & FAQ"
            onPress={() => void Linking.openURL(LEGAL.help)}
            external
          />
          <Item
            icon="email-outline"
            label="Contact support"
            onPress={() => void Linking.openURL(`mailto:${LEGAL.supportEmail}`)}
            external
          />
        </Section>
        <Section title="Danger zone">
          <Item icon="logout" label="Log out" onPress={confirmLogout} danger />
          <Item
            icon="account-remove-outline"
            label="Delete account"
            onPress={() => navigation.navigate('DeleteAccount')}
            danger
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      <View style={styles.section}>{children}</View>
    </View>
  )
}

function Item({
  icon,
  label,
  onPress,
  danger,
  external,
}: {
  icon: string
  label: string
  onPress: () => void
  danger?: boolean
  external?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={22} color={danger ? colors.error[500] : colors.neutral[700]} />
      <Text style={[styles.itemText, danger && styles.danger]}>{label}</Text>
      {danger ? null : (
        <Icon
          name={external ? 'open-in-new' : 'chevron-right'}
          size={external ? 18 : 22}
          color={colors.neutral[400]}
        />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[50] },
  loading: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: spacing.xs },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  body: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1, gap: 2 },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  initials: {
    backgroundColor: colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: { fontWeight: '700', color: colors.primary[600] },
  name: { marginTop: 8, fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  muted: { fontSize: 15, color: colors.neutral[500] },
  chip: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.neutral[100],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, color: colors.neutral[700] },
  editButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editText: { fontSize: 14, fontWeight: '500', color: colors.neutral[900] },
  trustCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trustLeft: { alignItems: 'center', gap: 4 },
  tierLabel: { fontSize: 12, fontWeight: '600', color: colors.neutral[700] },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[900] },
  body2: { fontSize: 14, color: colors.neutral[700] },
  link: { marginTop: 4, fontSize: 14, fontWeight: '600', color: colors.primary[600] },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[400],
    marginBottom: 6,
    marginLeft: 4,
  },
  section: { backgroundColor: colors.neutral[0], borderRadius: 8, overflow: 'hidden' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  itemText: { flex: 1, fontSize: 15, color: colors.neutral[900] },
  danger: { color: colors.error[500] },
})
