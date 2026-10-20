/**
 * The app's own text, English — the source the Romanian files must match.
 * One file per area; merged with the shared catalog in ../index.
 */
import { authEn } from './auth'
import { discoverEn } from './discover'
import { bookingEn } from './booking'
import { bookingsEn } from './bookings'
import { profileEn } from './profile'
import { managerEn } from './manager'

export const mobileEn = {
  language: {
    label: 'Language',
  },
  network: 'Could not reach PitchUp. Check your connection and try again.',
  auth: authEn,
  discover: discoverEn,
  booking: bookingEn,
  bookings: bookingsEn,
  profile: profileEn,
  manager: managerEn,
} as const
