/**
 * Step 4: summary and payment — E05-05 (UIUX_SPEC §7.4).
 *
 * Pay creates the booking (PENDING, holding the slot for 15 minutes), then
 * completes the payment: Stripe's CardField and confirmPayment when Stripe is
 * set up, the built-in test payment otherwise. A declined card keeps the
 * player here; trying again replaces the unpaid booking.
 *
 * Paying at the venue (C-8): where the venue allows it and the player's trust
 * score is 70+, they choose how to pay; only the deposit is charged here,
 * and with no deposit nothing is.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useQuery } from '@tanstack/react-query'
import { CardField, useStripe } from '@stripe/stripe-react-native'
import {
  paymentMethodLabel,
  type Locale,
  bookingPrice,
  describePayment,
  paymentSplit,
  formatDateLong,
  formatDuration,
  freeCancellationUntil,
  partialRefundUntil,
  describeRefundPolicy,
  DEFAULT_REFUND_POLICY,
  shirtSetsFor,
  toMinutes,
  venueClock,
  venueTimeToUtc,
  fromMinutes,
  type BookingPaymentMethod,
} from '@pitchup/shared'
import { bookingApi } from '../../lib/bookingApi'
import { ApiError } from '../../lib/apiClient'
import { bookingBody, bookingRate, useBookingStore } from '../../stores/bookingStore'
import { useToast } from '../../components/common/Toast'
import { colors, spacing } from '../../theme/tokens'
import { BookingHeader } from './BookingHeader'
import type { BookingScreenProps } from './navigation'
import { currentT, useLocale, useT } from '../../i18n'

export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    const t = currentT()
    const reason = (e.details as { reason?: string } | undefined)?.reason
    const key = `booking.summary.reasons.${reason}` as 'booking.summary.reasons.SLOT_CONFLICT'
    return reason && t.has(key) ? t(key) : e.message
  }
  return currentT()('booking.summary.paymentFailed')
}

/** "Wednesday, 4 November 2026 at 18:00", venue time. */
const venueLabel = (instant: Date, locale: Locale) => {
  const { date, minutes } = venueClock(instant)
  return currentT()('booking.summary.at', {
    date: formatDateLong(date, locale),
    time: fromMinutes(minutes),
  })
}

