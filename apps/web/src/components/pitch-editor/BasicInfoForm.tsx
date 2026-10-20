'use client'

/**
 * Basic info tab — E10-07 (with C-3): name, surface, size (the recommended
 * players per team, not a limit), dimensions, description, and whether
 * players can see and book it.
 */
import {
  MIN_TRUST_OPTIONS,
  PITCH_DEFAULT_DIMENSIONS,
  PITCH_LIMITS,
  minTrustLabel,
  sharedEn,
  UpdatePitchBasicInfoSchema,
  type ManagerPitch,
  type PitchSize,
  type SurfaceType,
} from '@pitchup/shared'
import { send } from '@/lib/http'
import { SaveBar } from './SaveBar'
import { useEditorForm } from './useForm'
import { useLocale, useT } from '@/i18n/client'

const SURFACES = Object.keys(sharedEn.surface) as SurfaceType[]
const SIZES = [
  'FIVE_A_SIDE',
  'SIX_A_SIDE',
  'SEVEN_A_SIDE',
  'ELEVEN_A_SIDE',
  'CUSTOM',
] as PitchSize[]

export function BasicInfoForm({ pitch }: { pitch: ManagerPitch }) {
  const t = useT()
  const locale = useLocale()
  const f = useEditorForm({
    name: pitch.name,
    surfaceType: pitch.surfaceType,
    size: pitch.size,
    width: pitch.widthMeters ? String(pitch.widthMeters) : '',
    length: pitch.lengthMeters ? String(pitch.lengthMeters) : '',
    description: pitch.description ?? '',
    isActive: pitch.isActive,
    minTrustScore: pitch.minTrustScore,
  })
  const v = f.values
  const set = (patch: Partial<typeof v>) => f.setValues(prev => ({ ...prev, ...patch }))
  const custom = v.size === 'CUSTOM'
  const noPhotos = pitch.photos.length === 0

  const pickSize = (size: PitchSize) => {
    const dims = size === 'CUSTOM' ? null : PITCH_DEFAULT_DIMENSIONS[size]
    set({ size, ...(dims ? { width: String(dims.width), length: String(dims.length) } : {}) })
  }

  const save = async () => {
    const parsed = UpdatePitchBasicInfoSchema.safeParse({
      name: v.name,
      surfaceType: v.surfaceType,
      size: v.size,
      description: v.description,
      minTrustScore: v.minTrustScore,
      ...(v.width ? { widthMeters: Number(v.width) } : {}),
      ...(v.length ? { lengthMeters: Number(v.length) } : {}),
    })
    if (!parsed.success)
      return f.setError(t.text(parsed.error.issues[0]?.message ?? t('editor.basic.checkForm')))
    if (custom && (!v.width || !v.length)) {
      return f.setError(t('editor.basic.customNeedsSize'))
    }
    if (v.isActive && !pitch.isActive && noPhotos) {
      return f.setError(t('editor.basic.needPhoto'))
    }
    // The status has its own endpoint, with its own rules (a photo, a price).
    if (v.isActive !== pitch.isActive) {
      try {
        await send(`/api/v1/pitches/${pitch.id}/status`, 'PATCH', { isActive: v.isActive })
      } catch (caught) {
        return f.setError((caught as Error).message)
      }
    }
    await f.save(`/api/v1/pitches/${pitch.id}`, 'PUT', parsed.data)
  }

  return (
    <div className="mt-4 space-y-6 rounded-xl bg-white p-5 shadow-sm">
      <div>
        <label htmlFor="pitch-name" className="block text-sm font-medium text-neutral-900">
          {t('editor.basic.name')}
        </label>
        <input
          id="pitch-name"
          value={v.name}
          maxLength={PITCH_LIMITS.NAME_MAX}
          onChange={e => set({ name: e.target.value })}
          className="mt-1 h-11 w-full rounded-md border border-neutral-200 px-3 text-base"
        />
        <p className="mt-1 text-right text-xs text-neutral-500">
          {v.name.length} / {PITCH_LIMITS.NAME_MAX}
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-neutral-900">
          {t('editor.basic.surface')}
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SURFACES.map(s => (
            <Choice
              key={s}
              name="surface"
              checked={v.surfaceType === s}
              onChange={() => set({ surfaceType: s })}
            >
              {t(`surface.${s}`)}
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-neutral-900">{t('editor.basic.size')}</legend>
        <p className="text-xs text-neutral-500">{t('size.info')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SIZES.map(s => (
            <Choice key={s} name="size" checked={v.size === s} onChange={() => pickSize(s)}>
              {t(`size.${s}`)}
            </Choice>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        {(
          [
            ['width', t('editor.basic.width')],
            ['length', t('editor.basic.length')],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <label htmlFor={`pitch-${key}`} className="block text-sm font-medium text-neutral-900">
              {label}
            </label>
            <input
              id={`pitch-${key}`}
              type="number"
              inputMode="decimal"
              min={1}
              max={200}
              value={v[key]}
              readOnly={!custom}
              onChange={e => set({ [key]: e.target.value })}
              className={`mt-1 h-11 w-full rounded-md border border-neutral-200 px-3 text-base ${custom ? '' : 'bg-neutral-100 text-neutral-700'}`}
            />
          </div>
        ))}
        {!custom && (
          <p className="col-span-2 -mt-2 text-xs text-neutral-500">
            {t('editor.basic.usual', { size: t(`size.${v.size}`) })}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="pitch-description" className="block text-sm font-medium text-neutral-900">
          {t('editor.basic.description')}{' '}
          <span className="font-normal text-neutral-500">{t('editor.basic.optional')}</span>
        </label>
        <textarea
          id="pitch-description"
          rows={4}
          value={v.description}
          maxLength={PITCH_LIMITS.DESCRIPTION_MAX}
          onChange={e => set({ description: e.target.value })}
          className="mt-1 w-full rounded-md border border-neutral-200 p-3 text-base"
        />
        <p className="mt-1 text-right text-xs text-neutral-500">
          {v.description.length} / {PITCH_LIMITS.DESCRIPTION_MAX}
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-neutral-900">
          {t('editor.basic.whoCanBook')}
        </legend>
        <p className="text-xs text-neutral-500">{t('editor.basic.whoHint')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MIN_TRUST_OPTIONS.map(o => (
            <Choice
              key={o.score}
              name="min-trust"
              checked={v.minTrustScore === o.score}
              onChange={() => set({ minTrustScore: o.score })}
            >
              {minTrustLabel(o.score, locale)}
            </Choice>
          ))}
        </div>
        {v.minTrustScore >= 90 && (
          <p className="mt-2 text-sm text-amber-800">{t('editor.basic.fewQualify')}</p>
        )}
      </fieldset>

      <div className="flex items-start justify-between gap-4 rounded-lg bg-neutral-50 p-4">
        <div>
          <p id="active-label" className="text-sm font-medium text-neutral-900">
            {t('editor.basic.active')}
          </p>
          <p className="text-sm text-neutral-500">{t('editor.basic.activeHint')}</p>
          {v.isActive && !pitch.isActive && noPhotos && (
            <p className="mt-1 text-sm font-medium text-error-600">
              {t('editor.basic.needPhotoDot')}
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={v.isActive}
          aria-labelledby="active-label"
          onClick={() => set({ isActive: !v.isActive })}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${v.isActive ? 'bg-primary-600' : 'bg-neutral-300'}`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${v.isActive ? 'translate-x-5' : ''}`}
          />
        </button>
      </div>

      <SaveBar
        label={t('editor.basic.save')}
        dirty={f.dirty}
        busy={f.busy}
        saved={f.saved}
        error={f.error}
        onSave={() => void save()}
        onReset={f.reset}
      />
    </div>
  )
}

/** A radio that looks like a chip. */
export function Choice({
  name,
  checked,
  onChange,
  children,
}: {
  name: string
  checked: boolean
  onChange: () => void
  children: React.ReactNode
}) {
  return (
    <label
      className={`flex h-10 cursor-pointer items-center rounded-md border px-4 text-sm font-medium focus-within:ring-2 focus-within:ring-primary-600 ${
        checked
          ? 'border-primary-600 bg-primary-50 text-primary-700'
          : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      <input type="radio" name={name} className="sr-only" checked={checked} onChange={onChange} />
      {children}
    </label>
  )
}
