/**
 * My reviews — E07-06. Every review the player has written: pitch, day
 * played, stars, text ("Show more" past three lines), photos and the venue's
 * reply. Edit while the server says it is editable (the Review screen, which
 * edits in place); Delete any time, after a confirmation.
 *
 * Opened from My Bookings: the app has no Profile screen yet.
 */
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDateLong, type MyReview } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { bookingApi } from '../../lib/bookingApi'
import { ApiError } from '../../lib/apiClient'
import { Stars } from '../../components/common/Stars'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { useToast } from '../../components/common/Toast'
import { colors, spacing } from '../../theme/tokens'
import { useLocale, useT } from '../../i18n'

type Props = NativeStackScreenProps<AppStackParamList, 'MyReviews'>

export const MY_REVIEWS_KEY = ['reviews', 'mine'] as const

export function MyReviewsScreen({ navigation }: Props) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const reviews = useQuery({ queryKey: MY_REVIEWS_KEY, queryFn: bookingApi.myReviews })
  const { show, toast } = useToast(insets.bottom + 24)

  // Optimistic: the card goes at once and comes back if the server refuses.
  const remove = useMutation({
    mutationFn: (id: string) => bookingApi.deleteReview(id),
    onMutate: async id => {
      await queryClient.cancelQueries({ queryKey: MY_REVIEWS_KEY })
      const before = queryClient.getQueryData<MyReview[]>(MY_REVIEWS_KEY)
      queryClient.setQueryData<MyReview[]>(MY_REVIEWS_KEY, list => list?.filter(r => r.id !== id))
      return { before }
    },
    onError: (e, _id, context) => {
      queryClient.setQueryData(MY_REVIEWS_KEY, context?.before)
      show(e instanceof ApiError ? e.message : t('bookings.myReviews.deleteFailed'))
    },
    onSuccess: () => {
      show(t('bookings.myReviews.deleted'))
      void queryClient.invalidateQueries({ queryKey: ['booking'] })
      void queryClient.invalidateQueries({ queryKey: ['reviews'] })
    },
  })

  const confirmDelete = (id: string) =>
    Alert.alert(t('bookings.myReviews.deleteTitle'), t('bookings.myReviews.deleteBody'), [
      { text: t('bookings.myReviews.cancel'), style: 'cancel' },
      {
        text: t('bookings.myReviews.delete'),
        style: 'destructive',
        onPress: () => remove.mutate(id),
      },
    ])

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
        <Text style={styles.title} accessibilityRole="header">
          {t('bookings.myReviews.title')}
        </Text>
      </View>

      {reviews.isError ? (
        <ErrorState onRetry={() => reviews.refetch()} />
      ) : reviews.isPending ? (
        <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
      ) : (
        <FlatList
          data={reviews.data}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          refreshControl={
            <RefreshControl refreshing={reviews.isRefetching} onRefresh={() => reviews.refetch()} />
          }
          ListEmptyComponent={
            <EmptyState
              illustration={<Icon name="star-outline" size={48} color={colors.neutral[300]} />}
              title={t('bookings.myReviews.none')}
              description={t('bookings.myReviews.noneHint')}
              ctaLabel={t('bookings.findPitch')}
              ctaVariant="secondary"
              onCta={() => navigation.navigate('Discover')}
            />
          }
          renderItem={({ item }) => (
            <MyReviewCard
              review={item}
              onEdit={() => navigation.navigate('Review', { bookingId: item.bookingId })}
              onDelete={() => confirmDelete(item.id)}
            />
          )}
        />
      )}
      {toast}
    </SafeAreaView>
  )
}

export function MyReviewCard({
  review: r,
  onEdit,
  onDelete,
}: {
  review: MyReview
  onEdit: () => void
  onDelete: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [clamped, setClamped] = useState(false)
  return (
    <View style={styles.card}>
      <Text style={styles.pitch}>{r.pitch.name}</Text>
      <Text style={styles.company}>{r.company.name}</Text>
      <View style={styles.meta}>
        <Text style={styles.date}>
          {t('bookings.myReviews.played', { date: formatDateLong(r.bookingDate, locale) })}
        </Text>
        <Stars rating={r.rating} />
      </View>
      {r.text ? (
        <>
          <Text
            style={styles.text}
            numberOfLines={open ? undefined : 3}
            onTextLayout={e => {
              if (!open && e.nativeEvent.lines.length > 3) setClamped(true)
            }}
          >
            {r.text}
          </Text>
          {clamped ? (
            <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button">
              <Text style={styles.more}>
                {open ? t('bookings.showLess') : t('bookings.showMore')}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {r.photoUrls.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photos}
        >
          {r.photoUrls.map(url => (
            <Image
              key={url}
              source={{ uri: url }}
              style={styles.photo}
              accessibilityLabel={t('bookings.myReviews.photo')}
            />
          ))}
        </ScrollView>
      ) : null}
      {r.reply ? (
        <View style={styles.reply}>
          <Text style={styles.replyLabel}>{t('bookings.myReviews.reply')}</Text>
          <Text style={styles.text}>{r.reply.text}</Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        {r.isEditable ? (
          <Pressable onPress={onEdit} accessibilityRole="button" style={styles.action}>
            <Text style={styles.edit}>{t('bookings.myReviews.edit')}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={onDelete} accessibilityRole="button" style={styles.action}>
          <Text style={styles.delete}>{t('bookings.myReviews.delete')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, height: 52 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  loading: { marginTop: spacing.xl },
  list: { padding: spacing.md, flexGrow: 1 },
  gap: { height: 12 },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: 8,
    padding: spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  pitch: { fontSize: 16, fontWeight: '600', color: colors.neutral[900] },
  company: { fontSize: 13, color: colors.neutral[500] },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  date: { fontSize: 13, color: colors.neutral[400] },
  text: { marginTop: 8, fontSize: 15, lineHeight: 21, color: colors.neutral[700] },
  more: { marginTop: 4, fontSize: 14, fontWeight: '500', color: colors.primary[600] },
  photos: { gap: 8, marginTop: 8 },
  photo: { width: 60, height: 60, borderRadius: 4 },
  reply: {
    marginTop: 12,
    marginLeft: 12,
    padding: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral[50],
  },
  replyLabel: { fontSize: 12, fontWeight: '500', color: colors.neutral[500] },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  action: { paddingVertical: 6, paddingHorizontal: 4 },
  edit: { fontSize: 14, fontWeight: '500', color: colors.primary[600] },
  delete: { fontSize: 14, fontWeight: '500', color: colors.error[500] },
})
