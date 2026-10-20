/**
 * A translated sentence with one part in markup (a bold amount, a link):
 * translate with that param set to MARK, then hand the result and the
 * element here. The element lands wherever the language put the param.
 */
import { Fragment, type ReactNode } from 'react'

export const MARK = '\u0000'

export function withMarkup(text: string, element: ReactNode): ReactNode {
  const [before, after = ''] = text.split(MARK)
  return (
    <Fragment>
      {before}
      {element}
      {after}
    </Fragment>
  )
}
