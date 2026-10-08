export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-primary-600 ${className}`}>
      <svg
        className="h-8 w-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 7l4.5 3.3-1.7 5.3h-5.6L7.5 10.3z" strokeLinejoin="round" />
      </svg>
      <span className="text-2xl font-bold">PitchUp</span>
    </div>
  )
}
