/** The player's top bar and account menu, Romanian. */
import type { CatalogShape } from '@pitchup/shared'
import type { navEn } from '../en/nav'

export const navRo: CatalogShape<typeof navEn> = {
  account: 'Cont',
  signIn: 'Conectare',
  register: 'Înregistrare',
  menuFor: 'Meniul contului {name}',
  dashboard: 'Panou de control',
  profile: 'Profil',
  myBookings: 'Rezervările mele',
  myReviews: 'Recenziile mele',
  logout: 'Deconectare',
}
