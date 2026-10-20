/**
 * Covers the Discover tab until a city is known — E03-02, PRD §7.1.
 * An overlay rather than a screen: the tab stays mounted underneath.
 */
import React, { useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { Button } from '../../components/ui/Button'
import { useLocation } from '../../hooks/useLocation'
import { colors } from '../../theme/tokens'
import { useT } from '../../i18n'

interface CityBlockerProps {
  onSelectManually: () => void
  /** True when Android will not show the permission prompt again. */
  permissionBlocked: boolean
  onPermissionBlocked: () => void
}

export function CityBlocker({
  onSelectManually,
  permissionBlocked,
  onPermissionBlocked,
}: CityBlockerProps) {
  const t = useT()
  const { requestAndDetect } = useLocation()
  const [detecting, setDetecting] = useState(false)
  const [failed, setFailed] = useState(false)

  async function detect() {
    setDetecting(true)
    setFailed(false)
    const result = await requestAndDetect()
    setDetecting(false)
    if (result === 'blocked') onPermissionBlocked()
    else if (result === 'error') setFailed(true)
  }

  return (
    <View style={styles.root}>
      <Icon name="map-marker" size={64} color={colors.primary[600]} />
      <Text style={styles.title}>{t('discover.city.where')}</Text>
      <Text style={styles.body}>{t('discover.city.selectToFind')}</Text>
      {failed ? <Text style={styles.error}>{t('discover.city.notFound')}</Text> : null}
      <View style={styles.buttons}>
        {permissionBlocked ? (
          // "Don't ask again": the app can no longer prompt, only the settings can.
          <Button
            label={t('discover.city.allowSettings')}
            onPress={() => void Linking.openSettings()}
          />
        ) : (
          <Button label={t('discover.city.detect')} onPress={detect} loading={detecting} />
        )}
        <Button label={t('discover.city.manual')} variant="secondary" onPress={onSelectManually} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    paddingHorizontal: 40,
  },
  title: {
    marginTop: 16,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.neutral[900],
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  error: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.error[600],
    textAlign: 'center',
  },
  buttons: { alignSelf: 'stretch', marginTop: 32, gap: 12 },
})
