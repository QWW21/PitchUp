import type { ShirtColour } from '../types'

/** Shirt colours offered at booking. UIUX_SPEC §7.3. */
export const SHIRT_COLOURS: readonly ShirtColour[] = [
  'RED',
  'BLUE',
  'GREEN',
  'YELLOW',
  'ORANGE',
  'WHITE',
  'BLACK',
  'PURPLE',
] as const

/** Swatch hex values for each colour. UIUX_SPEC §7.3. */
export const SHIRT_COLOUR_HEX: Record<ShirtColour, string> = {
  RED: '#EF4444',
  BLUE: '#3B82F6',
  GREEN: '#22C55E',
  YELLOW: '#FBBF24',
  ORANGE: '#F97316',
  WHITE: '#F9FAFB',
  BLACK: '#111827',
  PURPLE: '#A855F7',
}

/** WHITE needs a border to stay visible on a light background. UIUX_SPEC §7.3. */
export const SHIRT_COLOURS_NEEDING_BORDER: readonly ShirtColour[] = ['WHITE'] as const
