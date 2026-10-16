'use client'

/**
 * Shirts tab — E10-09 with C-1: lend shirts or not, and how many sets of
 * each colour (a set dresses one team). Always free. If upcoming bookings
 * were promised more sets than this, the save asks first.
 */
import {
  PITCH_LIMITS,
  SHIRT_COLOURS,
  SHIRT_COLOUR_HEX,
  SHIRT_COLOURS_NEEDING_BORDER,
  type ShirtColour,
} from '@pitchup/shared'
import { SaveBar } from './SaveBar'
import { useEditorForm } from './useForm'

const name = (c: string) => c.charAt(0) + c.slice(1).toLowerCase()

export function ShirtsForm({
  pitchId,
  hasShirts,
  inventory,
}: {
  pitchId: string
  hasShirts: boolean
  inventory: { colour: ShirtColour; quantity: number }[]
}) {
  const f = useEditorForm({
    hasShirts,
    sets: Object.fromEntries(
      SHIRT_COLOURS.map(c => [c, inventory.find(i => i.colour === c)?.quantity ?? 0])
    ) as Record<ShirtColour, number>,
  })
  const v = f.values
  const active = SHIRT_COLOURS.filter(c => v.sets[c] > 0)
  const promised = !!f.error && /promised/.test(f.error)

  const body = (force: boolean) => ({
    hasShirts: v.hasShirts,
    inventory: v.hasShirts
      ? SHIRT_COLOURS.filter(c => v.sets[c] > 0).map(colour => ({
          colour,
          quantity: v.sets[colour],
        }))
      : [],
    ...(force ? { force: true } : {}),
  })
  const save = (force = false) => {
    if (v.hasShirts && !active.length) {
      return f.setError('Add at least one set, or stop lending shirts')
    }
    void f.save(`/api/v1/pitches/${pitchId}/shirts`, 'PUT', body(force))
  }

  return (
    <div className="mt-4 space-y-5 rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="lend-label" className="text-sm font-medium text-neutral-900">
            Lend shirts
          </p>
          <p className="text-sm text-neutral-500">
            Free for players. Each booking gets a set for every team but one.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={v.hasShirts}
          aria-labelledby="lend-label"
          onClick={() => f.setValues(p => ({ ...p, hasShirts: !p.hasShirts }))}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${v.hasShirts ? 'bg-primary-600' : 'bg-neutral-300'}`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${v.hasShirts ? 'translate-x-5' : ''}`}
          />
        </button>
      </div>

      {v.hasShirts && (
        <>
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-medium uppercase text-neutral-500">
              <tr>
                <th scope="col" className="py-2">
                  Colour
                </th>
                <th scope="col" className="py-2">
                  Sets
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {SHIRT_COLOURS.map(c => (
                <tr key={c}>
                  <td className="py-2">
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`h-6 w-6 rounded-full ${SHIRT_COLOURS_NEEDING_BORDER.includes(c) ? 'border border-neutral-200' : ''}`}
                        style={{ background: SHIRT_COLOUR_HEX[c] }}
                      />
                      {name(c)}
                    </span>
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      min={0}
                      max={PITCH_LIMITS.MAX_SETS_PER_COLOUR}
                      aria-label={`${name(c)} sets`}
                      value={v.sets[c]}
                      onChange={e =>
                        f.setValues(p => ({
                          ...p,
                          sets: {
                            ...p.sets,
                            [c]: Math.min(
                              PITCH_LIMITS.MAX_SETS_PER_COLOUR,
                              Math.max(0, Math.floor(Number(e.target.value) || 0))
                            ),
                          },
                        }))
                      }
                      className="h-10 w-24 rounded-md border border-neutral-200 px-3"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-neutral-500">
            {active.length
              ? `Players can choose: ${active.map(c => `${name(c)} (${v.sets[c]})`).join(', ')}.`
              : 'Set at least one colour above 0. Colours at 0 are not offered.'}
          </p>
        </>
      )}

      <SaveBar
        label="Save shirts"
        dirty={f.dirty}
        busy={f.busy}
        saved={f.saved}
        error={f.error}
        onSave={() => save()}
        onReset={f.reset}
      />
      {promised && (
        <button
          type="button"
          onClick={() => save(true)}
          className="text-sm font-semibold text-error-600 underline"
        >
          Save anyway: I&rsquo;ll sort the shirts out with those players
        </button>
      )}
    </div>
  )
}
