/**
 * Booking detail — E06-07 (UIUX_SPEC §8.2) with the cancel sheet of E06-08.
 * Status banner, venue (tap the phone to call), the booking, payment,
 * timeline, and the action that fits: cancel, rate, or dispute a no-show.
 *
 * The cancel sheet is a Modal rather than @gorhom/bottom-sheet (not
 * installed); it shows the refund the policy gives before confirming.
 */
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  REVIEW,
  SHIRT_COLOUR_HEX,
  type Locale,
  formatDateLong,
  formatDuration,
  fromMinutes,
  venueClock,
  type BookingDetail,
  type BookingStatus,
  type ShirtColour,
} from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { bookingApi } from '../../lib/bookingApi'
import { ApiError } from '../../lib/apiClient'
import { Button } from '../../components/ui/Button'
import { ErrorState } from '../../components/common/ErrorState'
import { useToast } from '../../components/common/Toast'
import { colors, spacing } from '../../theme/tokens'
import { currentT, useLocale, useT } from '../../i18n'

type Props = NativeStackScreenProps<AppStackParamList, 'BookingDetail'>

const BANNER: Record<BookingStatus, { bg: string; fg: string; icon: string }> = {
  CONFIRMED: {
    bg: colors.primary[50],
    fg: colors.primary[700],
    icon: 'check-circle',
  },
  PENDING: {
    bg: colors.warning[50],
    fg: '#92400E',
    icon: 'clock-outline',
  },
  AWAITING_APPROVAL: {
    bg: colors.warning[50],
    fg: '#92400E',
    icon: 'clock-outline',
  },
  COMPLETED: {
    bg: colors.primary[50],
    fg: colors.primary[700],
    icon: 'check-circle',
  },
  CANCELLED: {
    bg: colors.neutral[100],
    fg: colors.neutral[700],
    icon: 'close-circle',
  },
  NO_SHOW: { bg: colors.error[50], fg: colors.error[600], icon: 'alert-circle' },
}

/** "Thursday, 5 November 2026 at 18:00", venue time, without Intl. */
const at = (iso: string, locale: Locale) => {
  const c = venueClock(new Date(iso))
  return currentT()('bookings.detail.at', {
    date: formatDateLong(c.date, locale),
    time: fromMinutes(c.minutes),
  })
}

