import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { buttonClass } from '@/components/Button'
import { CourseCard } from '@/components/CourseCard'
import { ErrorState, Skeleton } from '@/components/states'
import { BookCard } from '@/features/books/BookCard'
import { useBooks } from '@/features/books/queries'
import { useCategories, useCourses } from '@/features/catalog/queries'

/** Нүүрэнд бүх хичээлийг харуулна (backend-ийн нэг хуудасны дээд хэмжээ) */
const ALL_COURSES_LIMIT = 50
const HOME_BOOKS = 12

const highlights = [
  { title: 'Хүссэн цагтаа', text: 'Видео хичээлээ өөрийн хэмнэлээр, хаанаас ч үзнэ.' },
  { title: 'Явцаа хянах', text: 'Үзсэн хичээлээ тэмдэглэж, хаанаас үргэлжлүүлэхээ мэднэ.' },
  { title: 'QPay төлбөр', text: 'Банкны аппаараа QR уншуулаад шууд эхэлнэ.' },
]

export function HomePage() {
  const courses = useCourses({ limit: ALL_COURSES_LIMIT })
  const books = useBooks({ limit: HOME_BOOKS })
  const { data: categories = [] } = useCategories()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const search = (e: FormEvent) => {
    e.preventDefault()
    navigate(q.trim() ? `/courses?q=${encodeURIComponent(q.trim())}` : '/courses')
  }

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-3xl bg-brand-900 px-6 py-14 text-white sm:px-12 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-brand-500/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl"
        />
        <div className="relative max-w-2xl">
          <span className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent-300 uppercase">
            Онлайн сургалт
          </span>
          <h1 className="mb-4 text-3xl leading-tight font-extrabold sm:text-5xl">
            Ур чадвараа <span className="text-accent-400">өөрийн хэмнэлээр</span> хөгжүүл
          </h1>
          <p className="mb-8 text-base text-brand-100 sm:text-lg">
            Туршлагатай багш нарын бэлтгэсэн видео хичээлүүдийг хүссэн цагтаа, хүссэн газраасаа үзээрэй.
          </p>
          <form onSubmit={search} className="mb-5 flex max-w-lg gap-2 rounded-2xl bg-white p-1.5 shadow-lg">
            <input
              type="search"
              aria-label="Хичээл хайх"
              placeholder="Юу сурмаар байна?"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="min-w-0 flex-1 rounded-xl px-3 text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button type="submit" className={buttonClass('accent')}>
              Хайх
            </button>
          </form>
          <Link to="/courses" className="text-sm font-semibold text-brand-100 underline-offset-4 hover:text-white hover:underline">
            Хичээлүүдийг үзэх
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {highlights.map((h) => (
          <div key={h.title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 h-1.5 w-10 rounded-full bg-accent-400" />
            <h2 className="mb-1 font-bold">{h.title}</h2>
            <p className="text-sm text-slate-600">{h.text}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-extrabold">Ангиллууд</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link
              key={c}
              to={`/courses?category=${encodeURIComponent(c)}`}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
            >
              {c}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-extrabold">Бүх хичээлүүд</h2>
          {courses.data && <span className="text-sm text-slate-500">{courses.data.total} хичээл</span>}
        </div>
        {courses.isPending ? (
          <Skeleton count={8} />
        ) : courses.isError ? (
          <ErrorState onRetry={() => courses.refetch()} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {courses.data.items.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold">Үнэгүй номууд</h2>
            <p className="mt-1 text-sm text-slate-600">Хичээлтэйгээ хамт унших дэлхийн шилдэг номууд</p>
          </div>
          <Link to="/books" className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">
            {books.data ? `Бүх ${books.data.total} ном` : 'Бүх ном'} →
          </Link>
        </div>
        {books.isPending ? (
          <p className="text-slate-500">Ачаалж байна…</p>
        ) : books.isError ? (
          <ErrorState onRetry={() => books.refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {books.data.items.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
