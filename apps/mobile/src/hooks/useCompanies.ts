/**
 * Company list for Discover — E03-04. Shared by the list and the map, so
 * switching views costs no request.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  companyListQueryString,
  type CompanyListPage,
  type CompanyListRequest,
} from '@pitchup/shared'
import { apiRequest } from '../lib/apiClient'

export type CompanyQueryParams = Omit<CompanyListRequest, 'city' | 'cursor'> & {
  city: string | null
}

function fetchPage(query: string): Promise<CompanyListPage> {
  return apiRequest<CompanyListPage>({ method: 'GET', url: `/companies?${query}` })
}

export function useCompanies(params: CompanyQueryParams) {
  const { city, ...rest } = params
  const base = city ? companyListQueryString({ ...rest, city }) : ''

  return useInfiniteQuery({
    // The query string is the key: any change to city, sort, search or a
    // filter is a new list, and an in-flight request for the old one is dropped.
    queryKey: ['companies', base],
    queryFn: ({ pageParam }) =>
      fetchPage(pageParam ? `${base}&cursor=${encodeURIComponent(pageParam)}` : base),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    staleTime: 2 * 60 * 1000,
    enabled: !!city,
  })
}

/**
 * How many companies a filter set would return, for the Filters sheet's
 * "Show X results" button. Asks for one row and reads `total`.
 */
export function useCompanyCount(params: CompanyQueryParams, enabled: boolean) {
  const { city, ...rest } = params
  const query = city ? companyListQueryString({ ...rest, city, limit: 1 }) : ''
  return useQuery({
    queryKey: ['companies-count', query],
    queryFn: () => fetchPage(query).then(page => page.total),
    enabled: enabled && !!city,
    staleTime: 60 * 1000,
  })
}
