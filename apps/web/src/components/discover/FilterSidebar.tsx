'use client'

import type { ReactNode } from 'react'
import {
  Accessibility,
  BriefcaseMedical,
  Coffee,
  Flag,
  Lightbulb,
  Lock,
  Shirt,
  ShowerHead,
  SquareParking,
  Volleyball,
  Wifi,
  type LucideIcon,
} from 'lucide-react'
import {
  AMENITY_FILTERS,
  DISCOVER,
  COMPANY_SORTS,
  FILTERABLE_SIZES,
  SIZE_LABELS,
  SORT_LABELS,
  SURFACE_LABELS,
  type CompanySort,
  type DiscoverFilters,
  type SurfaceType,
} from '@pitchup/shared'
import { SizeInfo } from '@/components/venue/bits'
import { PriceRange } from './PriceRange'

const AMENITY_ICONS: Record<string, LucideIcon> = {
  showers: ShowerHead,
  changing: Shirt,
  parking: SquareParking,
  lighting: Lightbulb,
  ball: Volleyball,
  refreshments: Coffee,
  lockers: Lock,
  referee: Flag,
  firstAid: BriefcaseMedical,
  wifi: Wifi,
  wheelchair: Accessibility,
}

const SURFACES = Object.keys(SURFACE_LABELS) as SurfaceType[]

interface FilterSidebarProps {
  filters: DiscoverFilters
  sort: CompanySort
  /** "Nearest" needs the user's position. */
  canSortByDistance: boolean
  onFiltersChange: (filters: DiscoverFilters) => void
  onSortChange: (sort: CompanySort) => void
  onReset: () => void
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}

/** Every Discover filter, as a desktop sidebar or inside the mobile-web drawer. E03-08. */
export function FilterSidebar({
  filters,
  sort,
  canSortByDistance,
  onFiltersChange,
  onSortChange,
  onReset,
}: FilterSidebarProps) {
  const set = (patch: Partial<DiscoverFilters>) => onFiltersChange({ ...filters, ...patch })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Filters</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-medium text-error-600 hover:underline"
        >
          Reset all filters
        </button>
      </div>

      <Section title="Sort by">
        <select
          aria-label="Sort by"
          value={sort}
          onChange={e => onSortChange(e.target.value as CompanySort)}
          className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        >
          {COMPANY_SORTS.map(s => (
            <option key={s} value={s} disabled={s === 'distance' && !canSortByDistance}>
              {SORT_LABELS[s]}
              {s === 'distance' && !canSortByDistance ? ' (share location)' : ''}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Surface type">
        {SURFACES.map(s => (
          <Checkbox
            key={s}
            label={SURFACE_LABELS[s]}
            checked={filters.surfaces.includes(s)}
            onChange={() => set({ surfaces: toggle(filters.surfaces, s) })}
          />
        ))}
      </Section>

      <Section title="Pitch size" aside={<SizeInfo fill />}>
        {FILTERABLE_SIZES.map(s => (
          <Checkbox
            key={s}
            label={SIZE_LABELS[s]}
            checked={filters.sizes.includes(s)}
            onChange={() => set({ sizes: toggle(filters.sizes, s) })}
          />
        ))}
      </Section>

      <Section title="Amenities">
        {AMENITY_FILTERS.map(a => {
          const Icon = AMENITY_ICONS[a.key]
          return (
            <Checkbox
              key={a.key}
              label={a.label}
              icon={Icon ? <Icon className="h-4 w-4 text-neutral-500" aria-hidden="true" /> : null}
              checked={filters.amenities.includes(a.key)}
              onChange={() => set({ amenities: toggle(filters.amenities, a.key) })}
            />
          )
        })}
      </Section>

      <Section title="Price per hour">
        <PriceRange
          min={filters.priceMin}
          max={filters.priceMax}
          onChange={(priceMin, priceMax) => set({ priceMin, priceMax })}
        />
      </Section>

      <Section title="Availability">
        <Switch
          label="Available now"
          checked={filters.availableNow}
          onChange={availableNow => set({ availableNow })}
        />
        <p className="text-xs text-neutral-500">
          Open, with a pitch free for the next {DISCOVER.AVAILABLE_NOW_WINDOW_HOURS} hours.
        </p>
      </Section>
    </div>
  )
}

function Section({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <fieldset className="border-t border-neutral-100 pt-5">
      <legend className="relative mb-3 flex w-full items-center gap-1.5 text-base font-semibold text-neutral-900">
        {title}
        {aside}
      </legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string
  checked: boolean
  onChange: () => void
  icon?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-neutral-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-neutral-300 accent-primary-600"
      />
      {icon}
      {label}
    </label>
  )
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1 text-sm text-neutral-900">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-neutral-300'}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </button>
    </label>
  )
}
