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
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  formatDateLong,
  formatShortDuration,
  paymentStatusLine,
  INTL_LOCALE,
} from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { managerApi } from '../../lib/managerApi'
import { ApiError } from '../../lib/apiClient'
import { ErrorState } from '../../components/common/ErrorState'
import { colors, spacing } from '../../theme/tokens'
import { STATUS_TEXT } from './ManagerBookingsScreen'
import { useLocale, useT } from '../../i18n'

type Props = NativeStackScreenProps<AppStackParamList, 'ManagerBookingDetail'>

export function ManagerBookingDetailScreen({ navigation, route }: Props) {
  const t = useT()
  const locale = useLocale()
  const { id } = route.params
  const queryClient = useQueryClient()
  const detail = useQuery({
    queryKey: ['manager-booking', id],
    queryFn: () => managerApi.booking(id),
  })
  const [why, setWhy] = React.useState<string | null>(null)
  const act = useMutation({
    mutationFn: (action: 'attended' | 'noShow' | 'complete' | 'accept' | 'cancel') =>
      action === 'cancel' ? managerApi.cancel(id, (why ?? '').trim()) : managerApi[action](id),
    onSuccess: () => {
      setWhy(null)
      void queryClient.invalidateQueries({ queryKey: ['manager-booking', id] })
      void queryClient.invalidateQueries({ queryKey: ['manager-bookings'] })
    },
    onError: e =>
      Alert.alert(
        t('manager.detail.notDone'),
        e instanceof ApiError ? e.message : t('manager.detail.wentWrong')
      ),
  })

  if (detail.isError) return <ErrorState onRetry={() => detail.refetch()} />
  if (!detail.data) return <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
  const b = detail.data
  const h = b.player.history
  const [icon, tint] = b.attendedAt ? ['check-circle', colors.primary[600]] : STATUS_TEXT[b.status]
  const label = b.attendedAt ? t('manager.status.attended') : t(`manager.status.${b.status}`)

  const confirm = (
    title: string,
    message: string,
    action: 'attended' | 'noShow' | 'complete',
    destructive = false
  ) =>
    Alert.alert(title, message, [
      { text: t('manager.detail.cancel'), style: 'cancel' },
      {
        text: t('manager.detail.confirm'),
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
          accessibilityLabel={t('manager.back')}
        >
          <Icon name="chevron-left" size={26} color={colors.neutral[900]} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('manager.detail.title', { reference: b.reference })}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.status}>
          <Icon name={icon} size={18} color={tint} />
          <Text style={[styles.statusText, { color: tint }]}>{label}</Text>
        </View>

        <Section title={t('manager.detail.booking')}>
          <Line label={t('manager.detail.pitch')} value={b.pitch.name} />
          <Line label={t('manager.detail.date')} value={formatDateLong(b.date, locale)} />
          <Line
            label={t('manager.detail.time')}
            value={`${b.startTime}–${b.endTime} (${formatShortDuration(b.minutes)})`}
          />
          <Line
            label={t('manager.detail.teams')}
            value={b.teams
              .map(team => `${team.name}${team.players ? ` (${team.players})` : ''}`)
              .join(' · ')}
          />
          <Line
            label={t('manager.detail.shirts')}
            value={
              b.shirtSets
                ? t('manager.detail.sets', { count: b.shirtSets })
                : t('manager.detail.none')
            }
          />
          {b.note ? <Line label={t('manager.detail.note')} value={b.note} /> : null}
        </Section>

        <Section title={t('manager.detail.player')}>
          <Text style={styles.strong}>{b.player.name}</Text>
          {b.player.phone ? (
            <Pressable
              onPress={() => void Linking.openURL(`tel:${b.player.phone}`)}
              accessibilityRole="link"
              accessibilityLabel={t('manager.detail.call', { name: b.player.name })}
            >
              <Text style={styles.link}>{b.player.phone}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.muted}>
            {t('manager.detail.withYou', {
              bookings: h.bookings,
              completed: h.completed,
              noShows: h.noShows,
              late: h.lateCancels,
            })}
          </Text>
        </Section>

        <Section title={t('manager.detail.payment')}>
          <Line label={t('manager.detail.price')} value={`${b.total} RON`} />
          <Line label={t('manager.detail.commission')} value={`${b.platformFee} RON`} />
          <Line label={t('manager.detail.receive')} value={`${b.venuePayout} RON`} />
          <Text style={styles.muted}>{paymentStatusLine(b, locale)}</Text>
        </Section>

        <Section title={t('manager.detail.history')}>
          {b.statusHistory.map((e, i) => (
            <Text key={i} style={styles.muted}>
              {t(`manager.status.${e.status}`)} ·{' '}
              {new Date(e.at).toLocaleString(INTL_LOCALE[locale])}
            </Text>
          ))}
        </Section>

        {b.canAccept && b.approvalDeadline ? (
          <Text style={styles.muted}>
            {t('manager.detail.waits', {
              name: b.player.name,
              deadline: new Date(b.approvalDeadline).toLocaleString(INTL_LOCALE[locale]),
            })}
          </Text>
        ) : null}
        {why !== null ? (
          <View style={styles.reasonBox}>
            <Text style={styles.strong}>
              {b.status === 'AWAITING_APPROVAL'
                ? t('manager.detail.declineTitle')
                : t('manager.detail.cancelTitle')}
            </Text>
            <Text style={styles.muted}>{t('manager.detail.refundNote')}</Text>
            <TextInput
              value={why}
              onChangeText={setWhy}
              placeholder={t('manager.detail.reason')}
              accessibilityLabel={t('manager.detail.reason')}
              maxLength={300}
              multiline
              style={styles.reasonInput}
            />
            <View style={styles.actions}>
              <Action label={t('manager.detail.keep')} busy={false} onPress={() => setWhy(null)} />
              <Action
                label={
                  b.status === 'AWAITING_APPROVAL'
                    ? t('manager.detail.declineRefund')
                    : t('manager.detail.cancelRefund')
                }
                danger
                busy={act.isPending || why.trim().length < 5}
                onPress={() => act.mutate('cancel')}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          {b.canAccept ? (
            <Action
              label={t('manager.detail.accept')}
              primary
              busy={act.isPending}
              onPress={() => act.mutate('accept')}
            />
          ) : null}
          {b.canCancel && why === null ? (
            <Action
              label={
                b.status === 'AWAITING_APPROVAL'
                  ? t('manager.detail.decline')
                  : t('manager.detail.cancelBooking')
              }
              danger
              busy={act.isPending}
              onPress={() => setWhy('')}
            />
          ) : null}
          {b.canConfirmAttended ? (
            <Action
              label={t('manager.detail.attended')}
              primary
              busy={act.isPending}
              onPress={() =>
                confirm(
                  t('manager.detail.attendedTitle'),
                  b.paymentMethod === 'VENUE_REFUND_DEPOSIT' && b.deposit
                    ? t('manager.detail.depositBack', { amount: b.deposit })
                    : t('manager.detail.marksPaid'),
                  'attended'
                )
              }
            />
          ) : null}
          {b.canComplete ? (
            <Action
              label={t('manager.detail.complete')}
              busy={act.isPending}
              onPress={() =>
                confirm(t('manager.detail.completeTitle'), t('manager.detail.played'), 'complete')
              }
            />
          ) : null}
          {b.canReportNoShow ? (
            <Action
              label={t('manager.detail.noShow')}
              danger
              busy={act.isPending}
              onPress={() =>
                confirm(
                  t('manager.detail.noShowTitle'),
                  t('manager.detail.noShowBody'),
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
  reasonBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.neutral[0],
  },
  reasonInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 8,
    padding: spacing.sm,
    textAlignVertical: 'top',
    color: colors.neutral[900],
  },
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
