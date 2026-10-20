/** Words many screens share, Romanian. */
import type { CatalogShape } from '@pitchup/shared'
import type { commonEn } from '../en/common'

export const commonRo: CatalogShape<typeof commonEn> = {
  cancel: 'Anulează',
  close: 'Închide',
  retry: 'Reîncearcă',
  back: 'Înapoi',
  save: 'Salvează',
  saving: 'Se salvează…',
  loading: 'Se încarcă…',
  requestFailed: 'Cererea nu a reușit',
  connectionError: 'Nu ne-am putut conecta. Verifică-ți conexiunea și încearcă din nou.',
  metaDescription: 'Rezervă un teren de fotbal lângă tine',
}