export function BookingDetailScreen({ navigation, route }: Props) {
  const t = useT()
  const locale = useLocale()
  const insets = useSafeAreaInsets()
  const id = route.params.id
  const queryClient = useQueryClient()
  const booking = useQuery({ queryKey: ['booking', id], queryFn: () => bookingApi.get(id) })
  const [sheet, setSheet] = useState(false)
  const { show, toast } = useToast(insets.bottom + 96)

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['booking', id] }),
      queryClient.invalidateQueries({ queryKey: ['bookings'] }),
      queryClient.invalidateQueries({ queryKey: ['booking-counts'] }),
    ])

  const cancel = useMutation({
    mutationFn: () => bookingApi.cancel(id),
    onSuccess: async data => {
      setSheet(false)
      await refresh()
      // Back to the list (or onto it, when opened from the confirmation).
      navigation.popTo('MyBookings', {
        tab: 'cancelled',
        notice:
          data.refundAmount > 0
            ? t('bookings.detail.cancelledRefund', { amount: data.refundAmount })
            : t('bookings.detail.cancelledNoRefund'),
      })
    },
    onError: e => {
      setSheet(false)
      show(e instanceof ApiError ? e.message : t('bookings.detail.cancelFailed'))
    },
  })

  if (booking.isError) return <ErrorState onRetry={() => booking.refetch()} />
  if (!booking.data) {
    return <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
  }
  const b = booking.data
  const banner = BANNER[b.status]
  const players = b.teams.reduce((n, t) => n + (t.players ?? 0), 0)

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('bookings.back')}
        >
          <Icon name="chevron-left" size={26} color={colors.neutral[900]} />
        </Pressable>
      </View>
      <View style={[styles.banner, { backgroundColor: banner.bg }]}>
        <Icon name={banner.icon} size={16} color={banner.fg} />
        <Text style={[styles.bannerText, { color: banner.fg }]}>
          {t(`bookings.detail.banner.${b.status}`)}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 96 }]}>
        <Text style={styles.title} accessibilityRole="header">
          {t('bookings.detail.title')}
        </Text>
        <Text style={styles.reference}>{b.reference}</Text>

        <View style={styles.company}>
          <View style={styles.flex}>
            <Text style={styles.companyName}>{b.company.name}</Text>
            <Text style={styles.muted}>
              {b.company.address}, {b.company.city}
            </Text>
            {b.company.phone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${b.company.phone}`)}
                accessibilityRole="link"
                accessibilityLabel={t('bookings.detail.call', { venue: b.company.name })}
              >
                <Text style={styles.phone}>{b.company.phone}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.info}>
          <Row icon="calendar">{formatDateLong(b.date, locale)}</Row>
          <Row icon="clock-outline">
            {b.startTime}–{b.endTime} · {formatDuration(b.minutes)}
          </Row>
          <Row icon="map-marker">
            {b.pitch.name} · {t(`surface.${b.pitch.surfaceType}`)}
          </Row>
          <Row icon="account-group">
            {t('bookings.detail.teams', { n: b.teamCount })}
            {players ? t('bookings.detail.players', { n: players }) : ''}
          </Row>
          {b.shirtSets > 0 ? (
            <Row icon="tshirt-crew">{t('bookings.detail.freeShirts', { count: b.shirtSets })}</Row>
          ) : null}
          {b.teams
            .filter(team => team.colour)
            .map(team => (
              <View key={team.name} style={styles.colourRow}>
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: SHIRT_COLOUR_HEX[team.colour as ShirtColour] },
                  ]}
                />
                <Text style={styles.rowText}>
                  {t('bookings.detail.shirtsOf', {
                    team: team.name,
                    colour: t(`shirt.${team.colour as ShirtColour}`),
                  })}
                </Text>
              </View>
            ))}
          {b.note ? <Row icon="note-text">{b.note}</Row> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('bookings.detail.payment')}</Text>
          <Line
            label={t('bookings.detail.pitch', { duration: formatDuration(b.minutes) })}
            value={`${b.total} RON`}
          />
          {b.shirtSets > 0 ? (
            <Line label={t('bookings.detail.shirts')} value={t('bookings.detail.free')} />
          ) : null}
          <View style={styles.total}>
            <Text style={styles.totalText}>
              {b.paidAt && b.paymentMethod === 'ONLINE'
                ? t('bookings.detail.totalPaid')
                : t('bookings.detail.total')}
            </Text>
            <Text style={styles.totalText}>{b.total} RON</Text>
          </View>
          {b.paymentMethod !== 'ONLINE' && b.deposit ? (
            <Line
              label={
                b.paymentMethod === 'VENUE_REFUND_DEPOSIT'
                  ? t('bookings.detail.depositBack')
                  : t('bookings.detail.deposit')
              }
              value={`${b.deposit} RON`}
            />
          ) : null}
          {b.paymentMethod !== 'ONLINE' ? (
            <Line
              label={b.attendedAt ? t('bookings.detail.paidAtVenue') : t('bookings.detail.toPay')}
              value={`${b.dueAtVenue} RON`}
            />
          ) : null}
          {b.paidAt ? (
            <Line
              label={t('bookings.detail.card')}
              value={
                b.payment.cardLast4
                  ? `${b.payment.cardBrand ?? t('bookings.detail.card')} ···· ${b.payment.cardLast4}`
                  : b.payment.provider === 'test'
                    ? t('bookings.detail.testPayment')
                    : t('bookings.detail.card')
              }
              small
            />
          ) : null}
          {b.paidAt ? (
            <Line label={t('bookings.detail.paidOn')} value={at(b.paidAt, locale)} small />
          ) : null}
          {b.payment.refundAmount !== null ? (
            <Text style={styles.refund}>
              {t('bookings.detail.refund', { amount: b.payment.refundAmount })}
            </Text>
          ) : null}
        </View>

        <View>
          <Text style={styles.cardTitle}>{t('bookings.detail.history_')}</Text>
          {b.statusHistory.map((s, i) => (
            <View key={`${s.status}-${s.at}`} style={styles.step}>
              <View style={styles.stepRail}>
                <View style={styles.dot} />
                {i < b.statusHistory.length - 1 ? <View style={styles.rail} /> : null}
              </View>
              <View style={styles.flex}>
                <Text style={styles.stepTitle}>{t(`bookings.detail.history.${s.status}`)}</Text>
                <Text style={styles.muted}>{at(s.at, locale)}</Text>
              </View>
            </View>
          ))}
        </View>

        {b.review ? (
          <ReviewBox
            booking={b}
            onEdit={() => navigation.navigate('Review', { bookingId: b.id })}
            onDeleted={refresh}
          />
        ) : null}
        {b.noShow ? <Dispute booking={b} onDone={refresh} /> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {b.cancellation ? (
          <Button
            label={t('bookings.detail.cancel')}
            variant="secondary"
            onPress={() => setSheet(true)}
          />
        ) : b.canReview ? (
          <Button
            label={t('bookings.detail.rate')}
            onPress={() => navigation.navigate('Review', { bookingId: b.id })}
          />
        ) : null}
      </View>

      <CancelSheet
        visible={sheet}
        booking={b}
        busy={cancel.isPending}
        onKeep={() => setSheet(false)}
        onCancel={() => cancel.mutate()}
      />
      {toast}
    </SafeAreaView>
  )
}

function Row({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={20} color={colors.neutral[500]} />
      <Text style={styles.rowText}>{children}</Text>
    </View>
  )
}

function Line({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={small ? styles.small : styles.lineText}>{label}</Text>
      <Text style={small ? styles.small : styles.lineText}>{value}</Text>
    </View>
  )
}

/** E06-08: the policy for this booking, then confirm. */
export function CancelSheet({
  visible,
  booking: b,
  busy,
  onKeep,
  onCancel,
}: {
  visible: boolean
  booking: BookingDetail
  busy: boolean
  onKeep: () => void
  onCancel: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const insets = useSafeAreaInsets()
  const c = b.cancellation
  if (!c) return null
  const tier =
    c.refundPercent === 100
      ? { bg: colors.primary[50], border: colors.primary[600] }
      : c.refundPercent > 0
        ? { bg: colors.warning[50], border: colors.warning[500] }
        : { bg: colors.error[50], border: colors.error[600] }
  const refunds = !!b.paidAt && c.refundAmount > 0
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onKeep}>
      <Pressable
        style={styles.backdrop}
        onPress={onKeep}
        accessibilityLabel={t('bookings.cancel.close')}
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.sheetTitle}>{t('bookings.cancel.title')}</Text>
        <Text style={styles.lineText}>{b.pitch.name}</Text>
        <Text style={styles.muted}>
          {formatDateLong(b.date, locale)}, {b.startTime}–{b.endTime}
        </Text>
        <View style={[styles.policy, { backgroundColor: tier.bg, borderLeftColor: tier.border }]}>
          {!b.paidAt ? (
            <Text style={styles.lineText}>{t('bookings.cancel.notPaid')}</Text>
          ) : refunds ? (
            <>
              <Text style={styles.lineText}>
                {(() => {
                  const [a, z = ''] = t('bookings.cancel.youGet', {
                    amount: '\u0000',
                    percent: c.refundPercent,
                  }).split('\u0000')
                  return (
                    <>
                      {a}
                      <Text style={styles.bold}>
                        {t('bookings.cancel.amount', { n: c.refundAmount })}
                      </Text>
                      {z}
                    </>
                  )
                })()}
              </Text>
              <Text style={styles.small}>{t('bookings.cancel.processed')}</Text>
            </>
          ) : (
            <Text style={styles.lineText}>
              <Text style={styles.bold}>{t('bookings.cancel.noRefund')}</Text>
              {t('bookings.cancel.windowPassed')}
            </Text>
          )}
        </View>
        <Button label={t('bookings.cancel.keep')} onPress={onKeep} />
        <Button
          label={
            refunds
              ? t('bookings.cancel.withRefund', { amount: c.refundAmount })
              : t('bookings.cancel.plain')
          }
          variant="secondary"
          loading={busy}
          onPress={onCancel}
        />
      </View>
    </Modal>
  )
}

function ReviewBox({
  booking: b,
  onEdit,
  onDeleted,
}: {
  booking: BookingDetail
  onEdit: () => void
  onDeleted: () => Promise<unknown>
}) {
  const t = useT()
  const r = b.review!
  const editable = new Date(r.editableUntil).getTime() > Date.now()
  const remove = useMutation({
    mutationFn: () => bookingApi.deleteReview(r.id),
    onSuccess: onDeleted,
  })
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('bookings.review.yours')}</Text>
      <View style={styles.stars} accessibilityLabel={t('bookings.review.stars', { n: r.rating })}>
        {[1, 2, 3, 4, 5].map(n => (
          <Icon
            key={n}
            name={n <= r.rating ? 'star' : 'star-outline'}
            size={18}
            color={n <= r.rating ? colors.warning[500] : colors.neutral[300]}
          />
        ))}
      </View>
      {r.text ? <Text style={styles.rowText}>{r.text}</Text> : null}
      {r.isAnonymous ? <Text style={styles.small}>{t('bookings.review.anonymous')}</Text> : null}
      {editable ? (
        <View style={styles.reviewActions}>
          <Pressable onPress={onEdit} accessibilityRole="button">
            <Text style={styles.link}>{t('bookings.review.edit')}</Text>
          </Pressable>
          <Pressable onPress={() => remove.mutate()} accessibilityRole="button">
            <Text style={styles.danger}>{t('bookings.review.delete')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

function Dispute({
  booking: b,
  onDone,
}: {
  booking: BookingDetail
  onDone: () => Promise<unknown>
}) {
  const t = useT()
  const ns = b.noShow!
  const [text, setText] = useState('')
  const dispute = useMutation({
    mutationFn: () => bookingApi.dispute(b.id, text.trim()),
    onSuccess: onDone,
  })
  if (ns.disputeStatus !== 'NONE') {
    return (
      <Button
        label={
          ns.disputeStatus === 'OPEN'
            ? t('bookings.dispute.submitted')
            : t('bookings.dispute.reviewed')
        }
        variant="ghost"
        disabled
        onPress={() => {}}
      />
    )
  }
  if (!ns.disputeUntil) return <Text style={styles.muted}>{t('bookings.dispute.passed')}</Text>
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('bookings.dispute.there')}</Text>
      <Text style={styles.muted}>
        {ns.reason
          ? t('bookings.dispute.markedWhy', { reason: ns.reason })
          : t('bookings.dispute.marked')}
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={REVIEW.MAX_DISPUTE_TEXT_LENGTH}
        multiline
        placeholder={t('bookings.dispute.what')}
        accessibilityLabel={t('bookings.dispute.what')}
        style={styles.input}
      />
      {dispute.isError ? (
        <Text style={styles.danger}>
          {dispute.error instanceof ApiError ? dispute.error.message : t('bookings.dispute.failed')}
        </Text>
      ) : null}
      <Button
        label={t('bookings.dispute.send')}
        variant="secondary"
        disabled={!text.trim()}
        loading={dispute.isPending}
        onPress={() => dispute.mutate()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  loading: { flex: 1 },
  header: { height: 52, justifyContent: 'center', paddingHorizontal: spacing.xs },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  banner: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bannerText: { fontSize: 14, fontWeight: '600' },
  body: { padding: spacing.md, gap: spacing.md },
  flex: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700', color: colors.neutral[900], textAlign: 'center' },
  reference: {
    fontFamily: 'Courier New',
    fontSize: 12,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  company: { flexDirection: 'row', gap: 12 },
  companyName: { fontSize: 18, fontWeight: '600', color: colors.neutral[900] },
  muted: { fontSize: 14, color: colors.neutral[500] },
  phone: { fontSize: 15, color: colors.primary[600], marginTop: 2 },
  info: { backgroundColor: colors.neutral[50], borderRadius: 8, padding: spacing.md, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, fontSize: 15, color: colors.neutral[900] },
  colourRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 32 },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[900], marginBottom: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  lineText: { fontSize: 15, color: colors.neutral[700] },
  small: { fontSize: 13, color: colors.neutral[500] },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: spacing.sm,
  },
  totalText: { fontSize: 17, fontWeight: '700', color: colors.neutral[900] },
  refund: { fontSize: 13, fontWeight: '500', color: colors.primary[700] },
  step: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 10 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary[600],
    marginTop: 5,
  },
  rail: { flex: 1, width: 1, backgroundColor: colors.neutral[200] },
  stepTitle: { fontSize: 15, fontWeight: '500', color: colors.neutral[900] },
  stars: { flexDirection: 'row', gap: 2 },
  reviewActions: { flexDirection: 'row', gap: spacing.lg },
  link: { fontSize: 15, fontWeight: '500', color: colors.primary[600] },
  danger: { fontSize: 15, fontWeight: '500', color: colors.error[600] },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.neutral[0],
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: { fontSize: 20, fontWeight: '600', color: colors.neutral[900] },
  policy: {
    borderLeftWidth: 3,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    padding: 12,
    gap: 4,
    marginVertical: spacing.sm,
  },
  bold: { fontWeight: '700', color: colors.neutral[900] },
})
