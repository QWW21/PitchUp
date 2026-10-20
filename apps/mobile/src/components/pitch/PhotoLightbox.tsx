import React, { useEffect, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { useT } from '../../i18n'

interface PhotoLightboxProps {
  urls: string[]
  /** Null closes the lightbox. */
  index: number | null
  onClose: () => void
}

/**
 * Fullscreen photos, swiped with a paging FlatList. E04-05.
 *
 * Zoom uses ScrollView's built-in pinch (1×–4×), which only iOS implements.
 * Android pinch-zoom and double-tap need react-native-gesture-handler and
 * reanimated, which are not installed; adding native modules to the pinned
 * RN 0.76 tree is its own piece of work.
 */
export function PhotoLightbox({ urls, index, onClose }: PhotoLightboxProps) {
  const t = useT()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const list = useRef<FlatList<string>>(null)
  const [current, setCurrent] = useState(index ?? 0)

  useEffect(() => {
    if (index === null) return
    setCurrent(index)
    // Wait a frame so the list has measured before jumping to the tapped photo.
    requestAnimationFrame(() => list.current?.scrollToIndex({ index, animated: false }))
  }, [index])

  return (
    <Modal
      visible={index !== null}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <FlatList
          ref={list}
          data={urls}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(url, i) => `${i}-${url}`}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          // Same Android Fabric unmount crash as the onboarding slides.
          removeClippedSubviews={false}
          initialScrollIndex={index ?? 0}
          onMomentumScrollEnd={e => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <ScrollView
              style={{ width, height }}
              contentContainerStyle={styles.center}
              maximumZoomScale={Platform.OS === 'ios' ? 4 : 1}
              minimumZoomScale={1}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              <Image source={{ uri: item }} style={{ width, height }} resizeMode="contain" />
            </ScrollView>
          )}
        />
        <Text style={[styles.counter, { top: insets.top + 24 }]}>
          {current + 1} / {urls.length}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('discover.pitch.closePhotos')}
          style={[styles.close, { top: insets.top + 16 }]}
        >
          <Icon name="close" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', alignSelf: 'center', color: '#FFFFFF', fontSize: 12 },
  close: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
})
