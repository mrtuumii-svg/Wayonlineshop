import type { MyCourse, Progress } from '@way/contract'
import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../auth/requireAuth.js'
import { summarySelect, toSummary } from '../catalog/present.js'
import { forbidden, notFound } from '../errors.js'

const COURSE_NOT_FOUND = 'Хичээл олдсонгүй'

/** Хичээлийн дарааллаар бүх lessonId — явц, resume-ийг тооцоход */
const lessonOrderSelect = {
  sections: { orderBy: { order: 'asc' }, select: { lessons: { orderBy: { order: 'asc' }, select: { id: true } } } },
} as const

/** Жагсаалтын summary + хичээлийн дараалал. `sections`-ийг нэг дор тодорхойлно — хоёр select-ийг spread хийвэл нэг нь нөгөөгөө дарна. */
const myCourseSelect = {
  ...summarySelect,
  sections: {
    orderBy: { order: 'asc' },
    select: { lessons: { orderBy: { order: 'asc' }, select: { id: true, durationSec: true } } },
  },
} as const

type WithLessonOrder = { sections: { lessons: { id: string }[] }[] }
const orderedLessonIds = (c: WithLessonOrder) => c.sections.flatMap((s) => s.lessons.map((l) => l.id))

/**
 * Хичээлийн дарааллаар шүүсэн дууссан ID-ууд, хувь (0–100), эхний дуусаагүй хичээл.
 * Бүгд дууссан бол эхний хичээл рүү буцна — `apps/web/src/lib/courseStats.ts`-тэй ижил дүрэм.
 */
function computeProgress(lessonIds: string[], done: Set<string>) {
  const completedLessonIds = lessonIds.filter((id) => done.has(id))
  return {
    completedLessonIds,
    progressPercent: lessonIds.length === 0 ? 0 : Math.round((completedLessonIds.length / lessonIds.length) * 100),
    resumeLessonId: lessonIds.find((id) => !done.has(id)) ?? lessonIds[0] ?? null,
  }
}

export const meRoutes: FastifyPluginAsync = async (app) => {
  const { prisma } = app

  /** 404 (хичээл байхгүй) → 403 (эзэмшээгүй) дарааллаар шалгаж, хичээлийн lessonId-уудыг буцаана */
  async function requireOwnedCourse(userId: string, courseId: string): Promise<string[]> {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { ...lessonOrderSelect, enrollments: { where: { userId }, select: { id: true } } },
    })
    if (!course) throw notFound(COURSE_NOT_FOUND)
    if (course.enrollments.length === 0) throw forbidden('Энэ хичээлийг худалдаж авна уу')
    return orderedLessonIds(course)
  }

  async function progressOf(userId: string, courseId: string, lessonIds: string[]): Promise<Progress> {
    const rows = await prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true },
    })
    return { courseId, completedLessonIds: computeProgress(lessonIds, new Set(rows.map((r) => r.lessonId))).completedLessonIds }
  }

  app.addHook('preHandler', requireAuth)

  app.get('/me/courses', async (req): Promise<MyCourse[]> => {
    const userId = req.user!.id

    // Хичээлийн тооноос үл хамааран тогтмол тооны query: эрхүүд + курсууд (relation-оор нэг дор),
    // дараа нь бүх курсийн явц НЭГ query-ээр. Курс тус бүрт query хийхгүй (N+1 биш).
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { course: { select: myCourseSelect } },
    })
    const courses = enrollments.map((e) => e.course)
    const done = await prisma.lessonProgress.findMany({
      where: { userId, lesson: { section: { courseId: { in: courses.map((c) => c.id) } } } },
      select: { lessonId: true },
    })
    const doneIds = new Set(done.map((d) => d.lessonId))

    return courses.map((c) => ({ ...toSummary(c), ...computeProgress(orderedLessonIds(c), doneIds) }))
  })

  app.get<{ Params: { courseId: string } }>('/me/progress/:courseId', async (req) => {
    const userId = req.user!.id
    const lessonIds = await requireOwnedCourse(userId, req.params.courseId)
    return progressOf(userId, req.params.courseId, lessonIds)
  })

  app.post<{ Params: { courseId: string; lessonId: string } }>(
    '/me/progress/:courseId/lessons/:lessonId',
    async (req) => {
      const userId = req.user!.id
      const { courseId, lessonId } = req.params
      const lessonIds = await requireOwnedCourse(userId, courseId)
      if (!lessonIds.includes(lessonId)) throw notFound(COURSE_NOT_FOUND)

      // ON CONFLICT DO NOTHING — давтан/зэрэг дарсан ч нэг л мөр
      await prisma.lessonProgress.createMany({ data: [{ userId, lessonId }], skipDuplicates: true })
      return progressOf(userId, courseId, lessonIds)
    },
  )
}
