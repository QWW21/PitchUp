import Link from 'next/link'
import { Check } from 'lucide-react'
import { ONBOARDING_STEPS, ONBOARDING_STEP_LABELS, type OnboardingStep } from '@pitchup/shared'

/**
 * Four connected steps — E09-06. Done steps are links back; the current one
 * is filled; later ones are grey.
 */
export function StepProgress({
  current,
  done,
}: {
  current: 1 | 2 | 3 | 4
  done: OnboardingStep[]
}) {
  return (
    <nav aria-label="Onboarding progress">
      <ol className="flex items-start">
        {ONBOARDING_STEPS.map((step, i) => {
          const n = i + 1
          const isDone = done.includes(step) && n !== current
          const isCurrent = n === current
          const dot = (
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                isDone || isCurrent
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : n}
            </span>
          )
          const label = (
            <span
              className={`mt-2 block text-center text-xs ${isCurrent ? 'font-semibold text-neutral-900' : 'text-neutral-500'}`}
            >
              {ONBOARDING_STEP_LABELS[step]}
            </span>
          )
          return (
            <li key={step} className="relative flex flex-1 flex-col items-center">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${
                    n <= current || isDone ? 'bg-primary-600' : 'bg-neutral-200'
                  }`}
                  style={{ zIndex: 0 }}
                />
              )}
              <span className="relative z-10 flex flex-col items-center">
                {isDone && step !== 'stripe' ? (
                  <Link href={`/onboarding/step/${n}`} className="flex flex-col items-center">
                    {dot}
                    {label}
                    <span className="sr-only"> (done, edit)</span>
                  </Link>
                ) : (
                  <span
                    aria-current={isCurrent ? 'step' : undefined}
                    className="flex flex-col items-center"
                  >
                    {dot}
                    {label}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
