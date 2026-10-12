/**
 * Player registration step 1 — E02-02.
 * Collects name, email, phone, city.
 */
import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { CITY_NAMES } from '@pitchup/shared'
import type { AuthStackParamList } from '../../../App'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { colors, radius, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AuthStackParamList, 'Register1'>

export function RegisterStep1Screen({ navigation }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (name.trim().length < 2) e.name = 'Full name must be at least 2 characters.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address.'
    if (!/^\+\d{9,15}$/.test(phone.trim()))
      e.phone = 'Enter a phone in E.164 format, e.g. +40712345678.'
    if (!city) e.city = 'Select your city.'
    return e
  }

  function handleNext() {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    navigation.push('Register2', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      city,
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.wordmark}>PitchUp</Text>
        <Text style={styles.heading}>Create your account</Text>

        <View style={styles.stepRow}>
          {[1, 2].map(n => (
            <View key={n} style={[styles.stepDot, n === 1 && styles.stepDotActive]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>Step 1 of 2 — Your info</Text>

        <View style={styles.form}>
          <Input
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Ion Popescu"
            autoCapitalize="words"
            error={errors.name}
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="ion@example.ro"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
          />
          <Input
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+40712345678"
            keyboardType="phone-pad"
            error={errors.phone}
          />

          {/* City picker */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>City</Text>
            <Pressable
              onPress={() => setCityPickerOpen(true)}
              style={[styles.picker, !!errors.city && styles.pickerError]}
            >
              <Text style={city ? styles.pickerValue : styles.pickerPlaceholder}>
                {city || 'Select your city'}
              </Text>
              <Text style={styles.pickerChevron}>›</Text>
            </Pressable>
            {errors.city ? <Text style={styles.error}>{errors.city}</Text> : null}
          </View>
        </View>

        <Button label="Continue" onPress={handleNext} />

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.loginRow}>
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginLink}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>

      {/* City picker modal */}
      <Modal visible={cityPickerOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select city</Text>
            <ScrollView>
              {CITY_NAMES.map(c => (
                <Pressable
                  key={c}
                  onPress={() => {
                    setCity(c)
                    setCityPickerOpen(false)
                  }}
                  style={[styles.cityRow, city === c && styles.cityRowSelected]}
                >
                  <Text style={[styles.cityName, city === c && styles.cityNameSelected]}>{c}</Text>
                  {city === c && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setCityPickerOpen(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.neutral[0] },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary[600],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  heading: { fontSize: 24, fontWeight: '700', color: colors.neutral[900], textAlign: 'center' },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stepDot: { width: 32, height: 6, borderRadius: 3, backgroundColor: colors.neutral[200] },
  stepDotActive: { backgroundColor: colors.primary[600] },
  stepLabel: { fontSize: 13, color: colors.neutral[500], textAlign: 'center' },
  form: { gap: spacing.md, marginTop: spacing.sm },
  fieldWrapper: { gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: colors.neutral[700] },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.neutral[0],
  },
  pickerError: { borderColor: colors.error[500] },
  pickerValue: { flex: 1, fontSize: 15, color: colors.neutral[900] },
  pickerPlaceholder: { flex: 1, fontSize: 15, color: colors.neutral[400] },
  pickerChevron: { fontSize: 22, color: colors.neutral[400], transform: [{ rotate: '90deg' }] },
  error: { fontSize: 13, color: colors.error[600] },
  loginRow: { alignItems: 'center', marginTop: spacing.sm },
  loginText: { fontSize: 14, color: colors.neutral[500] },
  loginLink: { color: colors.primary[600], fontWeight: '600' },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.neutral[900],
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  cityRowSelected: { backgroundColor: colors.primary[50] },
  cityName: { flex: 1, fontSize: 16, color: colors.neutral[900] },
  cityNameSelected: { color: colors.primary[700], fontWeight: '600' },
  checkmark: { color: colors.primary[600], fontWeight: '700', fontSize: 16 },
  modalCancel: { marginTop: spacing.sm, paddingVertical: spacing.md, alignItems: 'center' },
  modalCancelText: { fontSize: 16, color: colors.error[600], fontWeight: '600' },
})
