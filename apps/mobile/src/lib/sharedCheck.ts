/**
 * Proves @pitchup/shared resolves under Metro, which bundles differently
 * from Next and cannot load Node-only modules.
 */
import { AUTH, CITIES, RegisterPlayerSchema, TRUST_SCORE_DELTAS } from '@pitchup/shared'

export function sharedPackageSummary() {
  return {
    cities: CITIES.length,
    bcryptCost: AUTH.BCRYPT_COST,
    noShowDelta: TRUST_SCORE_DELTAS.NO_SHOW,
    schemaWorks: RegisterPlayerSchema.safeParse({
      name: 'Ion Popescu',
      email: 'ion@example.ro',
      phone: '+40712345678',
      password: 'Parola123',
      city: 'Cluj-Napoca',
      dateOfBirth: '1990-01-01',
    }).success,
  }
}
