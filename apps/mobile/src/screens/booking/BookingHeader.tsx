/**
 * Top of every booking step — E05-01: progress bar, back, "Step X of 5",
 * close. Closing after step 1 asks first (DiscardConfirmSheet).
 */
import React, { useEffect, useRef, useState } from 'react'
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { Button } from '../../components/ui/Button'
import { colors, spacing } from '../../theme/tokens'
import { useT } from '../../i18n'

export const STEP_COUNT = 5

interface Props {
  step: number
  onBack: (() => void) | null
  /** Closes the whole flow. */
  onClose: (() => void) | null
}

export function BookingHeader({ step, onBack, onClose }: Props) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const progress = useRef(new Animated.Value((step - 1) / STEP_COUNT)).current
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    Animated.timing(progress, {
      toValue: step / STEP_COUNT,
      duration: 300,
      useNativeDriver: false,
    }).start()
  }, [progress, step])

  const close = () => (step > 1 ? setConfirming(true) : onClose?.())

  return (
    <View style={{ paddingTop: insets.top }}>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel={t('booking.header.progress')}
        accessibilityValue={{ min: 1, max: STEP_COUNT, now: step }}
      >
        <Animated.View
          style={[
            styles.fill,
            { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={styles.icon}
            accessibilityRole="button"
            accessibilityLabel={t('booking.header.back')}
          >
            <Icon name="chevron-left" size={26} color={colors.neutral[700]} />
          </Pressable>
        ) : (
          <View style={styles.icon} />
        )}
        <Text style={styles.label}>
          Step {step} of {STEP_COUNT}
        </Text>
        {onClose ? (
          <Pressable
            onPress={close}
            style={styles.icon}
            accessibilityRole="button"
            accessibilityLabel={t('booking.header.cancel')}
          >
            <Icon name="close" size={24} color={colors.neutral[700]} />
          </Pressable>
        ) : (
          <View style={styles.icon} />
        )}
      </View>

      <Modal
        visible={confirming}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirming(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setConfirming(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.sheetTitle}>{t('booking.header.sure')}</Text>
          <Text style={styles.sheetBody}>{t('booking.header.lost')}</Text>
          <Button
            label={t('booking.header.keep')}
            variant="secondary"
            onPress={() => setConfirming(false)}
          />
          <Button
            label={t('booking.header.discard')}
            variant="ghost"
            onPress={() => {
              // The flow resets the store when it unmounts, not here: the
              // screens still render while the modal closes.
              setConfirming(false)
              onClose?.()
            }}
          />
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  track: { height: 4, backgroundColor: colors.neutral[200] },
  fill: { height: 4, backgroundColor: colors.primary[600] },
  row: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, color: colors.neutral[500], fontWeight: '500' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral[900] },
  sheetBody: { fontSize: 15, color: colors.neutral[500], marginBottom: spacing.sm },
})
