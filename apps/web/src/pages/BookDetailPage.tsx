import { Link, useParams } from 'react-router'
import { isApiError } from '@/api/errors'
import { buttonClass } from '@/components/Button'
import { ErrorState } from '@/components/states'
import { BookCard } from '@/features/books/BookCard'
import { BookCover } from '@/features/books/BookCover'
import { useBook } from '@/features/books/queries'
import { NotFoundPage } from './NotFoundPage'

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

export function BookDetailPage() {
  const { slug = '' } = useParams()
  const { data: book, isPending, isError, error, refetch } = useBook(slug)

  if (isPending) {
    return (
      <div className="grid gap-8 md:grid-cols-[16rem_1fr]" aria-busy="true" aria-label="Ачаалж байна">
        <div className="aspect-[2/3] animate-pulse rounded-md bg-slate-200" />
        <div className="space-y-3">
          <div className="h-8 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
    )
  }
  if (isError) {
    if (isApiError(error) && error.code === 'NOT_FOUND') return <NotFoundPage />
    return <ErrorState onRetry={() => refetch()} />
  }

  return (
    <article className="space-y-12">
      <nav aria-label="Байршил" className="text-sm text-slate-500">
        <Link to="/books" className="hover:text-brand-700 hover:underline">
          Номууд
        </Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/books?category=${encodeURIComponent(book.category)}`} className="hover:text-brand-700 hover:underline">
          {book.category}
        </Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-[16rem_1fr] lg:grid-cols-[18rem_1fr_18rem]">
        <div className="mx-auto w-48 md:w-full">
          <BookCover book={book} size="large" />
        </div>

        <div className="min-w-0">
          <h1 className="text-3xl leading-tight font-extrabold [text-wrap:balance] sm:text-4xl">{book.title}</h1>
          <p className="mt-2 text-slate-600">
            Зохиогч: <span className="font-semibold text-slate-800">{book.author}</span>
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
            <Fact label="Ангилал" value={book.category} />
            <Fact label="Хэл" value={book.language} />
            {book.year && <Fact label="Он" value={String(book.year)} />}
            <Fact label="Үнэ" value="Үнэгүй" />
          </dl>

          <h2 className="mt-6 mb-2 font-bold">Номын тухай</h2>
          <p className="leading-relaxed text-slate-700">{book.description}</p>
        </div>

        {/* Amazon-ийн "худалдан авах" хайрцагны оронд — унших хайрцаг */}
        <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 lg:sticky lg:top-24 lg:col-span-1">
          <p className="text-3xl font-extrabold text-emerald-700">Үнэгүй</p>
          <a href={book.readUrl} target="_blank" rel="noopener noreferrer" className={`${buttonClass()} min-h-11 w-full`}>
            Одоо унших
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M11 3a1 1 0 1 0 0 2h2.59l-6.3 6.3a1 1 0 1 0 1.42 1.4L15 6.42V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
              <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
            </svg>
            <span className="sr-only">(шинэ цонхонд нээгдэнэ)</span>
          </a>
          <p className="text-xs leading-relaxed text-slate-500">
            Зохиогчийн албан ёсны үнэгүй хувилбар руу шинэ цонхонд нээгдэнэ. Бүртгэл, төлбөр шаардахгүй.
          </p>

          {book.course && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Холбогдох хичээл</p>
              <Link to={`/courses/${book.course.slug}`} className="group flex items-center gap-3">
                <img src={book.course.thumbnail} alt="" loading="lazy" className="aspect-video w-20 shrink-0 rounded-md object-cover" />
                <span className="text-sm font-semibold group-hover:text-brand-700 group-hover:underline">{book.course.title}</span>
              </Link>
            </div>
          )}
        </aside>
      </div>

      {book.related.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Ижил төстэй номууд</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {book.related.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