export function Step4SummaryScreen({ navigation }: BookingScreenProps<'BookingSummary'>) {
  const t = useT()
  const locale = useLocale()
  const insets = useSafeAreaInsets()
  const s = useBookingStore()
  const pitch = s.pitch!
  const config = useQuery({ queryKey: ['payment-config'], queryFn: bookingApi.paymentConfig })
  const options = useQuery({
    queryKey: ['payment-options', pitch.id],
    queryFn: () => bookingApi.paymentOptions(pitch.id),
  })
  const [chosen, setChosen] = useState<BookingPaymentMethod | null>(null)
  const methods = options.data?.methods ?? []
  const method = chosen && methods.includes(chosen) ? chosen : (methods[0] ?? null)
  const [busy, setBusy] = useState(false)
  const { show, toast } = useToast(insets.bottom + 120)
  const shake = useRef(new Animated.Value(0)).current

  const price = bookingPrice(bookingRate(s), s.minutes)
  const split = method ? paymentSplit(price.total, method, options.data!.depositPercent) : null
  const isStripe = config.data?.provider === 'stripe' && !!split && split.payNow > 0
  const isTest = config.data?.provider === 'test' && !!split && split.payNow > 0
  const payLabel = split
    ? t(split.deposit ? 'booking.summary.payDeposit' : 'booking.summary.payLabel', {
        amount: split.payNow,
      })
    : ''
  const sets = shirtSetsFor(s.teamCount, s.wantsShirts)
  const players = s.players.slice(0, s.teamCount).reduce((a, b) => a + b, 0)
  const start = venueTimeToUtc(s.date!, toMinutes(s.startTime!))
  // C-10: the venue's own policy, which the booking keeps.
  const policy = options.data?.refundPolicy ?? DEFAULT_REFUND_POLICY
  const freeUntil = freeCancellationUntil(start, policy)
  const partUntil = partialRefundUntil(start, policy)

  const fail = (message: string) => {
    show(message)
    Animated.sequence(
      [8, -8, 8, -8, 0].map(toValue =>
        Animated.timing(shake, { toValue, duration: 50, useNativeDriver: true })
      )
    ).start()
  }

  const finish = (bookingId: string) => navigation.replace('BookingConfirmation', { bookingId })

  const payTest = async (outcome: 'succeed' | 'decline') => {
    setBusy(true)
    try {
      const created = await bookingApi.create(bookingBody(s, split!.method))
      const result = await bookingApi.confirmTest(created.bookingId, outcome)
      if (result.status === 'CONFIRMED') return finish(created.bookingId)
      fail(t('booking.summary.declined'))
    } catch (e) {
      fail(describeError(e))
    }
    setBusy(false)
  }

  // Nothing to pay online: the booking is confirmed at once.
  const bookFree = async () => {
    setBusy(true)
    try {
      const created = await bookingApi.create(bookingBody(s, split!.method))
      return finish(created.bookingId)
    } catch (e) {
      fail(describeError(e))
    }
    setBusy(false)
  }

  return (
    <View style={styles.root}>
      <BookingHeader
        step={4}
        onBack={() => navigation.goBack()}
        onClose={() => navigation.getParent()?.goBack()}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{t('booking.summary.heading')}</Text>

        <View style={styles.summary}>
          <Row icon="calendar">{formatDateLong(s.date!, locale)}</Row>
          <Row icon="clock-outline">
            {s.startTime}–{s.endTime} ({formatDuration(s.minutes)})
          </Row>
          <Row icon="map-marker">
            {pitch.name} · {pitch.companyName}
          </Row>
          {s.airType ? (
            <Row icon="thermometer">
              {t('covered')} · {t(`air.${s.airType}`)}
            </Row>
          ) : null}
          <Row icon="account-group">
            {t('booking.summary.teamsPlayers', { teams: s.teamCount, players })}
          </Row>
          {sets > 0 ? (
            <Row icon="tshirt-crew">{t('booking.summary.freeShirts', { count: sets })}</Row>
          ) : null}
          {s.note.trim() ? (
            <Row icon="note-text" lines={1}>
              {s.note.trim()}
            </Row>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('booking.summary.price')}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.body15}>
              {t('booking.teams.pitchLine', {
                duration: formatDuration(s.minutes),
                rate: bookingRate(s),
              })}
            </Text>
            <Text style={styles.body15}>{price.total} RON</Text>
          </View>
          {sets > 0 ? (
            <View style={styles.priceRow}>
              <Text style={styles.body15}>{t('booking.teams.shirts')}</Text>
              <Text style={styles.body15}>{t('booking.teams.free')}</Text>
            </View>
          ) : null}
          <View style={[styles.priceRow, styles.total]}>
            <Text style={styles.totalText}>{t('booking.teams.total')}</Text>
            <Text style={styles.totalText}>{price.total} RON</Text>
          </View>
          <Text style={styles.small}>{t('booking.summary.noFee')}</Text>
        </View>

        {methods.length > 1 ? (
          <View style={styles.card} accessibilityRole="radiogroup">
            <Text style={styles.cardTitle}>{t('booking.summary.how')}</Text>
            {methods.map(m => {
              const option = paymentSplit(price.total, m, options.data!.depositPercent)
              const on = m === method
              const label =
                option.payNow === 0 && m !== 'ONLINE'
                  ? t('booking.summary.payAtVenue')
                  : paymentMethodLabel(m, locale)
              return (
                <Pressable
                  key={m}
                  onPress={() => setChosen(m)}
                  style={[styles.choice, on && styles.choiceOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${label}. ${describePayment(option, locale)}`}
                >
                  <Icon
                    name={on ? 'radiobox-marked' : 'radiobox-blank'}
                    size={22}
                    color={on ? colors.primary[600] : colors.neutral[300]}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.choiceTitle}>{label}</Text>
                    <Text style={styles.body15}>{describePayment(option, locale)}</Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        ) : null}
        {methods.length === 1 && split && split.method !== 'ONLINE' ? (
          <View style={styles.card}>
            <Text style={styles.choiceTitle}>{describePayment(split, locale)}</Text>
          </View>
        ) : null}
        {options.isSuccess && !method ? (
          <Text style={styles.error}>{t('booking.summary.venueOnly')}</Text>
        ) : null}

        <View style={styles.policy}>
          <Icon name="information-outline" size={18} color={colors.info[500]} />
          <Text style={styles.policyText}>
            {freeUntil.getTime() > Date.now()
              ? t('booking.summary.freeUntil', { when: venueLabel(freeUntil, locale) })
              : partUntil.getTime() > Date.now() && policy.partialRefundPercent > 0
                ? t('booking.summary.partial', {
                    percent: policy.partialRefundPercent,
                    when: venueLabel(partUntil, locale),
                  })
                : t('booking.summary.noRefund')}{' '}
            {describeRefundPolicy(policy, locale)}
            {options.data?.autoApproveBookings === false ? t('booking.summary.confirmsEach') : ''}
          </Text>
        </View>

        {isTest ? (
          <View style={styles.testNotice}>
            <Text style={styles.small}>
              <Text style={styles.bold}>{t('booking.summary.testMode')}</Text>
              {t('booking.summary.testBody')}
            </Text>
          </View>
        ) : null}
        {isStripe ? (
          <StripeCard
            label={payLabel}
            method={split!.method}
            busy={busy}
            setBusy={setBusy}
            onPaid={finish}
            onError={fail}
          />
        ) : null}
        {config.isSuccess && !config.data.provider ? (
          <Text style={styles.error}>{t('booking.summary.unavailable')}</Text>
        ) : null}
      </ScrollView>

      {split && split.payNow === 0 ? (
        <Animated.View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + spacing.md, transform: [{ translateX: shake }] },
          ]}
        >
          <PayButton label={t('booking.summary.confirm')} busy={busy} onPress={bookFree} />
        </Animated.View>
      ) : null}
      {isTest ? (
        <Animated.View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + spacing.md, transform: [{ translateX: shake }] },
          ]}
        >
          <PayButton label={payLabel} busy={busy} onPress={() => payTest('succeed')} />
          <Pressable
            onPress={() => payTest('decline')}
            disabled={busy}
            style={styles.declineLink}
            accessibilityRole="button"
          >
            <Text style={styles.link}>{t('booking.summary.simulate')}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
      {toast}
    </View>
  )
}

function Row({
  icon,
  children,
  lines,
}: {
  icon: string
  children: React.ReactNode
  lines?: number
}) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={20} color={colors.neutral[500]} />
      <Text style={styles.rowText} numberOfLines={lines}>
        {children}
      </Text>
    </View>
  )
}

function PayButton({
  label,
  busy,
  onPress,
  disabled,
}: {
  label: string
  busy: boolean
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={[styles.pay, (busy || disabled) && styles.payDisabled]}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy || !!disabled }}
    >
      <Text style={styles.payText}>{busy ? currentT()('booking.summary.processing') : label}</Text>
    </Pressable>
  )
}

/** A new card through Stripe's CardField; Stripe keeps the number away from our servers. */
function StripeCard({
  label,
  method,
  busy,
  setBusy,
  onPaid,
  onError,
}: {
  label: string
  method: BookingPaymentMethod
  busy: boolean
  setBusy: (b: boolean) => void
  onPaid: (bookingId: string) => void
  onError: (message: string) => void
}) {
  const s = useBookingStore()
  const { confirmPayment } = useStripe()
  const [complete, setComplete] = useState(false)
  const cards = useQuery({ queryKey: ['saved-cards'], queryFn: bookingApi.savedCards })
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    if (cards.data?.[0] && saved === null) setSaved(cards.data[0].id)
  }, [cards.data, saved])

  const pay = async () => {
    setBusy(true)
    try {
      const created = await bookingApi.create(bookingBody(s, method, saved ?? undefined))
      if (created.payment.provider !== 'stripe') throw new Error('Unexpected payment mode')
      const { error } = await confirmPayment(
        created.payment.clientSecret,
        saved
          ? { paymentMethodType: 'Card', paymentMethodData: { paymentMethodId: saved } }
          : { paymentMethodType: 'Card' },
        saved ? undefined : { setupFutureUsage: 'OffSession' }
      )
      if (error) {
        // Stripe's own words for a decline are the clearest ones.
        onError(error.message)
      } else {
        // The server checks the payment with Stripe when the confirmation loads.
        return onPaid(created.bookingId)
      }
    } catch (e) {
      onError(describeError(e))
    }
    setBusy(false)
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{currentT()('booking.summary.method')}</Text>
      {cards.data?.map(c => (
        <Pressable
          key={c.id}
          onPress={() => setSaved(c.id)}
          style={styles.cardRow}
          accessibilityRole="radio"
          accessibilityState={{ checked: saved === c.id }}
        >
          <Text style={styles.body15}>
            {c.brand.toUpperCase()} ···· {c.last4} {String(c.expMonth).padStart(2, '0')}/
            {String(c.expYear).slice(-2)}
          </Text>
          <Icon
            name={saved === c.id ? 'check-circle' : 'circle-outline'}
            size={22}
            color={saved === c.id ? colors.primary[600] : colors.neutral[300]}
          />
        </Pressable>
      ))}
      <Pressable
        onPress={() => setSaved('')}
        style={styles.cardRow}
        accessibilityRole="radio"
        accessibilityState={{ checked: !saved }}
      >
        <Text style={styles.link}>{currentT()('booking.summary.addCard')}</Text>
      </Pressable>
      {!saved ? (
        <CardField
          postalCodeEnabled={false}
          onCardChange={d => setComplete(d.complete)}
          style={styles.cardField}
        />
      ) : null}
      <PayButton label={label} busy={busy} disabled={!saved && !complete} onPress={pay} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  body: { padding: spacing.md, gap: spacing.md },
  heading: { fontSize: 22, fontWeight: '700', color: colors.neutral[900] },
  summary: { backgroundColor: colors.neutral[50], borderRadius: 8, padding: spacing.md, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, fontSize: 15, color: colors.neutral[900] },
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
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[900] },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  body15: { fontSize: 15, color: colors.neutral[700] },
  total: { borderTopWidth: 1, borderTopColor: colors.neutral[200], paddingTop: spacing.sm },
  totalText: { fontSize: 17, fontWeight: '700', color: colors.neutral[900] },
  small: { fontSize: 12, color: colors.neutral[500] },
  bold: { fontWeight: '700', color: colors.neutral[900] },
  policy: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.info[50],
    borderLeftWidth: 3,
    borderLeftColor: colors.info[500],
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    padding: 12,
  },
  policyText: { flex: 1, fontSize: 13, color: colors.neutral[700] },
  testNotice: { backgroundColor: colors.warning[50], borderRadius: 6, padding: 12 },
  error: { fontSize: 14, color: colors.error[600] },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  pay: {
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.accent[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  payDisabled: { opacity: 0.6 },
  payText: { fontSize: 17, fontWeight: '700', color: colors.neutral[0] },
  declineLink: { height: 44, alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 15, fontWeight: '500', color: colors.primary[600] },
  cardRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardField: { height: 50, marginVertical: spacing.sm },
  flex: { flex: 1 },
  choice: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 8,
    padding: 12,
  },
  choiceOn: { borderColor: colors.primary[600], backgroundColor: colors.primary[50] },
  choiceTitle: { fontSize: 15, fontWeight: '600', color: colors.neutral[900] },
})
