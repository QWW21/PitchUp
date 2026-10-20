/** The app's own text, Romanian. Must match ../en key for key. */
import type { CatalogShape } from '@pitchup/shared'
import type { mobileEn } from '../en'
import { authRo } from './auth'
import { discoverRo } from './discover'
import { bookingRo } from './booking'
import { bookingsRo } from './bookings'
import { profileRo } from './profile'
import { managerRo } from './manager'

export const mobileRo: CatalogShape<typeof mobileEn> = {
  language: {
    label: 'Limba',
  },
  network: 'PitchUp nu a putut fi contactat. Verifică-ți conexiunea și încearcă din nou.',
  auth: authRo,
  discover: discoverRo,
  booking: bookingRo,
  bookings: bookingsRo,
  profile: profileRo,
  manager: managerRo,
}
