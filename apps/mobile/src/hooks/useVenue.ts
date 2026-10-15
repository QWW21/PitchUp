/**
 * Company, pitch, availability and review data — E04-04 … E04-07.
 */
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import {
  addDays,
  venueClock,
  type CompanyDetail,
  type PitchAvailability,
  type PitchDetail,
  type ReviewPage,
  type ReviewSort,
} from '@pitchup/shared'
import { apiRequest } from '../lib/apiClient'

const get = <T>(url: string) => apiRequest<T>({ method: 'GET', url })

export function useCompany(id: string) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: () => get<CompanyDetail>(`/companies/${id}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function usePitch(id: string) {
  return useQuery({
    queryKey: ['pitch', id],
    queryFn: () => get<PitchDetail>(`/pitches/${id}`),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Today and the next six days, fetched in parallel. "Today" is the venue's
 * date, so a phone set to another zone still sees Romanian days.
 */
export function usePitchWeek(pitchId: string, enabled: boolean) {
  const today = venueClock(new Date()).date
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const results = useQueries({
    queries: dates.map(date => ({
      queryKey: ['pitch-availability', pitchId, date],
      queryFn: () => get<PitchAvailability>(`/pitches/${pitchId}/availability?date=${date}`),
      staleTime: 5 * 60 * 1000,
      enabled,
    })),
  })
  return dates.map((date, i) => ({ date, query: results[i]! }))
}

const PAGE_SIZE = 10

/** E07-07: `sort` orders the list (newest by default). */
export function useReviews(params: {
  companyId: string
  pitchId?: string | undefined
  sort?: ReviewSort | undefined
}) {
  const filter = `${params.pitchId ? `pitchId=${params.pitchId}` : `companyId=${params.companyId}`}&sort=${params.sort ?? 'newest'}`
  return useInfiniteQuery({
    queryKey: ['reviews', filter],
    queryFn: ({ pageParam }) =>
      get<ReviewPage>(`/reviews?${filter}&page=${pageParam}&limit=${PAGE_SIZE}`),
    initialPageParam: 1,
    getNextPageParam: last => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 2 * 60 * 1000,
  })
}
