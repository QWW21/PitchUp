'use client'

/**
 * Onboarding step 1 — E09-06. Name and description with counters, the logo,
 * and optional website and social links. Checked with the API's own schema;
 * creates the company the first time, updates it after.
 *
 * In Settings (`inSettings`, C-13) the same form proposes a change to an
 * approved venue, which an admin approves before it shows.
 */
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { ImageUp, X } from 'lucide-react'
import { CompanyInfoSchema } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { TextField } from '@/components/ui/TextField'
import { send } from '@/lib/http'
import { uploadToCloudinary } from '@/lib/upload-client'
import { useT } from '@/i18n/client'

interface Values {
  name: string
  description: string
  logoUrl: string | null
  websiteUrl: string
  facebookUrl: string
  instagramUrl: string
}
type Field = keyof Values

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const MIN_LOGO_SIDE = 200

/** Width and height of an image file, read in the browser before uploading. */
function imageSize(file: File, unreadable: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      reject(new Error(unreadable))
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

export function CompanyInfoForm({
  ownerId,
  existing,
  uploadsEnabled,
  inSettings = false,
}: {
  ownerId: string
  existing: Values | null
  uploadsEnabled: boolean
  inSettings?: boolean
}) {
  const t = useT()
  const router = useRouter()
  const [v, setV] = useState<Values>(
    existing ?? {
      name: '',
      description: '',
      logoUrl: null,
      websiteUrl: '',
      facebookUrl: '',
      instagramUrl: '',
    }
  )
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const set = (field: Field) => (e: { target: { value: string } }) =>
    setV(prev => ({ ...prev, [field]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = CompanyInfoSchema.safeParse(v)
    if (!parsed.success) {
      const found: Partial<Record<Field, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field | undefined
        if (key && !found[key]) found[key] = t.text(issue.message)
      }
      setErrors(found)
      return
    }
    setErrors({})
    setBusy(true)
    try {
      if (inSettings) {
        await send('/api/v1/manager/venue/info', 'PUT', parsed.data)
        setSent(true)
        setBusy(false)
        router.refresh()
        return
      }
      await send('/api/v1/onboarding/company', existing ? 'PUT' : 'POST', parsed.data)
      router.push('/onboarding/step/2')
    } catch (caught) {
      setError((caught as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 space-y-6">
      <div>
        <TextField
          label={t('onboarding.step1.name')}
          value={v.name}
          onChange={set('name')}
          maxLength={80}
          error={errors.name}
          autoComplete="organization"
        />
        <p className="mt-1 text-right text-xs text-neutral-500">{v.name.length} / 80</p>
      </div>
      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-neutral-900">
          {t('onboarding.step1.description')}{' '}
          <span className="font-normal text-neutral-500">{t('onboarding.optional')}</span>
        </label>
        <textarea
          id="description"
          value={v.description}
          onChange={set('description')}
          maxLength={500}
          rows={4}
          className="min-h-[100px] w-full rounded-md border border-neutral-200 p-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-600"
        />
        <p className="mt-1 text-right text-xs text-neutral-500">{v.description.length} / 500</p>
      </div>

      <LogoUploadZone
        url={v.logoUrl}
        ownerId={ownerId}
        enabled={uploadsEnabled}
        onChange={logoUrl => setV(prev => ({ ...prev, logoUrl }))}
      />

      <TextField
        label={t('onboarding.step1.website')}
        type="url"
        value={v.websiteUrl}
        onChange={set('websiteUrl')}
        placeholder="https://yourclub.ro"
        error={errors.websiteUrl}
      />
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-neutral-900">
          {t('onboarding.step1.social')}
        </legend>
        <TextField
          label="Facebook"
          type="url"
          value={v.facebookUrl}
          onChange={set('facebookUrl')}
          placeholder="https://facebook.com/yourclub"
          error={errors.facebookUrl}
        />
        <TextField
          label="Instagram"
          type="url"
          value={v.instagramUrl}
          onChange={set('instagramUrl')}
          placeholder="https://instagram.com/yourclub"
          error={errors.instagramUrl}
        />
      </fieldset>

      {error && <Alert>{error}</Alert>}
      {sent && (
        <p role="status" className="rounded-md bg-primary-50 p-3 text-sm text-primary-700">
          {t('onboarding.sentForApproval')}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-12 w-full rounded-md bg-primary-600 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {busy
          ? t('onboarding.saving')
          : inSettings
            ? t('onboarding.sendForApproval')
            : t('onboarding.step1.next')}
      </button>
    </form>
  )
}

/** Drop a logo or click to pick one; checked for type, size and dimensions first. */
function LogoUploadZone({
  url,
  ownerId,
  enabled,
  onChange,
}: {
  url: string | null
  ownerId: string
  enabled: boolean
  onChange: (url: string | null) => void
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const take = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!['image/jpeg', 'image/png'].includes(file.type))
      return setError(t('onboarding.step1.logoType'))
    if (file.size > MAX_LOGO_BYTES) return setError(t('onboarding.step1.logoLarge'))
    try {
      const { width, height } = await imageSize(file, t('onboarding.step1.unreadable'))
      if (width < MIN_LOGO_SIDE || height < MIN_LOGO_SIDE) {
        return setError(t('onboarding.step1.logoSmall', { n: MIN_LOGO_SIDE }))
      }
    } catch (caught) {
      return setError((caught as Error).message)
    }
    setBusy(true)
    try {
      onChange(await uploadToCloudinary('COMPANY', ownerId, file))
    } catch {
      setError(t('onboarding.step1.uploadFailed'))
    }
    setBusy(false)
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-neutral-900">
        {t('onboarding.step1.logo')}{' '}
        <span className="font-normal text-neutral-500">{t('onboarding.optional')}</span>
      </p>
      {!enabled ? (
        <p className="rounded-md bg-neutral-100 p-3 text-sm text-neutral-700">
          {t('onboarding.step1.noUploads')}
        </p>
      ) : url ? (
        <div className="relative h-40 w-40">
          <img
            src={url}
            alt={t('onboarding.step1.yourLogo')}
            className="h-40 w-40 rounded-md border border-neutral-200 object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t('onboarding.step1.removeLogo')}
            className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow-md hover:bg-neutral-100"
          >
            <X className="h-4 w-4 text-neutral-700" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={e => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setDragging(false)
            void take(e.dataTransfer.files[0])
          }}
          className={`flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-3 text-center text-sm text-neutral-500 ${
            dragging ? 'border-primary-600 bg-primary-50' : 'border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <ImageUp className="h-8 w-8 text-neutral-400" aria-hidden="true" />
          {busy ? t('onboarding.step1.uploading') : t('onboarding.step1.drop')}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => void take(e.target.files?.[0])}
      />
      <p className="mt-1 text-xs text-neutral-500">{t('onboarding.step1.rules')}</p>
      {error && (
        <p role="alert" className="mt-1 text-sm text-error-600">
          {error}
        </p>
      )}
    </div>
  )
}
