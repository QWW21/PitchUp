/** The web's own text, Romanian. Must match ../en key for key. */
import type { CatalogShape } from '@pitchup/shared'
import type { webEn } from '../en'
import { analyticsRo } from './analytics'
import { apiRo } from './api'
import { emailRo } from './email'
import { notifyRo } from './notify'
import { commonRo } from './common'
import { venueRo } from './venue'
import { discoverRo } from './discover'
import { bookingRo } from './booking'
import { myBookingsRo } from './myBookings'
import { navRo } from './nav'
import { authRo } from './auth'
import { profileRo } from './profile'
import { managerRo } from './manager'
import { mBookingsRo } from './mBookings'
import { mVenueRo } from './mVenue'
import { editorRo } from './editor'
import { onboardingRo } from './onboarding'
import { adminRo } from './admin'

export const webRo: CatalogShape<typeof webEn> = {
  language: {
    label: 'Limba',
  },
  notify: notifyRo,
  email: emailRo,
  analytics: analyticsRo,
  api: apiRo,
  common: commonRo,
  venue: venueRo,
  discover: discoverRo,
  booking: bookingRo,
  myBookings: myBookingsRo,
  nav: navRo,
  auth: authRo,
  profile: profileRo,
  manager: managerRo,
  mBookings: mBookingsRo,
  mVenue: mVenueRo,
  editor: editorRo,
  onboarding: onboardingRo,
  admin: adminRo,
}
