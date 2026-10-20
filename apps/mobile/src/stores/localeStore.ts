/**
 * The app's language — Romanian unless the player chose English. Kept on the
 * phone (AsyncStorage) and, when signed in, on the account so emails and
 * pushes follow it. Every API call says it (x-locale), so server messages
 * come back in it too.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@pitchup/shared'

export const LOCALE_STORAGE_KEY = 'pitchup.locale'

interface LocaleState {
  locale: Locale
  /** Reads the saved choice; called once at start-up. */
  load: () => Promise<void>
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleState>(set => ({
  locale: DEFAULT_LOCALE,
  async load() {
    const saved = await AsyncStorage.getItem(LOCALE_STORAGE_KEY).catch(() => null)
    if (isLocale(saved)) set({ locale: saved })
  },
  setLocale(locale) {
    set({ locale })
    void AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale).catch(() => undefined)
  },
}))
