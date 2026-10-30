import { Link } from 'react-router'
import type { BookSummary } from '@/api/types'
import { BookCover } from './BookCover'

/** Amazon/Goodreads маягийн карт: нүүр, гарчиг, зохиогч, "Үнэгүй" */
export function BookCard({ book }: { book: BookSummary }) {
  return (
    <article className="group relative flex flex-col">
      <div className="transition duration-200 group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <BookCover book={book} />
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm leading-snug font-bold text-slate-900">
        {/* Картын аль ч хэсэг дээр дарахад нээгдэнэ (after:absolute) */}
        <Link to={`/books/${book.slug}`} className="after:absolute after:inset-0 hover:text-brand-700">
          {book.title}
        </Link>
      </h3>
      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{book.author}</p>
      {/* mt-auto: гарчиг 1 эсвэл 2 мөр байсан ч "Үнэгүй" нэг шугаманд */}
      <p className="mt-auto pt-1.5">
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">Үнэгүй</span>
      </p>
    </article>
  )
}
