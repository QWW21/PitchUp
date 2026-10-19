/**
 * When the venue is busy — E14-08. Days across (Monday first, as in
 * Romania), hours down; each cell is the share of open time that was booked.
 * Hours the pitches were never open are hatched, not white, so "closed" and
 * "empty" read differently. Every cell carries its figure for screen readers.
 */
import { DAY_SHORT } from '@pitchup/shared'

const ORDER = [1, 2, 3, 4, 5, 6, 0]
const SCALE = [
  { below: 1, color: '#FFFFFF', label: '0%' },
  { below: 25, color: '#DCFCE7', label: '1–24%' },
  { below: 50, color: '#86EFAC', label: '25–49%' },
  { below: 75, color: '#4ADE80', label: '50–74%' },
  { below: 90, color: '#22C55E', label: '75–89%' },
  { below: Infinity, color: '#15803D', label: '90–100%' },
]
const colorOf = (pct: number) => SCALE.find(s => pct < s.below)!.color

export function OccupancyHeatmap({ grid }: { grid: (number | null)[][] }) {
  // The hours anyone was open, or 07–23 when nothing is known yet.
  const open = Array.from({ length: 24 }, (_, h) => h).filter(h =>
    grid.some(day => day[h] !== null && day[h] !== undefined)
  )
  const hours = open.length
    ? Array.from({ length: open.at(-1)! - open[0]! + 1 }, (_, i) => open[0]! + i)
    : Array.from({ length: 17 }, (_, i) => i + 7)
  const label = (h: number) => `${String(h).padStart(2, '0')}:00`

  return (
    <section aria-labelledby="occupancy-heading" className="rounded-xl bg-white p-4 shadow-sm">
      <h2 id="occupancy-heading" className="text-base font-semibold text-neutral-900">
        Occupancy by time
      </h2>
      <p className="text-xs text-neutral-700">Share of open time booked, by day and hour</p>
      <div className="mt-3 overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-xs">
          <thead>
            <tr>
              <th scope="col" className="w-12">
                <span className="sr-only">Hour</span>
              </th>
              {ORDER.map(d => (
                <th
                  key={d}
                  scope="col"
                  className="w-10 pb-1 text-center font-medium text-neutral-700"
                >
                  {DAY_SHORT[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map(h => (
              <tr key={h}>
                <th scope="row" className="pr-2 text-right font-normal text-neutral-700">
                  {label(h)}
                </th>
                {ORDER.map(d => {
                  const pct = grid[d]?.[h] ?? null
                  const text =
                    pct === null
                      ? `${DAY_SHORT[d]} ${label(h)}: closed`
                      : `${DAY_SHORT[d]} ${label(h)}: ${pct}% booked`
                  return (
                    <td
                      key={d}
                      title={text}
                      className="h-6 w-10 rounded-sm border border-neutral-200"
                      style={
                        pct === null
                          ? {
                              backgroundImage:
                                'repeating-linear-gradient(45deg, #F3F4F6 0 3px, #FFFFFF 3px 6px)',
                            }
                          : { backgroundColor: colorOf(Math.min(100, pct)) }
                      }
                    >
                      <span className="sr-only">{text}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul
        className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-700"
        aria-label="Colour key"
      >
        {SCALE.map(s => (
          <li key={s.label} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-5 rounded-sm border border-neutral-200"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-5 rounded-sm border border-neutral-200"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, #F3F4F6 0 3px, #FFFFFF 3px 6px)',
            }}
          />
          Closed
        </li>
      </ul>
    </section>
  )
}
