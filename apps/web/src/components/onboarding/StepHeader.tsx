import { AlertCircle } from 'lucide-react'
import type { OnboardingStatus } from '@pitchup/shared'
import { StepProgress } from './StepProgress'

/** Progress, the step's title, and the admin's reason when the venue was sent back. */
export function StepHeader({
  step,
  status,
  title,
  intro,
}: {
  step: 1 | 2 | 3 | 4
  status: OnboardingStatus
  title: string
  intro: string
}) {
  return (
    <>
      <StepProgress current={step} done={status.completedSteps} />
      {status.rejectionReason && (
        <div
          role="alert"
          className="mt-8 flex gap-3 rounded-r-md border-l-[3px] border-error-500 bg-error-50 p-4 text-sm"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-error-600" aria-hidden="true" />
          <div>
            <p className="font-semibold text-neutral-900">Your venue needs a few changes</p>
            <p className="mt-1 text-neutral-900">{status.rejectionReason}</p>
            <p className="mt-1 text-neutral-700">Fix them, then submit again from step 4.</p>
          </div>
        </div>
      )}
      <h1 className="mt-8 text-3xl font-bold text-neutral-900">{title}</h1>
      <p className="mt-1 text-neutral-700">{intro}</p>
    </>
  )
}
