/** Amounts on the analytics dashboard (E14), in the page's language: "1.234,5 RON". */
import { formatNumber, formatRon, type Locale } from '@pitchup/shared'

export const ron = formatRon

/** "1,2k" on chart axes, where space is short. */
export const compact = (n: number, locale: Locale) =>
  n >= 1000 ? `${formatNumber(Math.round(n / 100) / 10, locale)}k` : formatNumber(n, locale)
