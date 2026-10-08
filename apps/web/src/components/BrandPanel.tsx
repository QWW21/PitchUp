/** Right-hand panel on auth pages. UIUX_SPEC §12.1. */
const FEATURES = [
  'Real-time booking management',
  'Automated payments and payouts',
  'Analytics to grow your business',
]

export function BrandPanel() {
  return (
    // Hidden below lg: the form is what matters on a phone.
    <div className="hidden bg-primary-600 p-12 lg:flex lg:flex-col lg:items-center lg:justify-center">
      <div className="max-w-[480px]">
        <svg
          className="mx-auto h-16 w-16 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3" strokeLinecap="round" />
          <path d="M12 7l4.5 3.3-1.7 5.3h-5.6L7.5 10.3z" strokeLinejoin="round" />
        </svg>

        <h2 className="mt-8 text-center text-4xl font-bold leading-tight text-white">
          Everything you need to manage your pitches.
        </h2>

        <ul className="mt-8 space-y-4">
          {FEATURES.map(feature => (
            <li key={feature} className="flex items-center gap-4 text-lg text-white">
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
