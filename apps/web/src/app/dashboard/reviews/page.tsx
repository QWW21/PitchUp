import { redirect } from 'next/navigation'

/** Moved in E09: the manager area lives under /manager. */
export default function OldReviewsPage() {
  redirect('/manager/reviews')
}
