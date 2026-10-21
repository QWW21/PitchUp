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
import { useT } from '@/i18n/client'
import { draftRate, stepPath, useBooking } from './draft'

const TEAMS = [0, 1, 2] as const

export function TeamsStep() {
  const t = useT()
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
  const price = bookingPrice(draftRate(pitch, draft), draft.minutes)
  const teamName = (i: number) => t(`booking.teams.team.${i as 0 | 1 | 2}`)

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
        {pitch.hasShirts ? t('booking.teams.headingShirts') : t('booking.teams.heading')}
      </h1>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-700">
          {t('booking.teams.howMany')}
        </legend>
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
              {t('booking.teams.count', { count: n })}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-700">
          {t('booking.teams.playersPerTeam')}{' '}
          <span className="font-normal text-neutral-500">{t('booking.teams.optional')}</span>
        </legend>
        <ul className="divide-y divide-neutral-100 rounded-xl bg-white shadow-sm">
          {TEAMS.slice(0, teams).map(i => (
            <li key={i} className="flex items-center justify-between px-4 py-2">
              <span className="text-sm text-neutral-900">{teamName(i)}</span>
              <span className="flex items-center">
                <button
                  type="button"
                  aria-label={t('booking.teams.fewer', { team: teamName(i) })}
                  disabled={draft.players[i]! <= 1}
                  onClick={() => setPlayers(i, draft.players[i]! - 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:text-neutral-300"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <output className="w-10 text-center text-base text-neutral-900" aria-live="polite">
                  {draft.players[i]}
                </output>
                <button
                  type="button"
                  aria-label={t('booking.teams.more', { team: teamName(i) })}
                  disabled={draft.players[i]! >= BOOKING.MAX_PLAYERS_PER_TEAM}
                  onClick={() => setPlayers(i, draft.players[i]! + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:text-neutral-300"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </fieldset>

      {/* C-7: say so, rather than leave a gap that looks like a bug. */}
      {!pitch.hasShirts && (
        <p className="rounded-xl bg-white p-4 text-sm text-neutral-700 shadow-sm">
          {t('booking.teams.noShirts')}
        </p>
      )}
      {pitch.hasShirts && (
        <section aria-labelledby="shirts-heading" className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="shirts-heading" className="text-sm font-medium text-neutral-900">
                {t('booking.teams.freeShirts')}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                {t('booking.teams.oneSetEach', { teams, count: shirtSetsFor(teams, true) })}
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
              {t('booking.teams.notEnough', { count: totalSets, teams })}
            </p>
          )}
          {draft.wantsShirts && (
            <div className="mt-4 space-y-3">
              {TEAMS.slice(0, sets).map(i => (
                <fieldset key={i}>
                  <legend className="mb-1 text-xs font-medium text-neutral-700">
                    {t('booking.teams.colour', { team: teamName(i) })}{' '}
                    <span className="font-normal text-neutral-500">
                      {t('booking.teams.optional')}
                    </span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {stock.map(({ colour }) => (
                      <label
                        key={colour}
                        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full ring-offset-2 focus-within:ring-2 focus-within:ring-primary-600 ${
                          draft.colours[i] === colour ? 'ring-[3px] ring-neutral-900' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name={`colour-${i}`}
                          className="sr-only"
                          checked={draft.colours[i] === colour}
                          onChange={() => setColour(i, colour)}
                          onClick={() => draft.colours[i] === colour && setColour(i, colour)}
                        />
                        <span className="sr-only">{t(`shirt.${colour}`)}</span>
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
                {t('booking.teams.ownKit', { team: teamName(teams - 1) })}
              </p>
            </div>
          )}
        </section>
      )}

      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-medium text-neutral-700">
          {t('booking.teams.note')}{' '}
          <span className="font-normal text-neutral-500">{t('booking.teams.optional')}</span>
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
            {t('booking.teams.pitchLine', {
              duration: formatDuration(draft.minutes),
              rate: draftRate(pitch, draft),
            })}
          </span>
          <span>{price.total} RON</span>
        </div>
        {draft.wantsShirts && (
          <div className="flex justify-between">
            <span>{t('booking.teams.shirtsLine', { count: sets })}</span>
            <span>{t('booking.teams.free')}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 font-semibold text-neutral-900">
          <span>{t('booking.teams.total')}</span>
          <span>{price.total} RON</span>
        </div>
      </div>

      <Button size="lg" onClick={next}>
        {t('booking.date.next')}
      </Button>
    </section>
  )
}
