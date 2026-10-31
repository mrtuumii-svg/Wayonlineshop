import { useState } from 'react'
import { Link } from 'react-router'
import { isApiError } from '@/api/errors'
import type { CourseSummary } from '@/api/types'
import { buttonClass } from '@/components/Button'
import { ErrorState } from '@/components/states'
import { useDeleteCourse } from '@/features/admin/queries'
import { Alert, PageHeader, TableFrame } from '@/features/admin/ui'
import { inputClass, td, th } from '@/features/admin/styles'
import { useCourses } from '@/features/catalog/queries'
import { formatPrice, levelLabel } from '@/lib/format'

/** Устгахыг 2 алхмаар: эхлээд "Устгах", дараа нь "Тийм, устга" — санамсаргүй дарахаас хамгаална */
function DeleteButton({ course, onError }: { course: CourseSummary; onError: (msg: string | null) => void }) {
  const [confirming, setConfirming] = useState(false)
  const del = useDeleteCourse()

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50">
        Устгах
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={del.isPending}
        aria-label={`${course.title}-г устгахыг батлах`}
        onClick={() => {
          onError(null)
          del.mutate(course.id, {
            onError: (err) => {
              setConfirming(false)
              onError(
                isApiError(err) && err.code === 'CONFLICT'
                  ? `«${course.title}»-г хэн нэгэн худалдаж авсан тул устгах боломжгүй. Үнэ, нэрийг нь засаж болно.`
                  : 'Устгаж чадсангүй. Дахин оролдоно уу.',
              )
            },
          })
        }}
        className="rounded-lg bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        Тийм, устга
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100">
        Болих
      </button>
    </span>
  )
}

export function AdminCoursesPage() {
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { data, isPending, isError, refetch } = useCourses({ q: q.trim() || undefined, limit: 50 })

  return (
    <section>
      <PageHeader
        title="Хичээлүүд"
        action={
          <Link to="/admin/courses/new" className={buttonClass()}>
            + Шинэ хичээл
          </Link>
        }
      />
      <label htmlFor="admin-course-search" className="sr-only">
        Хичээл хайх
      </label>
      <input
        id="admin-course-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Нэр, ангилал, багшаар хайх…"
        className={`${inputClass} mb-4 max-w-sm`}
      />
      {error && <Alert>{error}</Alert>}

      {isPending ? (
        <p className="text-slate-500">Ачаалж байна…</p>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <p className="text-slate-500">Хичээл олдсонгүй</p>
      ) : (
        <TableFrame>
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Хичээл</th>
              <th className={th}>Ангилал</th>
              <th className={th}>Түвшин</th>
              <th className={`${th} text-right`}>Видео</th>
              <th className={`${th} text-right`}>Үнэ</th>
              <th className={`${th} text-right`}>Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className={td}>
                  <Link to={`/courses/${c.slug}`} className="font-medium hover:text-brand-700 hover:underline">
                    {c.title}
                  </Link>
                  <p className="text-xs text-slate-500">{c.instructor.name}</p>
                </td>
                <td className={td}>{c.category}</td>
                <td className={`${td} whitespace-nowrap`}>{levelLabel[c.level]}</td>
                <td className={`${td} text-right tabular-nums`}>{c.lessonCount}</td>
                <td className={`${td} text-right whitespace-nowrap tabular-nums`}>{formatPrice(c.price)}</td>
                <td className={`${td} text-right whitespace-nowrap`}>
                  <Link to={`/admin/courses/${c.slug}/edit`} className="rounded-lg px-2 py-1 text-brand-700 hover:bg-brand-50">
                    Засах
                  </Link>
                  <DeleteButton course={c} onError={setError} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
      {data && data.total > data.items.length && (
        <p className="mt-3 text-sm text-slate-500">
          Эхний {data.items.length} / {data.total}. Хайлтаар нарийсгана уу.
        </p>
      )}
    </section>
  )
}
