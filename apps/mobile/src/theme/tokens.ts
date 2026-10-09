/**
 * Design tokens from UIUX_SPEC §2.1.
 *
 * Mirrors apps/web/tailwind.config.ts. React Native has no Tailwind, so the
 * values are repeated here — the two must be kept in step by hand.
 */
export const colors = {
  primary: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    900: '#14532D',
  },
  accent: { 400: '#FB923C', 500: '#F97316', 600: '#EA580C' },
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    700: '#374151',
    900: '#111827',
  },
  error: { 50: '#FEF2F2', 500: '#EF4444', 600: '#DC2626' },
  warning: { 50: '#FFFBEB', 500: '#F59E0B' },
  success: { 50: '#F0FDF4', 500: '#22C55E' },
  info: { 50: '#EFF6FF', 500: '#3B82F6' },
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  full: 9999,
} as const
