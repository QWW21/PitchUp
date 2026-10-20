/**
 * Full-screen city picker — E03-03, UIUX_SPEC §5.3.
 */
import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { CITIES, foldForSearch, type City } from '@pitchup/shared'
import { useDiscoverStore } from '../../stores/discoverStore'
import { useLocation, type DetectResult } from '../../hooks/useLocation'
import { colors } from '../../theme/tokens'
import { useT } from '../../i18n'

const DETECT_MESSAGES: Record<Exclude<DetectResult, 'detected'>, 'denied' | 'error'> = {
  denied: 'denied',
  blocked: 'denied',
  error: 'error',
}

interface CitySelectorProps {
  visible: boolean
  onClose: () => void
}

export function CitySelector({ visible, onClose }: CitySelectorProps) {
  const t = useT()
  const selectedCity = useDiscoverStore(s => s.selectedCity)
  const setCity = useDiscoverStore(s => s.setCity)
  const { requestAndDetect } = useLocation()

  const [query, setQuery] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // In memory and instant; no debounce needed for ten rows.
  const filtered = useMemo(() => {
    const q = foldForSearch(query.trim())
    return CITIES.filter(c => foldForSearch(c.name).includes(q))
  }, [query])

  function close() {
    setQuery('')
    setMessage(null)
    onClose()
  }

  async function detect() {
    setDetecting(true)
    setMessage(null)
    const result = await requestAndDetect()
    setDetecting(false)
    if (result === 'detected') close()
    else setMessage(t(`discover.city.${DETECT_MESSAGES[result]}`))
  }

  function choose(city: City) {
    setCity(city.name)
    close()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
      onRequestClose={close}
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('discover.city.title')}</Text>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t('discover.city.close')}
            style={styles.closeButton}
          >
            <Icon name="close" size={24} color={colors.neutral[900]} />
          </Pressable>
        </View>

        <View style={styles.search}>
          <Icon name="magnify" size={18} color={colors.neutral[400]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('discover.city.search')}
            placeholderTextColor={colors.neutral[400]}
            autoCorrect={false}
            style={styles.searchInput}
            accessibilityLabel={t('discover.city.searchLabel')}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={c => c.name}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              <Pressable
                onPress={detect}
                disabled={detecting}
                style={styles.detectRow}
                accessibilityRole="button"
              >
                {detecting ? (
                  <ActivityIndicator size="small" color={colors.primary[600]} />
                ) : (
                  <Icon name="crosshairs-gps" size={20} color={colors.primary[600]} />
                )}
                <Text style={styles.detectText}>{t('discover.city.detect')}</Text>
              </Pressable>
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <Text style={styles.section}>{t('discover.city.country')}</Text>
            </>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{t('discover.city.none', { query })}</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => choose(item)}
              style={({ pressed }) => [styles.cityRow, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: item.name === selectedCity }}
            >
              <View style={styles.cityText}>
                <Text style={styles.cityName}>{item.name}</Text>
                <Text style={styles.county}>{item.county}</Text>
              </View>
              {item.name === selectedCity ? (
                <Icon name="check" size={20} color={colors.primary[600]} />
              ) : null}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  title: { flex: 1, fontSize: 20, lineHeight: 28, fontWeight: '600', color: colors.neutral[900] },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    backgroundColor: colors.neutral[100],
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.neutral[900], paddingVertical: 0 },
  detectRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  detectText: { fontSize: 16, lineHeight: 24, color: colors.primary[600] },
  message: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 14, color: colors.error[600] },
  section: {
    paddingTop: 12,
    paddingBottom: 4,
    paddingLeft: 16,
    fontSize: 11,
    fontWeight: '500',
    color: colors.neutral[400],
    backgroundColor: colors.neutral[50],
  },
  cityRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  pressed: { backgroundColor: colors.neutral[50] },
  cityText: { flex: 1 },
  cityName: { fontSize: 16, lineHeight: 24, color: colors.neutral[900] },
  county: { fontSize: 12, lineHeight: 18, color: colors.neutral[500] },
  empty: { paddingTop: 40, textAlign: 'center', fontSize: 14, color: colors.neutral[500] },
})
