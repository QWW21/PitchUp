import type { Metadata } from 'next'
import { DEFAULT_ONBOARDING_HOURS, normalizeWeek, type VenueProfileChanges } from '@pitchup/shared'
import { requireActiveManager } from '@/lib/manager/access'
import { venueChangesStatus } from '@/lib/manager/venue'
import { CompanyInfoForm } from '@/components/onboarding/CompanyInfoForm'
import { LocationForm } from '@/components/onboarding/LocationForm'
import { ContactHoursForm } from '@/components/onboarding/ContactHoursForm'
import { WithdrawChanges } from '@/components/manager/WithdrawChanges'

export const metadata: Metadata = { title: 'Venue details | PitchUp' }

const SECTION_NAMES = {
  info: 'name and description',
  location: 'address',
  contactHours: 'contact and opening hours',
} as const

const when = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Bucharest',
})

/**
 * The venue's details — C-13. The same forms as onboarding; a change waits
 * for an admin, and the forms show what was proposed until it is decided.
 */
export default async function VenueSettingsPage() {
  const { company: c } = await requireActiveManager()
  const status = venueChangesStatus(c)
  const p = (c.pendingChanges as VenueProfileChanges | null) ?? {}
  const info = p.info
  const location = p.location
  const contact = p.contactHours

  return (
    <>
      <p className="max-w-2xl text-sm text-neutral-700">
        This is what players see on your page. Changes are checked by PitchUp before they show;
        until then your page keeps its current details.
      </p>
      {status.pending.length > 0 && (
        <div
          role="status"
          className="max-w-2xl rounded-md bg-warning-50 p-4 text-sm text-amber-900"
        >
          <p className="font-medium">
            Waiting for approval: your new {status.pending.map(s => SECTION_NAMES[s]).join(', ')}
            {status.submittedAt && ` (sent ${when.format(new Date(status.submittedAt))})`}.
          </p>
          <p className="mt-1">The forms below show what you sent.</p>
          <WithdrawChanges />
        </div>
      )}
      {status.rejectionReason && status.pending.length === 0 && (
        <div role="alert" className="max-w-2xl rounded-md bg-error-50 p-4 text-sm text-error-700">
          <p className="font-medium">Your last changes were not approved.</p>
          <p className="mt-1">{status.rejectionReason}</p>
        </div>
      )}

      <section aria-labelledby="venue-info" className="max-w-2xl rounded-xl bg-white p-5 shadow-sm">
        <h2 id="venue-info" className="text-lg font-semibold text-neutral-900">
          Name and description
        </h2>
        <CompanyInfoForm
          ownerId={c.id}
          inSettings
          existing={{
            name: info?.name ?? c.name,
            description: (info ? info.description : c.description) ?? '',
            logoUrl: (info ? info.logoUrl : c.logoUrl) ?? null,
            websiteUrl: (info ? info.websiteUrl : c.websiteUrl) ?? '',
            facebookUrl: (info ? info.facebookUrl : c.facebookUrl) ?? '',
            instagramUrl: (info ? info.instagramUrl : c.instagramUrl) ?? '',
          }}
          uploadsEnabled={!!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}
        />
      </section>

      <section
        aria-labelledby="venue-location"
        className="max-w-2xl rounded-xl bg-white p-5 shadow-sm"
      >
        <h2 id="venue-location" className="text-lg font-semibold text-neutral-900">
          Address
        </h2>
        <LocationForm
          inSettings
          existing={{
            addressLine1: location?.addressLine1 ?? c.addressLine1 ?? '',
            addressLine2: (location ? location.addressLine2 : c.addressLine2) ?? '',
            city: location?.city ?? c.city ?? '',
            county: location?.county ?? c.county ?? '',
            postalCode: location?.postalCode ?? c.postalCode ?? '',
            lat: location ? location.lat : c.lat,
            lng: location ? location.lng : c.lng,
          }}
        />
      </section>

      <section
        aria-labelledby="venue-contact"
        className="max-w-2xl rounded-xl bg-white p-5 shadow-sm"
      >
        <h2 id="venue-contact" className="text-lg font-semibold text-neutral-900">
          Contact and opening hours
        </h2>
        <ContactHoursForm
          inSettings
          existing={{
            phone: contact?.phone ?? c.phone ?? '',
            email: contact?.email ?? c.email ?? '',
            hours: contact
              ? contact.workingHours
              : c.workingHours
                ? normalizeWeek(c.workingHours)
                : DEFAULT_ONBOARDING_HOURS,
          }}
        />
      </section>
    </>
  )
}
