import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { isApiError } from '@/api/errors'
import type { Course, CourseUpdate, Level } from '@/api/types'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/states'
import { useAdminApi, useInvalidateCatalog } from '@/features/admin/queries'
import { Alert, Field, PageHeader } from '@/features/admin/ui'
import { inputClass } from '@/features/admin/styles'
import { useCourse } from '@/features/course/queries'
import { levelLabel } from '@/lib/format'

type FormValues = { title: string; description: string; price: string; thumbnail: string; category: string; level: Level }

const toForm = (c: Course): FormValues => ({
  title: c.title,
  description: c.description,
  price: String(c.price),
  thumbnail: c.thumbnail,
  category: c.category,
  level: c.level,
})

/** Зөвхөн өөрчлөгдсөн талбаруудыг илгээнэ — хоёр админ зэрэг засахад бие биенийхээ өөрчлөлтийг дарахгүй */
function changes(before: FormValues, after: FormValues): CourseUpdate {
  const out: CourseUpdate = {}
  if (after.title.trim() !== before.title) out.title = after.title.trim()
  if (after.description.trim() !== before.description) out.description = after.description.trim()
  if (after.price !== before.price) out.price = Number(after.price)
  if (after.thumbnail.trim() !== before.thumbnail) out.thumbnail = after.thumbnail.trim()
  if (after.category.trim() !== before.category) out.category = after.category.trim()
  if (after.level !== before.level) out.level = after.level
  return out
}

function validate(v: FormValues): string | null {
  if (!v.title.trim()) return 'Гарчиг хоосон байна'
  if (!/^\d+$/.test(v.price)) return 'Үнэ бүхэл, сөрөг биш тоо байх ёстой'
  if (!v.category.trim()) return 'Ангилал хоосон байна'
  return null
}

function EditForm({ course }: { course: Course }) {
  const admin = useAdminApi()
  const invalidate = useInvalidateCatalog()
  const navigate = useNavigate()
  const initial = toForm(course)
  const [values, setValues] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({ mutationFn: (data: CourseUpdate) => admin.updateCourse(course.id, data) })

  const set = (k: keyof FormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }))

  function submit(e: FormEvent) {
    e.preventDefault()
    const invalid = validate(values)
    if (invalid) return setError(invalid)
    const data = changes(initial, values)
    if (Object.keys(data).length === 0) return setError('Өөрчлөлт алга')
    setError(null)
    save.mutate(data, {
      onSuccess: async () => {
        await invalidate()
        navigate('/admin/courses')
      },
      onError: (err) => setError(isApiError(err) ? err.message : 'Хадгалж чадсангүй'),
    })
  }

  return (
    <form noValidate onSubmit={submit} className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      {error && <Alert>{error}</Alert>}
      <Field id="title" label="Гарчиг">
        <input id="title" value={values.title} onChange={set('title')} className={inputClass} />
      </Field>
      <Field id="description" label="Тайлбар">
        <textarea id="description" rows={4} value={values.description} onChange={set('description')} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="price" label="Үнэ (₮)">
          <input id="price" inputMode="numeric" value={values.price} onChange={set('price')} className={inputClass} />
        </Field>
        <Field id="category" label="Ангилал">
          <input id="category" value={values.category} onChange={set('category')} className={inputClass} />
        </Field>
        <Field id="level" label="Түвшин">
          <select id="level" value={values.level} onChange={set('level')} className={inputClass}>
            {Object.entries(levelLabel).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="thumbnail" label="Зургийн хаяг (URL)">
        <input id="thumbnail" type="url" value={values.thumbnail} onChange={set('thumbnail')} className={inputClass} />
      </Field>
      <p className="text-sm text-slate-500">
        💡 Үнэ өөрчлөхөд <strong>хуучин захиалгын дүн өөрчлөгдөхгүй</strong> — худалдан авах үеийн үнэ хадгалагддаг.
      </p>
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Хадгалж байна…' : 'Хадгалах'}
        </Button>
        <Link to="/admin/courses" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          Болих
        </Link>
      </div>
    </form>
  )
}

export function CourseEditPage() {
  const { slug = '' } = useParams()
  const { data, isPending, isError, refetch } = useCourse(slug)

  return (
    <section>
      <PageHeader title={data ? `Засах: ${data.title}` : 'Хичээл засах'} />
      {isPending ? (
        <p className="text-slate-500">Ачаалж байна…</p>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        // key: өөр хичээл рүү шилжихэд форм шинэ утгаар эхэлнэ
        <EditForm key={data.id} course={data} />
      )}
    </section>
  )
}
