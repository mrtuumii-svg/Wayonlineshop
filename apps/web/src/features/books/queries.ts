import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useApi } from '@/api/ApiProvider'
import type { BookFilter } from '@/api/types'

export function useBooks(filter: BookFilter, { enabled = true }: { enabled?: boolean } = {}) {
  const api = useApi()
  return useQuery({
    queryKey: ['books', filter],
    queryFn: () => api.getBooks(filter),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useBook(slug: string) {
  const api = useApi()
  return useQuery({ queryKey: ['book', slug], queryFn: () => api.getBook(slug) })
}

export function useBookCategories() {
  const api = useApi()
  return useQuery({ queryKey: ['bookCategories'], queryFn: () => api.getBookCategories() })
}
