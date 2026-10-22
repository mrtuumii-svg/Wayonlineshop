import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { isApiError } from '@/api/errors'
import type { Lesson } from '@/api/types'
import { Button, buttonClass } from '@/components/Button'
import { ErrorState, Skeleton } from '@/components/states'
import { useAuthStore } from '@/features/auth/authStore'
import { useCartStore } from '@/features/cart/cartStore'
import { CurriculumList } from '@/features/course/CurriculumList'
import { useCourse, useMyCourses } from '@/features/course/queries'
import { VideoPlayer } from '@/features/learning/VideoPlayer'
import { formatPrice, levelLabel } from '@/lib/format'
import { NotFoundPage } from './NotFoundPage'

export function CourseDetailPage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const token = useAuthStore((s) => s.token)
  const { data: course, isPending, isError, error, refetch } = useCourse(slug)
  const myCourses = useMyCourses({ enabled: !!token })
  const inCart = useCartStore((s) => (course ? s.courseIds.includes(course.id) : false))
  const addToCart = useCartStore((s) => s.add)
  const [preview, setPreview] = useState<Lesson | null>(null)

  if (isPending) return <Skeleton count={1} />
  if (isError) {
    if (isApiError(error) && error.code === 'NOT_FOUND') return <NotFoundPage />
    return <ErrorState onRetry={() => refetch()} />
  }

  const owned = myCourses.data?.some((c) => c.id === course.id) ?? false
  const ownershipKnown = !token || !myCourses.isPending
  const firstLesson = course.sections[0]?.lessons[0]

  return (
    <article className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {notice && (
          <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
            {notice}
          </p>
        )}
        <div>
          <span className="text-sm font-medium text-brand-600">
            {course.category} · {levelLabel[course.level]}
          </span>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{course.title}</h1>
          <p className="mt-3 text-slate-600">{course.description}</p>
        </div>

        {preview?.youtubeId && (
          <div className="space-y-2">
            <h2 className="font-semibold">Урьдчилан үзэх: {preview.title}</h2>
            <VideoPlayer youtubeId={preview.youtubeId} title={preview.title} />
          </div>
        )}

        <section>
          <h2 className="mb-3 text-xl font-bold">Хичээлийн агуулга</h2>
          <CurriculumList
            course={course}
            renderAction={(lesson) =>
              lesson.isPreview && lesson.youtubeId ? (
                <button type="button" className="text-brand-600 hover:underline" onClick={() => setPreview(lesson)}>
                  Урьдчилан үзэх
                </button>
              ) : null
            }
          />
        </section>

        <section className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <img src={course.instructor.avatar} alt="" className="h-14 w-14 rounded-full" />
          <div>
            <h2 className="font-semibold">{course.instructor.name}</h2>
            <p className="text-sm text-slate-600">{course.instructor.bio}</p>
          </div>
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
        <img src={course.thumbnail} alt="" className="aspect-video w-full rounded-lg object-cover" />
        <p className="text-3xl font-extrabold">{formatPrice(course.price)}</p>
        {!ownershipKnown ? null : owned && firstLesson ? (
          <Link to={`/learn/${course.slug}/${firstLesson.id}`} className={`${buttonClass()} w-full`}>
            Үзэх
          </Link>
        ) : inCart ? (
          <Link to="/cart" className={`${buttonClass('secondary')} w-full`}>
            Сагс руу очих
          </Link>
        ) : (
          <Button className="w-full" onClick={() => addToCart(course.id)}>
            Сагсанд нэмэх
          </Button>
        )}
      </aside>
    </article>
  )
}
