import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { DAY_LONG, formatDayHours, todayStatus, venueClock, type DayHours } from '@pitchup/shared'
import { colors } from '../../theme/tokens'

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true)

/** Today's status, expanding to the week. UIUX_SPEC §6.1, E04-04. */
export function WorkingHoursAccordion({ week }: { week: DayHours[] }) {
  const [open, setOpen] = useState(false)
  const rotation = useRef(new Animated.Value(0)).current
  const now = new Date()
  const status = todayStatus(week, now)
  const today = venueClock(now).day

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [open, rotation])

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen(o => !o)
  }

  // Monday first.
  const order = [1, 2, 3, 4, 5, 6, 0]

  return (
    <View>
      <Pressable
        onPress={toggle}
        style={styles.row}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Opening hours"
      >
        <Icon name="clock-outline" size={16} color={colors.neutral[400]} />
        {status.kind === 'open' ? (
          <Text style={styles.body}>
            <Text style={styles.open}>Open</Text> · Closes at {status.closesAt}
          </Text>
        ) : status.kind === 'opensLater' ? (
          <Text style={styles.body}>Opens at {status.opensAt}</Text>
        ) : (
          <Text style={styles.closed}>Closed today</Text>
        )}
        <Animated.View
          style={{
            transform: [
              {
                rotate: rotation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          }}
        >
          <Icon name="chevron-down" size={16} color={colors.neutral[400]} />
        </Animated.View>
      </Pressable>
      {open ? (
        <View style={styles.week}>
          {order.map(d => {
            const day = week[d]!
            const isToday = d === today
            return (
              <View key={d} style={styles.dayRow}>
                <Text style={[styles.dayLabel, isToday && styles.today]}>{DAY_LONG[d]}</Text>
                <Text
                  style={[
                    styles.hours,
                    day.isClosed && styles.hoursClosed,
                    isToday && styles.today,
                  ]}
                >
                  {formatDayHours(day)}
                </Text>
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  body: { fontSize: 14, color: colors.neutral[700] },
  open: { color: colors.success[500], fontWeight: '500' },
  closed: { fontSize: 12, color: colors.error[500] },
  week: { paddingLeft: 22, paddingTop: 4, gap: 4 },
  dayRow: { flexDirection: 'row' },
  dayLabel: { width: 96, fontSize: 13, fontWeight: '500', color: colors.neutral[500] },
  hours: { fontSize: 14, color: colors.neutral[900] },
  hoursClosed: { color: colors.neutral[400] },
  today: { fontWeight: '700', color: colors.neutral[900] },
})
