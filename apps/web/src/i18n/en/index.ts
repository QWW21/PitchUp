/**
 * The web's own text, English — the source the Romanian files must match.
 * One file per area; merged with the shared catalog in ../catalog.
 */
import { analyticsEn } from './analytics'
import { apiEn } from './api'
import { emailEn } from './email'
import { notifyEn } from './notify'
import { commonEn } from './common'
import { venueEn } from './venue'
import { discoverEn } from './discover'
import { bookingEn } from './booking'
import { myBookingsEn } from './myBookings'
import { navEn } from './nav'
import { authEn } from './auth'
import { profileEn } from './profile'
import { managerEn } from './manager'
import { mBookingsEn } from './mBookings'
import { mVenueEn } from './mVenue'
import { editorEn } from './editor'
import { onboardingEn } from './onboarding'
import { adminEn } from './admin'

export const webEn = {
  language: {
    label: 'Language',
  },
  notify: notifyEn,
  email: emailEn,
  analytics: analyticsEn,
  api: apiEn,
  common: commonEn,
  venue: venueEn,
  discover: discoverEn,
  booking: bookingEn,
  myBookings: myBookingsEn,
  nav: navEn,
  auth: authEn,
  profile: profileEn,
  manager: managerEn,
  mBookings: mBookingsEn,
  mVenue: mVenueEn,
  editor: editorEn,
  onboarding: onboardingEn,
  admin: adminEn,
} as const
