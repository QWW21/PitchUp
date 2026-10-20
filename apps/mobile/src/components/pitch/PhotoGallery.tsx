import React, { useState } from 'react'
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import type { PitchDetail } from '@pitchup/shared'
import { PhotoLightbox } from './PhotoLightbox'
import { colors } from '../../theme/tokens'
import { useT } from '../../i18n'

export const GALLERY_HEIGHT = 240

/** Paging photo strip with a "3 / 8" counter; tap opens the lightbox. E04-05. */
export function PhotoGallery({ photos }: { photos: PitchDetail['photos'] }) {
  const t = useT()
  const { width } = useWindowDimensions()
  const [current, setCurrent] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)

  if (photos.length === 0) {
    return (
      <View style={[styles.empty, { width }]}>
        <Icon name="image-off" size={48} color={colors.neutral[400]} />
        <Text style={styles.emptyText}>{t('discover.pitch.noPhotos')}</Text>
      </View>
    )
  }

  return (
    <View>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={p => p.id}
        // Same Android Fabric unmount crash as the onboarding slides.
        removeClippedSubviews={false}
        onMomentumScrollEnd={e => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => setLightbox(index)}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('discover.pitch.photoOf', { n: index + 1, total: photos.length })}
          >
            <Image
              source={{ uri: item.url }}
              style={{ width, height: GALLERY_HEIGHT }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
      />
      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {current + 1} / {photos.length}
        </Text>
      </View>
      <PhotoLightbox
        urls={photos.map(p => p.url)}
        index={lightbox}
        onClose={() => setLightbox(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  empty: {
    height: GALLERY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  emptyText: { marginTop: 8, fontSize: 12, color: colors.neutral[400] },
  counter: {
    position: 'absolute',
    right: 12,
    bottom: 8,
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  counterText: { color: '#FFFFFF', fontSize: 12 },
})
