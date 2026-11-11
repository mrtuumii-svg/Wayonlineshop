import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import type { BookFilter } from '@/api/types'
import { Button } from '@/components/Button'
import { EmptyState, ErrorState } from '@/components/states'
import { BookCard } from '@/features/books/BookCard'
import { useBookCategories, useBooks } from '@/features/books/queries'

const PAGE_SIZE = 24

function parseFilter(params: URLSearchParams): BookFilter {
  const page = Number(params.get('page'))
  return {
    limit: PAGE_SIZE,
    ...(params.get('q') && { q: params.get('q')! }),
    ...(params.get('category') && { category: params.get('category')! }),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

const chipClass = (active: boolean) =>
  `min-h-11 rounded-full px-4 text-sm font-medium transition ${
    active ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
  }`

function BookGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" aria-busy="true" aria-label="Ачаалж байна">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] animate-pulse rounded-md bg-slate-200" />
          <div className="mt-3 h-3 w-4/5 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  )
}

function SearchForm({ initial, onSearch }: { initial: string; onSearch: (q: string) => void }) {
  const [q, setQ] = useState(initial)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSearch(q.trim())
  }
  return (
    <form role="search" onSubmit={submit} className="mt-5 flex max-w-xl gap-2">
      <label htmlFor="book-search" className="sr-only">
        Ном хайх
      </label>
      <input
        id="book-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Гарчиг, зохиогч, сэдвээр хайх…"
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
      <Button type="submit">Хайх</Button>
    </form>
  )
}

export function BooksPage() {
  const [params, setParams] = useSearchParams()
  const filter = parseFilter(params)
  const { data, isPending, isError, refetch } = useBooks(filter)
  const { data: categories = [] } = useBookCategories()

  const update = (key: 'q' | 'category', value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        next.delete('page')
        return next
      },
      { replace: true },
    )

  const goToPage = (page: number) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (page <= 1) next.delete('page')
      else next.set('page', String(page))
      return next
    })
    window.scrollTo({ top: 0 })
  }

  const page = filter.page ?? 1
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <section>
      <div className="mb-6 rounded-3xl bg-gradient-to-br from-emerald-50 to-brand-50 px-6 py-8 sm:px-10">
        <p className="text-sm font-semibold text-emerald-700">Үнэгүй номын сан</p>
        <h1 className="mt-1 text-3xl font-extrabold">Номууд</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Хичээлүүдтэй холбоотой дэлхийн шилдэг номууд. Бүгд <strong>үнэгүй</strong> — бүртгэлгүйгээр шууд уншина.
        </p>
        {/* key: URL-ийн хайлтын үг (буцах товч г.м.) солигдвол талбар шинэ утгаар эхэлнэ */}
        <SearchForm key={filter.q ?? ''} initial={filter.q ?? ''} onSearch={(value) => update('q', value)} />
      </div>

      <div role="group" aria-label="Ангилал" className="mb-6 flex flex-wrap gap-2">
        <button type="button" aria-pressed={!filter.category} onClick={() => update('category', '')} className={chipClass(!filter.category)}>
          Бүгд
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={filter.category === c}
            onClick={() => update('category', c)}
            className={chipClass(filter.category === c)}
          >
            {c}
          </button>
        ))}
      </div>

      {isPending ? (
        <BookGridSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState message="Хайлтад тохирох ном олдсонгүй" />
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500" aria-live="polite">
            {data.total} ном
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data.items.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
          {pageCount > 1 && (
            <nav aria-label="Хуудаслалт" className="mt-10 flex items-center justify-center gap-4">
              <Button variant="secondary" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
                Өмнөх
              </Button>
              <span className="text-sm text-slate-600 tabular-nums">
                {page} / {pageCount}
              </span>
              <Button variant="secondary" onClick={() => goToPage(page + 1)} disabled={page >= pageCount}>
                Дараах
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}
