'use client'

/**
 * Step 3: teams and shirts — E05-10 (UIUX_SPEC §7.3, with C-1). Two or three
 * teams, players per team (starting from what the pitch size suggests), free
 * shirts as one yes/no, and a note for the venue. Everything here is
 * optional, so Next is always enabled.
 */
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'
import {
  BOOKING,
  SHIRT_COLOUR_HEX,
  SHIRT_COLOURS_NEEDING_BORDER,
  bookingPrice,
  formatDuration,
  shirtSetsFor,
  type ShirtColour,
} from '@pitchup/shared'
import { Button } from '@/components/ui/Button'
import { stepPath, useBooking } from './draft'

const TEAM_NAMES = ['Team A', 'Team B', 'Team C']

export function TeamsStep() {
  const { pitch, draft, ready, update } = useBooking()
  const router = useRouter()

  useEffect(() => {
    if (ready && !draft.startTime) router.replace(stepPath(pitch.id, draft.date ? 'time' : 'date'))
  }, [ready, draft.startTime, draft.date, pitch.id, router])
  if (!draft.startTime || !draft.minutes) return null

  const teams = draft.teamCount
  const sets = shirtSetsFor(teams, draft.wantsShirts)
  const stock = pitch.shirtStock.filter(s => s.quantity > 0)
  const totalSets = stock.reduce((n, s) => n + s.quantity, 0)
  const enoughShirts = totalSets >= shirtSetsFor(teams, true)
  const price = bookingPrice(pitch.hourlyRate, draft.minutes)

  const setPlayers = (team: number, value: number) => {
    const players = [...draft.players]
    players[team] = Math.min(BOOKING.MAX_PLAYERS_PER_TEAM, Math.max(1, value))
    update({ players })
  }
  const setColour = (team: number, colour: ShirtColour) => {
    const colours = [...draft.colours]
    colours[team] = colours[team] === colour ? '' : colour
    update({ colours })
  }

  const next = () => {
    update({ teamsDone: true })
    router.push(stepPath(pitch.id, 'summary'))
  }

  return (
    <section aria-labelledby="teams-heading" className="space-y-6">
      <h1 id="teams-heading" className="text-xl font-semibold text-neutral-900">
        Teams and shirts
      </h1>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-700">How many teams?</legend>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-neutral-100 p-1" role="radiogroup">
          {([2, 3] as const).map(n => (
            <label
              key={n}
              className={`flex h-10 cursor-pointer items-center justify-center rounded text-sm font-medium focus-within:ring-2 focus-within:ring-primary-600 ${
                teams === n ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-700'
              }`}
            >
              <input
                type="radio"
                name="teams"
                className="sr-only"
                checked={teams === n}
                // A team that no longer exists has no shirts to borrow.
                onChange={() =>
                  update({
                    teamCount: n,
                    colours: n === 2 ? [...draft.colours.slice(0, 2), ''] : draft.colours,
                  })
                }
              />
              {n} teams
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-700">
          Players per team <span className="font-normal text-neutral-500">(optional)</span>
        </legend>
        <ul className="divide-y divide-neutral-100 rounded-xl bg-white shadow-sm">
          {TEAM_NAMES.slice(0, teams).map((name, t) => (
            <li key={name} className="flex items-center justify-between px-4 py-2">
              <span className="text-sm text-neutral-900">{name}</span>
              <span className="flex items-center">
                <button
                  type="button"
                  aria-label={`Fewer players in ${name}`}
                  disabled={draft.players[t]! <= 1}
                  onClick={() => setPlayers(t, draft.players[t]! - 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:text-neutral-300"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <output className="w-10 text-center text-base text-neutral-900" aria-live="polite">
                  {draft.players[t]}
                </output>
                <button
                  type="button"
                  aria-label={`More players in ${name}`}
                  disabled={draft.players[t]! >= BOOKING.MAX_PLAYERS_PER_TEAM}
                  onClick={() => setPlayers(t, draft.players[t]! + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:text-neutral-300"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </fieldset>

      {pitch.hasShirts && (
        <section aria-labelledby="shirts-heading" className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="shirts-heading" className="text-sm font-medium text-neutral-900">
                Free shirts
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                One set for every team but one: {teams} teams get {shirtSetsFor(teams, true)}{' '}
                {shirtSetsFor(teams, true) === 1 ? 'set' : 'sets'}.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.wantsShirts}
              aria-labelledby="shirts-heading"
              disabled={!enoughShirts}
              onClick={() => update({ wantsShirts: !draft.wantsShirts })}
              className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${draft.wantsShirts ? 'bg-primary-600' : 'bg-neutral-300'}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${draft.wantsShirts ? 'translate-x-5' : ''}`}
              />
            </button>
          </div>
          {!enoughShirts && (
            <p className="mt-2 text-sm text-neutral-700">
              This pitch has {totalSets} {totalSets === 1 ? 'set' : 'sets'}, not enough for {teams}{' '}
              teams.
            </p>
          )}
          {draft.wantsShirts && (
            <div className="mt-4 space-y-3">
              {TEAM_NAMES.slice(0, sets).map((name, t) => (
                <fieldset key={name}>
                  <legend className="mb-1 text-xs font-medium text-neutral-700">
                    {name} colour <span className="font-normal text-neutral-500">(optional)</span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {stock.map(({ colour }) => (
                      <label
                        key={colour}
                        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full ring-offset-2 focus-within:ring-2 focus-within:ring-primary-600 ${
                          draft.colours[t] === colour ? 'ring-[3px] ring-neutral-900' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name={`colour-${t}`}
                          className="sr-only"
                          checked={draft.colours[t] === colour}
                          onChange={() => setColour(t, colour)}
                          onClick={() => draft.colours[t] === colour && setColour(t, colour)}
                        />
                        <span className="sr-only">{colour.toLowerCase()}</span>
                        <span
                          aria-hidden="true"
                          className={`h-8 w-8 rounded-full ${SHIRT_COLOURS_NEEDING_BORDER.includes(colour) ? 'border border-neutral-200' : ''}`}
                          style={{ background: SHIRT_COLOUR_HEX[colour] }}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <p className="text-xs text-neutral-500">
                {TEAM_NAMES[teams - 1]} plays in its own kit.
              </p>
            </div>
          )}
        </section>
      )}

      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-medium text-neutral-700">
          Note to the venue <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <textarea
          id="note"
          rows={3}
          maxLength={BOOKING.MAX_NOTE_LENGTH}
          value={draft.note}
          onChange={e => update({ note: e.target.value })}
          className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-600"
        />
        <p className="text-right text-xs text-neutral-500">
          {draft.note.length} / {BOOKING.MAX_NOTE_LENGTH}
        </p>
      </div>

      <div className="rounded-lg bg-white p-3 text-sm text-neutral-700 shadow-sm">
        <div className="flex justify-between">
          <span>
            Pitch ({formatDuration(draft.minutes)} × {pitch.hourlyRate} RON/h)
          </span>
          <span>{price.total} RON</span>
        </div>
        {draft.wantsShirts && (
          <div className="flex justify-between">
            <span>
              Shirts ({sets} {sets === 1 ? 'set' : 'sets'})
            </span>
            <span>Free</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 font-semibold text-neutral-900">
          <span>Total</span>
          <span>{price.total} RON</span>
        </div>
      </div>

      <Button size="lg" onClick={next}>
        Next
      </Button>
    </section>
  )
}
