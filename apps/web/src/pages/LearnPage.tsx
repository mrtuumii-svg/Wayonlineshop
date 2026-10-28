import { Link, Navigate, useParams } from 'react-router'
import { isApiError } from '@/api/errors'
import { Button, buttonClass } from '@/components/Button'
import { ErrorState, Skeleton } from '@/components/states'
import { CurriculumList } from '@/features/course/CurriculumList'
import { useCourse, useMyCourses } from '@/features/course/queries'
import { nextLessonId } from '@/lib/courseStats'
import { useMarkComplete, useProgress } from '@/features/learning/queries'
import { VideoPlayer } from '@/features/learning/VideoPlayer'
import { NotFoundPage } from './NotFoundPage'

export function LearnPage() {
  const { slug = '', lessonId = '' } = useParams()
  const course = useCourse(slug)
  const myCourses = useMyCourses({ enabled: true })
  const courseId = course.data?.id ?? ''
  const owned = !!course.data && (myCourses.data?.some((c) => c.id === courseId) ?? false)
  const progress = useProgress(courseId, { enabled: owned })
  const mark = useMarkComplete(courseId)

  if (course.isPending || myCourses.isPending) return <Skeleton count={1} />
  if (course.isError) {
    if (isApiError(course.error) && course.error.code === 'NOT_FOUND') return <NotFoundPage />
    return <ErrorState onRetry={() => course.refetch()} />
  }
  if (myCourses.isError) return <ErrorState onRetry={() => myCourses.refetch()} />
  if (!owned) {
    return <Navigate to={`/courses/${slug}`} replace state={{ notice: 'Энэ хичээлийг худалдаж авна уу' }} />
  }

  const lesson = course.data.sections.flatMap((s) => s.lessons).find((l) => l.id === lessonId)
  if (!lesson) return <NotFoundPage />

  const completed = progress.data?.completedLessonIds ?? []
  const done = completed.includes(lesson.id)
  const next = nextLessonId(course.data, lesson.id)
  const markDone = () => {
    if (!done && !mark.isPending) mark.mutate(lesson.id)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {lesson.youtubeId && <VideoPlayer youtubeId={lesson.youtubeId} title={lesson.title} onEnded={markDone} />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">
              <Link to={`/courses/${slug}`} className="hover:underline">
                {course.data.title}
              </Link>
            </p>
            <h1 className="text-xl font-bold">{lesson.title}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={markDone} disabled={done || mark.isPending}>
              {done ? 'Дууссан ✓' : 'Дууссан гэж тэмдэглэх'}
            </Button>
            {next && (
              <Link to={`/learn/${slug}/${next}`} className={buttonClass()}>
                Дараагийн хичээл
              </Link>
            )}
          </div>
        </div>
      </div>
      <aside>
        <CurriculumList
          course={course.data}
          activeLessonId={lesson.id}
          completedIds={completed}
          renderTitle={(l) => (
            <Link to={`/learn/${slug}/${l.id}`} className="hover:underline">
              {l.title}
            </Link>
          )}
        />
      </aside>
    </div>
  )
}
