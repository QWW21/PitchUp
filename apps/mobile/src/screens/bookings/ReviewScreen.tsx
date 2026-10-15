/**
 * Review a booking — E06-09 (UIUX_SPEC §8.4). Stars (a shake if Submit is
 * pressed without one), an optional 10–500 character text, and posting
 * anonymously. Also edits one's own review while it is editable.
 *
 * Deviation: no photos on mobile yet. Picking them needs
 * react-native-image-picker, a native module the app does not have, and
 * uploads need Cloudinary keys, which are not set. The web review form
 * takes photos when Cloudinary is configured.
 */
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { REVIEW, formatDateLong } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { bookingApi } from '../../lib/bookingApi'
import { ApiError } from '../../lib/apiClient'
import { Button } from '../../components/ui/Button'
import { colors, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AppStackParamList, 'Review'>

const LABELS = [
  null,
  { text: 'Very poor', color: colors.error[500] },
  { text: 'Poor', color: colors.warning[500] },
  { text: 'Average', color: colors.neutral[500] },
  { text: 'Good', color: colors.primary[500] },
  { text: 'Excellent!', color: colors.primary[600] },
]

export function ReviewScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const id = route.params.bookingId
  const queryClient = useQueryClient()
  const booking = useQuery({ queryKey: ['booking', id], queryFn: () => bookingApi.get(id) })
  const existing = booking.data?.review ?? null

  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const shake = useRef(new Animated.Value(0)).current
  const labelOpacity = useRef(new Animated.Value(0)).current

  // An edit starts from the review as posted.
  useEffect(() => {
    if (!existing) return
    setRating(existing.rating)
    setText(existing.text ?? '')
    setAnonymous(existing.isAnonymous)
  }, [existing])

  useEffect(() => {
    labelOpacity.setValue(0)
    Animated.timing(labelOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start()
  }, [rating, labelOpacity])

  const trimmed = text.trim()
  const textError =
    trimmed.length > 0 && trimmed.length < REVIEW.MIN_TEXT_LENGTH
      ? `Review must be at least ${REVIEW.MIN_TEXT_LENGTH} characters`
      : null

  const submit = useMutation({
    mutationFn: (): Promise<unknown> => {
      const body = { rating, ...(trimmed ? { text: trimmed } : {}), isAnonymous: anonymous }
      return existing
        ? bookingApi.updateReview(existing.id, body)
        : bookingApi.createReview({ bookingId: id, ...body })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['booking', id] }),
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
      ])
      navigation.goBack()
    },
  })

  const press = () => {
    if (!rating) {
      Animated.sequence(
        [8, -8, 8, -8, 8, -8, 0].map(toValue =>
          Animated.timing(shake, { toValue, duration: 50, useNativeDriver: true })
        )
      ).start()
      return
    }
    if (!textError) submit.mutate()
  }

  const b = booking.data
  const label = LABELS[rating]

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
          {existing ? 'Edit your review' : 'Rate this pitch'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {b ? (
          <View style={styles.pitch}>
            <Text style={styles.pitchName}>{b.pitch.name}</Text>
            <Text style={styles.muted}>{b.company.name}</Text>
            <Text style={styles.muted}>Played {formatDateLong(b.date)}</Text>
          </View>
        ) : null}

        <Animated.View
          style={[styles.stars, { transform: [{ translateX: shake }] }]}
          accessibilityRole="adjustable"
          accessibilityLabel="Rating"
          accessibilityValue={{ min: 0, max: 5, now: rating }}
        >
          {[1, 2, 3, 4, 5].map(n => (
            <Pressable
              key={n}
              onPress={() => setRating(n)}
              accessibilityRole="button"
              accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
            >
              <Icon
                name={n <= rating ? 'star' : 'star-outline'}
                size={40}
                color={n <= rating ? colors.warning[500] : colors.neutral[300]}
              />
            </Pressable>
          ))}
        </Animated.View>
        <Animated.Text style={[styles.label, { opacity: labelOpacity, color: label?.color }]}>
          {label?.text ?? ' '}
        </Animated.Text>

        <View>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Share your experience (optional)..."
            multiline
            maxLength={REVIEW.MAX_TEXT_LENGTH}
            style={styles.input}
            accessibilityLabel="Your review"
          />
          <View style={styles.inputFoot}>
            <Text style={styles.error}>{textError}</Text>
            <Text style={styles.counter}>
              {text.length} / {REVIEW.MAX_TEXT_LENGTH}
            </Text>
          </View>
        </View>

        <View style={styles.anonRow}>
          <View style={styles.flex}>
            <Text style={styles.anonTitle}>Post anonymously</Text>
            <Text style={styles.muted}>Your name won&apos;t be shown</Text>
          </View>
          <Switch
            value={anonymous}
            onValueChange={setAnonymous}
            accessibilityLabel="Post anonymously"
            trackColor={{ true: colors.primary[600], false: colors.neutral[300] }}
          />
        </View>

        {submit.isError ? (
          <Text style={styles.error}>
            {submit.error instanceof ApiError
              ? submit.error.message
              : 'Could not submit. Try again.'}
          </Text>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={existing ? 'Save changes' : 'Submit review'}
          onPress={press}
          loading={submit.isPending}
          disabled={!!textError}
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
  flex: { flex: 1 },
  pitch: { backgroundColor: colors.neutral[50], borderRadius: 8, padding: 12 },
  pitchName: { fontSize: 15, fontWeight: '600', color: colors.neutral[900] },
  muted: { fontSize: 13, color: colors.neutral[500] },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  label: { textAlign: 'center', fontSize: 15, fontWeight: '600' },
  input: {
    minHeight: 80,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.neutral[900],
    textAlignVertical: 'top',
  },
  inputFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  error: { fontSize: 13, color: colors.error[500] },
  counter: { fontSize: 11, color: colors.neutral[400] },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  anonTitle: { fontSize: 15, fontWeight: '500', color: colors.neutral[900] },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
})
