interface StepIndicatorProps {
  steps: readonly string[]
  /** 1-based. */
  current: number
}

/** Connected dots for a multi-step flow. UIUX_SPEC §12.2. */
export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div>
      {/* The visual dots carry no meaning for a screen reader, so they are
          hidden and the text below states the position instead. */}
      <ol className="flex items-center" aria-hidden="true">
        {steps.map((step, index) => {
          const position = index + 1
          const done = position <= current
          return (
            <li key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    done ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  {position}
                </span>
                <span
                  className={`whitespace-nowrap text-xs ${
                    done ? 'font-medium text-primary-600' : 'text-neutral-400'
                  }`}
                >
                  {step}
                </span>
              </div>
              {position < steps.length && (
                <span
                  className={`mx-2 mb-5 h-0.5 flex-1 ${
                    position < current ? 'bg-primary-600' : 'bg-neutral-300'
                  }`}
                />
              )}
            </li>
          )
        })}
      </ol>

      <p className="mt-4 text-center text-sm text-neutral-500">
        Step {current} of {steps.length}
      </p>
    </div>
  )
}
