import React, { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { ReviewItem } from '@pitchup/shared'
import { Stars } from '../common/Stars'
import { PhotoLightbox } from '../pitch/PhotoLightbox'
import { colors } from '../../theme/tokens'

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(iso)
  )

function Avatar({ review }: { review: ReviewItem }) {
  if (review.isAnonymous) {
    return (
      <View style={[styles.avatar, styles.anon]}>
        <Text style={styles.anonText}>?</Text>
      </View>
    )
  }
  if (review.playerAvatarUrl) {
    return <Image source={{ uri: review.playerAvatarUrl }} style={styles.avatar} />
  }
  const initials = review.playerName
    .replace('.', '')
    .split(' ')
    .map(p => p[0])
    .join('')
  return (
    <View style={[styles.avatar, styles.initials]}>
      <Text style={styles.initialsText}>{initials}</Text>
    </View>
  )
}

/** Horizontal strip of a review's photos; tap opens the lightbox. E04-07. */
export function ReviewPhotoStrip({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {urls.map((url, i) => (
          <Pressable
            key={url}
            onPress={() => setOpen(i)}
            accessibilityLabel={`Review photo ${i + 1}`}
          >
            <Image source={{ uri: url }} style={styles.photo} />
          </Pressable>
        ))}
      </ScrollView>
      <PhotoLightbox urls={urls} index={open} onClose={() => setOpen(null)} />
    </>
  )
}

interface ReviewCardProps {
  review: ReviewItem
  /** Pitch-page preview: three lines, no photos, no reply. */
  compact?: boolean
}

/** UIUX_SPEC §6.1. A rating-only review shows no empty text line. */
export function ReviewCard({ review, compact = false }: ReviewCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar review={review} />
        <View>
          <Text style={[styles.name, review.isAnonymous && styles.nameAnon]}>
            {review.playerName}
          </Text>
          <Text style={styles.date}>{formatDate(review.createdAt)}</Text>
        </View>
      </View>
      <View style={styles.stars}>
        <Stars rating={review.rating} />
      </View>
      {review.text ? (
        <Text style={styles.text} numberOfLines={compact ? 3 : undefined}>
          {review.text}
        </Text>
      ) : null}
      {!compact && review.photoUrls.length > 0 ? (
        <ReviewPhotoStrip urls={review.photoUrls} />
      ) : null}
      {!compact && review.managerReply ? (
        <View style={styles.reply}>
          <Text style={styles.replyLabel}>
            RESPONSE FROM THE VENUE
            {review.managerRepliedAt ? ` · ${formatDate(review.managerRepliedAt)}` : ''}
          </Text>
          <Text style={styles.text}>{review.managerReply}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.neutral[200] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  anon: { backgroundColor: colors.neutral[200], alignItems: 'center', justifyContent: 'center' },
  anonText: { color: colors.neutral[500], fontSize: 12, fontWeight: '500' },
  initials: {
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: { color: colors.primary[700], fontSize: 11, fontWeight: '500' },
  name: { fontSize: 13, fontWeight: '500', color: colors.neutral[900] },
  nameAnon: { color: colors.neutral[500] },
  date: { fontSize: 12, color: colors.neutral[400] },
  stars: { marginTop: 6 },
  text: { marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.neutral[700] },
  strip: { gap: 8, marginTop: 8 },
  photo: { width: 80, height: 80, borderRadius: 8 },
  reply: {
    marginTop: 12,
    marginLeft: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.neutral[50],
  },
  replyLabel: { fontSize: 11, fontWeight: '500', color: colors.neutral[500] },
})
