'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useT } from '@/i18n/client'

/**
 * Clamped to four lines with "Show more" — but only when the text actually
 * overflows, which is measured after layout rather than guessed from length.
 */
export function ExpandableText({ text }: { text: string }) {
  const t = useT()
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (el && !expanded) setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [text, expanded])

  return (
    <div>
      <p ref={ref} className={`text-sm text-neutral-700 ${expanded ? '' : 'line-clamp-4'}`}>
        {text}
      </p>
      {(overflows || expanded) && (
        <div className="mt-1 text-right">
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="text-[13px] font-medium text-primary-600 hover:underline"
          >
            {expanded ? t('venue.showLess') : t('venue.showMore')}
          </button>
        </div>
      )}
    </div>
  )
}
