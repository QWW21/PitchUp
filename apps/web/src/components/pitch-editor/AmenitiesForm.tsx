'use client'

/** Amenities tab — E10-07: fourteen checkboxes; saving replaces the whole set. */
import { ALL_AMENITIES, AMENITY_LABELS, type AmenityType } from '@pitchup/shared'
import { SaveBar } from './SaveBar'
import { useEditorForm } from './useForm'

export function AmenitiesForm({
  pitchId,
  amenities,
}: {
  pitchId: string
  amenities: AmenityType[]
}) {
  const f = useEditorForm([...amenities].sort())
  const toggle = (a: AmenityType) =>
    f.setValues(list => (list.includes(a) ? list.filter(x => x !== a) : [...list, a].sort()))

  return (
    <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
      <fieldset>
        <legend className="text-sm text-neutral-700">What players get at this pitch</legend>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {ALL_AMENITIES.map(a => (
            <label key={a} className="flex h-10 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={f.values.includes(a)}
                onChange={() => toggle(a)}
                className="h-4 w-4 accent-primary-600"
              />
              {AMENITY_LABELS[a]}
            </label>
          ))}
        </div>
      </fieldset>
      <SaveBar
        label="Save amenities"
        dirty={f.dirty}
        busy={f.busy}
        saved={f.saved}
        error={f.error}
        onSave={() =>
          void f.save(`/api/v1/pitches/${pitchId}/amenities`, 'PUT', { amenities: f.values })
        }
        onReset={f.reset}
      />
    </div>
  )
}
