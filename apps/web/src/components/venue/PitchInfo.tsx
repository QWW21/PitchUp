'use client'

/**
 * Amenities and pricing for the pitch page — E04-08, UIUX_SPEC §6.2.
 */
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
  ALL_AMENITIES,
  formatShirtColours,
  type AmenityType,
  type PitchDetail,
  formatShortDuration,
} from '@pitchup/shared'
import { useLocale, useT } from '@/i18n/client'

const AMENITY_ICONS: Record<AmenityType, LucideIcon> = {
  SHOWERS_FREE: ShowerHead,
  SHOWERS_PAID: ShowerHead,
  CHANGING_ROOMS: Shirt,
  PARKING_FREE: SquareParking,
  PARKING_PAID: SquareParking,
  NIGHT_LIGHTING: Lightbulb,
  BALL_RENTAL_FREE: Volleyball,
  BALL_RENTAL_PAID: Volleyball,
  REFRESHMENTS: Coffee,
  LOCKERS: Lock,
  REFEREE: Flag,
  FIRST_AID: BriefcaseMedical,
  WHEELCHAIR: Accessibility,
  WIFI: Wifi,
}

/** All fourteen, available ones highlighted, the rest struck through. */
export function AmenitiesGrid({ amenities }: { amenities: PitchDetail['amenities'] }) {
  const t = useT()
  const have = new Map(amenities.map(a => [a.amenityType, a]))
  return (
    <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      {ALL_AMENITIES.map(type => {
        const Icon = AMENITY_ICONS[type]
        const a = have.get(type)
        return (
          <li key={type} className="flex h-9 items-center gap-2 text-sm">
            <Icon
              className={`h-5 w-5 shrink-0 ${a ? 'text-primary-600' : 'text-neutral-300'}`}
              aria-hidden="true"
            />
            <span className={a ? 'text-neutral-900' : 'text-neutral-500 line-through'}>
              {t(`amenity.${type}`)}
              {a?.isPaid && a.price !== null && (
                <span className="text-neutral-500"> · {a.price} RON</span>
              )}
            </span>
            <span className="sr-only">
              {a ? t('venue.amenity.available') : t('venue.amenity.unavailable')}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** One hourly rate at any time of day; shirts are free. */
export function PricingCard({ pitch }: { pitch: PitchDetail }) {
  const t = useT()
  const locale = useLocale()
  const colours = formatShirtColours(pitch.shirtInventory, locale)
  return (
    <div className="rounded-lg bg-neutral-50 p-3">
      <dl>
        <div className="flex items-center justify-between gap-4 py-2">
          <dt className="text-xs text-neutral-500">{t('venue.pricing.anyTime')}</dt>
          <dd className="font-mono text-xl font-bold text-neutral-900">
            {pitch.hourlyRate} RON
            <span className="font-sans text-sm font-normal text-neutral-500">
              {t('venue.pricing.perHour')}
            </span>
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-neutral-500">
        {t('venue.pricing.limits', {
          min: formatShortDuration(pitch.minBookingHours * 60),
          max: formatShortDuration(pitch.maxBookingHours * 60),
        })}
      </p>
      {pitch.hasShirts && (
        <p className="mt-2 flex items-start gap-2 border-t border-neutral-200 pt-2 text-xs text-neutral-700">
          <Shirt className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
          <span>
            <strong>{t('venue.pricing.freeShirts')}</strong>
            {colours && t('venue.pricing.shirtColours', { colours })}
            {t('venue.pricing.shirtsAsk')}
          </span>
        </p>
      )}
    </div>
  )
}
