/**
 * Step 3: teams and shirts — E05-04 (UIUX_SPEC §7.3, with C-1). Two or three
 * teams, players per team (starting from the pitch size's suggestion), free
 * shirts as one switch, an optional colour per team that borrows a set, and
 * a note. Everything is optional, so Next is always enabled.
 */
import React from 'react'
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import {
  BOOKING,
  SHIRT_COLOUR_HEX,
  SHIRT_COLOURS_NEEDING_BORDER,
  bookingPrice,
  formatDuration,
  shirtSetsFor,
} from '@pitchup/shared'
import { bookingRate, useBookingStore } from '../../stores/bookingStore'
import { Button } from '../../components/ui/Button'
import { colors, spacing } from '../../theme/tokens'
import { BookingHeader } from './BookingHeader'
import type { BookingScreenProps } from './navigation'
import { useT } from '../../i18n'

export function Step3TeamsScreen({ navigation }: BookingScreenProps<'BookingTeams'>) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const TEAM_NAMES = ([0, 1, 2] as const).map(i => t(`booking.teams.names.${i}`))
  const s = useBookingStore()
  const pitch = s.pitch!
  const sets = shirtSetsFor(s.teamCount, true)
  const stock = pitch.shirtStock.filter(c => c.quantity > 0)
  const totalSets = stock.reduce((n, c) => n + c.quantity, 0)
  const price = bookingPrice(bookingRate(s), s.minutes)

  return (
    <View style={styles.root}>
      <BookingHeader
        step={3}
        onBack={() => navigation.goBack()}
        onClose={() => navigation.getParent()?.goBack()}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>
          {pitch.hasShirts ? t('booking.teams.headingShirts') : t('booking.teams.heading')}
        </Text>

        <View style={styles.segment} accessibilityRole="radiogroup">
          {([2, 3] as const).map(n => (
            <Pressable
              key={n}
              onPress={() => s.setTeamCount(n)}
              style={[styles.segmentItem, s.teamCount === n && styles.segmentOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: s.teamCount === n }}
            >
              <Text style={[styles.segmentText, s.teamCount === n && styles.segmentTextOn]}>
                {t('booking.teams.count', { n })}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t('booking.teams.players')}</Text>
        <View style={styles.card}>
          {TEAM_NAMES.slice(0, s.teamCount).map((name, ti) => {
            const count = s.players[ti]!
            return (
              <View key={name} style={styles.stepRow}>
                <Text style={styles.teamName}>{name}</Text>
                <Pressable
                  onPress={() => s.setPlayers(ti, count - 1)}
                  disabled={count <= 1}
                  style={styles.stepButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('booking.teams.fewer', { team: name })}
                >
                  <Icon
                    name="minus"
                    size={20}
                    color={count <= 1 ? colors.neutral[300] : colors.neutral[700]}
                  />
                </Pressable>
                <Text
                  style={styles.count}
                  accessibilityLabel={t('booking.teams.playersCount', { n: count })}
                >
                  {count}
                </Text>
                <Pressable
                  onPress={() => s.setPlayers(ti, count + 1)}
                  disabled={count >= BOOKING.MAX_PLAYERS_PER_TEAM}
                  style={styles.stepButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('booking.teams.more', { team: name })}
                >
                  <Icon
                    name="plus"
                    size={20}
                    color={
                      count >= BOOKING.MAX_PLAYERS_PER_TEAM
                        ? colors.neutral[300]
                        : colors.neutral[700]
                    }
                  />
                </Pressable>
              </View>
            )
          })}
        </View>

        {pitch.hasShirts ? (
          <View style={styles.card}>
            <View style={styles.shirtsRow}>
              <View style={styles.flex}>
                <Text style={styles.teamName}>{t('booking.teams.freeShirts')}</Text>
                <Text style={styles.muted}>{t('booking.teams.oneSetEach', { count: sets })}</Text>
              </View>
              <Switch
                value={s.wantsShirts}
                disabled={totalSets < sets}
                onValueChange={v => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                  s.setWantsShirts(v)
                }}
                accessibilityLabel={t('booking.teams.freeShirts')}
                trackColor={{ true: colors.primary[600], false: colors.neutral[300] }}
              />
            </View>
            {totalSets < sets ? (
              <Text style={styles.muted}>
                {t('booking.teams.notEnough', { count: totalSets, teams: s.teamCount })}
              </Text>
            ) : null}
            {s.wantsShirts
              ? TEAM_NAMES.slice(0, sets).map((name, ti) => (
                  <View key={name} style={styles.colourRow}>
                    <Text style={styles.colourLabel}>
                      {t('booking.teams.colourOf', { team: name })}
                    </Text>
                    <View style={styles.swatches}>
                      {stock.map(({ colour }) => {
                        const on = s.colours[ti] === colour
                        return (
                          <Pressable
                            key={colour}
                            onPress={() => s.setColour(ti, on ? null : colour)}
                            style={[styles.ring, on && styles.ringOn]}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: on }}
                            accessibilityLabel={t('booking.teams.colourLabel', {
                              team: name,
                              colour: t(`shirt.${colour}`),
                            })}
                          >
                            <View
                              style={[
                                styles.swatch,
                                { backgroundColor: SHIRT_COLOUR_HEX[colour] },
                                SHIRT_COLOURS_NEEDING_BORDER.includes(colour) &&
                                  styles.swatchBorder,
                              ]}
                            />
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>
                ))
              : null}
            {s.wantsShirts ? (
              <Text style={styles.muted}>
                {t('booking.teams.ownKit', { team: TEAM_NAMES[s.teamCount - 1]! })}
              </Text>
            ) : null}
          </View>
        ) : (
          // C-7: say so, rather than leave a gap that looks like a bug.
          <View style={styles.card}>
            <Text style={styles.muted}>{t('booking.teams.noShirts')}</Text>
          </View>
        )}

        <Text style={styles.label}>{t('booking.teams.note')}</Text>
        <TextInput
          value={s.note}
          onChangeText={s.setNote}
          maxLength={BOOKING.MAX_NOTE_LENGTH}
          multiline
          style={styles.note}
          accessibilityLabel={t('booking.teams.noteLabel')}
        />
        <Text style={styles.counter}>
          {s.note.length} / {BOOKING.MAX_NOTE_LENGTH}
        </Text>

        <View style={styles.card}>
          <View style={styles.priceRow}>
            <Text style={styles.muted}>
              {t('booking.teams.pitchLine', {
                duration: formatDuration(s.minutes),
                rate: bookingRate(s),
              })}
            </Text>
            <Text style={styles.muted}>{price.total} RON</Text>
          </View>
          {s.wantsShirts ? (
            <View style={styles.priceRow}>
              <Text style={styles.muted}>{t('booking.teams.shirts')}</Text>
              <Text style={styles.muted}>{t('booking.teams.free')}</Text>
            </View>
          ) : null}
          <View style={[styles.priceRow, styles.total]}>
            <Text style={styles.bold}>{t('booking.teams.total')}</Text>
            <Text style={styles.bold}>{price.total} RON</Text>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label={t('booking.next')} onPress={() => navigation.navigate('BookingSummary')} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  body: { padding: spacing.md, gap: spacing.md },
  flex: { flex: 1 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.neutral[900] },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: 6,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  segmentOn: { backgroundColor: colors.neutral[0], elevation: 1 },
  segmentText: { fontSize: 14, fontWeight: '500', color: colors.neutral[500] },
  segmentTextOn: { color: colors.neutral[900] },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[700] },
  card: {
    backgroundColor: colors.neutral[50],
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  teamName: { flex: 1, fontSize: 15, color: colors.neutral[900] },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  count: { width: 40, textAlign: 'center', fontSize: 17, color: colors.neutral[900] },
  shirtsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  muted: { fontSize: 13, color: colors.neutral[500] },
  colourRow: { gap: spacing.xs },
  colourLabel: { fontSize: 12, fontWeight: '500', color: colors.neutral[700] },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ring: { padding: 2, borderRadius: 22, borderWidth: 3, borderColor: 'transparent' },
  ringOn: { borderColor: colors.neutral[900] },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  swatchBorder: { borderWidth: 1, borderColor: colors.neutral[200] },
  note: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.neutral[900],
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: colors.neutral[500] },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { borderTopWidth: 1, borderTopColor: colors.neutral[200], paddingTop: spacing.sm },
  bold: { fontSize: 15, fontWeight: '700', color: colors.neutral[900] },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
})
