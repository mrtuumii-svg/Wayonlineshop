import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { isApiError } from '@/api/errors'
import type { CourseInput, Level } from '@/api/types'
import { Button } from '@/components/Button'
import { useAdminApi, useInvalidateCatalog } from '@/features/admin/queries'
import { Alert, Field, PageHeader } from '@/features/admin/ui'
import { inputClass } from '@/features/admin/styles'
import { useCategories } from '@/features/catalog/queries'
import { youtubeIdFrom } from '@/features/admin/youtube'
import { levelLabel } from '@/lib/format'

type LessonDraft = { title: string; minutes: string; isPreview: boolean; video: string }
type SectionDraft = { title: string; lessons: LessonDraft[] }

const emptyLesson = (): LessonDraft => ({ title: '', minutes: '', isPreview: false, video: '' })
const emptySection = (): SectionDraft => ({ title: '', lessons: [emptyLesson()] })


/** Формын утгыг шалгаад API-ийн хэлбэрт оруулна. Алдаа бол мессеж буцаана. */
function toInput(f: {
  title: string
  slug: string
  description: string
  price: string
  thumbnail: string
  category: string
  level: Level
  instructorId: string
  sections: SectionDraft[]
}): CourseInput | string {
  if (!f.title.trim()) return 'Гарчиг хоосон байна'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug)) return 'Хаяг (slug): жижиг латин үсэг, тоо, зураас. Жишээ: python-ekhlel'
  if (!f.description.trim()) return 'Тайлбар хоосон байна'
  if (!/^\d+$/.test(f.price)) return 'Үнэ бүхэл, сөрөг биш тоо байх ёстой'
  if (!f.category.trim()) return 'Ангилал хоосон байна'
  if (!f.instructorId) return 'Багш сонгоно уу'

  const sections: CourseInput['sections'] = []
  for (const [si, s] of f.sections.entries()) {
    if (!s.title.trim()) return `${si + 1}-р бүлгийн нэр хоосон байна`
    const lessons = []
    for (const [li, l] of s.lessons.entries()) {
      const where = `${si + 1}.${li + 1} хичээл`
      if (!l.title.trim()) return `${where}: нэр хоосон байна`
      const minutes = Number(l.minutes)
      if (!Number.isFinite(minutes) || minutes <= 0) return `${where}: үргэлжлэх хугацаа (минут) буруу`
      const youtubeId = youtubeIdFrom(l.video)
      if (!youtubeId) return `${where}: YouTube хаяг эсвэл ID буруу`
      lessons.push({ title: l.title.trim(), durationSec: Math.round(minutes * 60), isPreview: l.isPreview, youtubeId })
    }
    sections.push({ title: s.title.trim(), lessons })
  }

  return {
    title: f.title.trim(),
    slug: f.slug,
    description: f.description.trim(),
    price: Number(f.price),
    // Зураг заагаагүй бол slug-аас санамсаргүй зураг
    thumbnail: f.thumbnail.trim() || `https://picsum.photos/seed/${f.slug}/640/360`,
    category: f.category.trim(),
    level: f.level,
    instructorId: f.instructorId,
    sections,
  }
}

const smallBtn = 'rounded-lg px-2 py-1 text-sm hover:bg-slate-100'

