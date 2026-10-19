import { COMPANY_STATUS_LABELS, type CompanyStatusName } from '@pitchup/shared'

const STYLES: Record<CompanyStatusName, string> = {
  DRAFT: 'bg-neutral-100 text-neutral-700',
  PENDING: 'bg-warning-50 text-amber-800',
  ACTIVE: 'bg-success-50 text-primary-700',
  SUSPENDED: 'bg-error-50 text-error-600',
}

/** A venue's status as a pill — E15-06. */
export function CompanyStatusBadge({ status }: { status: CompanyStatusName }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {COMPANY_STATUS_LABELS[status]}
    </span>
  )
}
