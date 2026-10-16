/**
 * One booking for its venue's manager — E11-09: the booking, the player's
 * history at this venue, the payment, the timeline, and the actions that
 * are allowed now (Confirm attended, Mark as complete, Report no-show, each
 * asking first).
 */
import React from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDateLong, formatShortDuration, paymentStatusLine } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { managerApi } from '../../lib/managerApi'
import { ApiError } from '../../lib/apiClient'
import { ErrorState } from '../../components/common/ErrorState'
import { colors, spacing } from '../../theme/tokens'
import { STATUS_TEXT } from './ManagerBookingsScreen'

type Props = NativeStackScreenProps<AppStackParamList, 'ManagerBookingDetail'>

export function ManagerBookingDetailScreen({ navigation, route }: Props) {
  const { id } = route.params
  const queryClient = useQueryClient()
  const detail = useQuery({
    queryKey: ['manager-booking', id],
    queryFn: () => managerApi.booking(id),
  })
  const act = useMutation({
    mutationFn: (action: 'attended' | 'noShow' | 'complete') => managerApi[action](id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-booking', id] })
      void queryClient.invalidateQueries({ queryKey: ['manager-bookings'] })
    },
    onError: e =>
      Alert.alert(
        'Not done',
        e instanceof ApiError ? e.message : 'Something went wrong. Try again.'
      ),
  })

  if (detail.isError) return <ErrorState onRetry={() => detail.refetch()} />
  if (!detail.data) return <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
  const b = detail.data
  const h = b.player.history
  const [label, icon, tint] = b.attendedAt
    ? ['Attended', 'check-circle', colors.primary[600]]
    : STATUS_TEXT[b.status]

  const confirm = (
    title: string,
    message: string,
    action: 'attended' | 'noShow' | 'complete',
    destructive = false
  ) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: destructive ? 'destructive' : 'default',
        onPress: () => act.mutate(action),
      },
    ])

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
          Booking {b.reference}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.status}>
          <Icon name={icon} size={18} color={tint} />
          <Text style={[styles.statusText, { color: tint }]}>{label}</Text>
        </View>

        <Section title="Booking">
          <Line label="Pitch" value={b.pitch.name} />
          <Line label="Date" value={formatDateLong(b.date)} />
          <Line
            label="Time"
            value={`${b.startTime}–${b.endTime} (${formatShortDuration(b.minutes)})`}
          />
          <Line
            label="Teams"
            value={b.teams.map(t => `${t.name}${t.players ? ` (${t.players})` : ''}`).join(' · ')}
          />
          <Line
            label="Shirts"
            value={b.shirtSets ? `${b.shirtSets} ${b.shirtSets === 1 ? 'set' : 'sets'}` : 'None'}
          />
          {b.note ? <Line label="Note" value={b.note} /> : null}
        </Section>

        <Section title="Player">
          <Text style={styles.strong}>{b.player.name}</Text>
          {b.player.phone ? (
            <Pressable
              onPress={() => void Linking.openURL(`tel:${b.player.phone}`)}
              accessibilityRole="link"
              accessibilityLabel={`Call ${b.player.name}`}
            >
              <Text style={styles.link}>{b.player.phone}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.muted}>
            With you: {h.bookings} bookings, {h.completed} played, {h.noShows} no-shows,{' '}
            {h.lateCancels} late cancellations.
          </Text>
        </Section>

        <Section title="Payment">
          <Line label="Price" value={`${b.total} RON`} />
          <Line label="PitchUp commission" value={`${b.platformFee} RON`} />
          <Line label="You receive" value={`${b.venuePayout} RON`} />
          <Text style={styles.muted}>{paymentStatusLine(b)}</Text>
        </Section>

        <Section title="History">
          {b.statusHistory.map((e, i) => (
            <Text key={i} style={styles.muted}>
              {STATUS_TEXT[e.status][0]} · {new Date(e.at).toLocaleString('en-GB')}
            </Text>
          ))}
        </Section>

        <View style={styles.actions}>
          {b.canConfirmAttended ? (
            <Action
              label="Confirm attended"
              primary
              busy={act.isPending}
              onPress={() =>
                confirm(
                  'Confirm attended?',
                  b.paymentMethod === 'VENUE_REFUND_DEPOSIT' && b.deposit
                    ? `The player's ${b.deposit} RON deposit is refunded.`
                    : 'Marks the booking as attended and paid at the venue.',
                  'attended'
                )
              }
            />
          ) : null}
          {b.canComplete ? (
            <Action
              label="Mark as complete"
              busy={act.isPending}
              onPress={() => confirm('Mark as complete?', 'The game has been played.', 'complete')}
            />
          ) : null}
          {b.canReportNoShow ? (
            <Action
              label="Report no-show"
              danger
              busy={act.isPending}
              onPress={() =>
                confirm(
                  'Report a no-show?',
                  "The player loses 20 trust points and is told; they can dispute it. This can't be undone.",
                  'noShow',
                  true
                )
              }
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  )
}

function Action({
  label,
  onPress,
  busy,
  primary,
  danger,
}: {
  label: string
  onPress: () => void
  busy: boolean
  primary?: boolean
  danger?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.action, primary && styles.actionPrimary, danger && styles.actionDanger]}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
    >
      <Text
        style={[
          styles.actionText,
          primary && styles.actionTextPrimary,
          danger && styles.actionTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[50] },
  loading: { marginTop: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, height: 52 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  body: { padding: spacing.md, gap: spacing.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 15, fontWeight: '600' },
  card: { backgroundColor: colors.neutral[0], borderRadius: 8, padding: spacing.md, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[900] },
  line: { flexDirection: 'row', gap: spacing.sm },
  lineLabel: { width: 130, fontSize: 14, color: colors.neutral[500] },
  lineValue: { flex: 1, fontSize: 14, color: colors.neutral[900] },
  strong: { fontSize: 15, fontWeight: '600', color: colors.neutral[900] },
  muted: { fontSize: 13, color: colors.neutral[500] },
  link: { fontSize: 14, fontWeight: '500', color: colors.primary[600] },
  actions: { gap: spacing.sm },
  action: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  actionDanger: { borderColor: colors.error[600] },
  actionText: { fontSize: 15, fontWeight: '600', color: colors.neutral[900] },
  actionTextPrimary: { color: colors.neutral[0] },
  actionTextDanger: { color: colors.error[600] },
})