export function CourseNewPage() {
  const admin = useAdminApi()
  const invalidate = useInvalidateCatalog()
  const navigate = useNavigate()
  const instructors = useQuery({ queryKey: ['admin', 'instructors'], queryFn: () => admin.getInstructors() })
  const categories = useCategories()

  const [f, setF] = useState({
    title: '',
    slug: '',
    description: '',
    price: '',
    thumbnail: '',
    category: '',
    level: 'beginner' as Level,
    instructorId: '',
  })
  const [sections, setSections] = useState<SectionDraft[]>([emptySection()])
  const [error, setError] = useState<string | null>(null)
  const create = useMutation({ mutationFn: (input: CourseInput) => admin.createCourse(input) })

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }))
  const updateSection = (si: number, patch: Partial<SectionDraft>) =>
    setSections((ss) => ss.map((s, i) => (i === si ? { ...s, ...patch } : s)))
  const updateLesson = (si: number, li: number, patch: Partial<LessonDraft>) =>
    updateSection(si, { lessons: sections[si]!.lessons.map((l, i) => (i === li ? { ...l, ...patch } : l)) })

  function submit(e: FormEvent) {
    e.preventDefault()
    const input = toInput({ ...f, sections })
    if (typeof input === 'string') return setError(input)
    setError(null)
    create.mutate(input, {
      onSuccess: async () => {
        await invalidate()
        navigate('/admin/courses')
      },
      onError: (err) => setError(isApiError(err) ? err.message : 'Хадгалж чадсангүй'),
    })
  }

  return (
    <section>
      <PageHeader title="Шинэ хичээл" />
      <form noValidate onSubmit={submit} className="max-w-3xl space-y-6">
        {error && <Alert>{error}</Alert>}

        <fieldset className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <legend className="px-1 text-sm font-semibold text-slate-500">Ерөнхий</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="new-title" label="Гарчиг">
              <input id="new-title" value={f.title} onChange={set('title')} className={inputClass} />
            </Field>
            <Field id="new-slug" label="Хаяг (slug) — URL-д харагдана">
              <input id="new-slug" value={f.slug} onChange={set('slug')} placeholder="python-ekhlel" className={inputClass} />
            </Field>
          </div>
          <Field id="new-description" label="Тайлбар">
            <textarea id="new-description" rows={3} value={f.description} onChange={set('description')} className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="new-price" label="Үнэ (₮)">
              <input id="new-price" inputMode="numeric" value={f.price} onChange={set('price')} className={inputClass} />
            </Field>
            <Field id="new-category" label="Ангилал">
              <input id="new-category" list="category-options" value={f.category} onChange={set('category')} className={inputClass} />
              <datalist id="category-options">
                {categories.data?.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field id="new-level" label="Түвшин">
              <select id="new-level" value={f.level} onChange={set('level')} className={inputClass}>
                {Object.entries(levelLabel).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="new-instructor" label="Багш">
              <select id="new-instructor" value={f.instructorId} onChange={set('instructorId')} className={inputClass}>
                <option value="">— сонгох —</option>
                {instructors.data?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field id="new-thumbnail" label="Зургийн хаяг (заавал биш)">
            <input id="new-thumbnail" type="url" value={f.thumbnail} onChange={set('thumbnail')} className={inputClass} />
          </Field>
        </fieldset>

        {sections.map((s, si) => (
          <fieldset key={si} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
            <legend className="px-1 text-sm font-semibold text-slate-500">{si + 1}-р бүлэг</legend>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field id={`s${si}-title`} label="Бүлгийн нэр">
                  <input id={`s${si}-title`} value={s.title} onChange={(e) => updateSection(si, { title: e.target.value })} className={inputClass} />
                </Field>
              </div>
              {sections.length > 1 && (
                <button type="button" onClick={() => setSections((ss) => ss.filter((_, i) => i !== si))} className={`${smallBtn} text-red-600`}>
                  Бүлэг хасах
                </button>
              )}
            </div>

            {s.lessons.map((l, li) => (
              <div key={li} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_6rem_1fr_auto]">
                <Field id={`s${si}l${li}-title`} label={`${si + 1}.${li + 1} Хичээлийн нэр`}>
                  <input id={`s${si}l${li}-title`} value={l.title} onChange={(e) => updateLesson(si, li, { title: e.target.value })} className={inputClass} />
                </Field>
                <Field id={`s${si}l${li}-min`} label="Минут">
                  <input id={`s${si}l${li}-min`} inputMode="decimal" value={l.minutes} onChange={(e) => updateLesson(si, li, { minutes: e.target.value })} className={inputClass} />
                </Field>
                <Field id={`s${si}l${li}-video`} label="YouTube хаяг эсвэл ID">
                  <input id={`s${si}l${li}-video`} value={l.video} onChange={(e) => updateLesson(si, li, { video: e.target.value })} className={inputClass} />
                </Field>
                <div className="flex items-end gap-2 pb-1">
                  <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                    <input type="checkbox" checked={l.isPreview} onChange={(e) => updateLesson(si, li, { isPreview: e.target.checked })} />
                    Үнэгүй
                  </label>
                  {s.lessons.length > 1 && (
                    <button
                      type="button"
                      aria-label={`${si + 1}.${li + 1} хичээлийг хасах`}
                      onClick={() => updateSection(si, { lessons: s.lessons.filter((_, i) => i !== li) })}
                      className={`${smallBtn} text-red-600`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => updateSection(si, { lessons: [...s.lessons, emptyLesson()] })} className={`${smallBtn} text-brand-700`}>
              + Хичээл нэмэх
            </button>
          </fieldset>
        ))}

        <button type="button" onClick={() => setSections((ss) => [...ss, emptySection()])} className={`${smallBtn} text-brand-700`}>
          + Бүлэг нэмэх
        </button>

        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Хадгалж байна…' : 'Хичээл нэмэх'}
          </Button>
          <Link to="/admin/courses" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Болих
          </Link>
        </div>
      </form>
    </section>
  )
}
