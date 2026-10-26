import type { Paginated, CourseSummary } from '@way/contract'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { optionalAuth } from '../auth/requireAuth.js'
import { detailInclude, summarySelect, toCourse, toSummary } from '../catalog/present.js'
import { searchCourseIds } from '../catalog/search.js'
import { notFound, validation } from '../errors.js'
import type { Prisma } from '../generated/prisma/client.js'

const PAGE_LIMIT_DEFAULT = 12
const PAGE_LIMIT_MAX = 50
const BY_IDS_MAX = 50

// Query string бүгд string-ээр ирнэ — бүхэл тоо гэдгийг regex-ээр шалгаад хөрвүүлнэ (1.5, abc, -1 → 400)
const positiveInt = (msg: string) => z.string().regex(/^\d+$/, msg).transform(Number).pipe(z.number().int().min(1, msg))

const listQuery = z.object({
  q: z.string().trim().max(100, 'Хайлтын үг хэт урт байна').optional(),
  category: z.string().trim().min(1).max(100).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced'], 'Түвшин буруу байна').optional(),
  maxPrice: z.string().regex(/^\d+$/, 'Үнэ буруу байна').transform(Number).optional(),
  page: positiveInt('Хуудасны дугаар буруу байна').default(1),
  limit: positiveInt(`Хуудасны хэмжээ 1–${PAGE_LIMIT_MAX} хооронд байх ёстой`)
    .pipe(z.number().max(PAGE_LIMIT_MAX, `Хуудасны хэмжээ 1–${PAGE_LIMIT_MAX} хооронд байх ёстой`))
    .default(PAGE_LIMIT_DEFAULT),
})

const byIdsQuery = z.object({
  ids: z
    .string()
    .optional()
    .transform((s) => [...new Set((s ?? '').split(',').map((x) => x.trim()).filter(Boolean))])
    .pipe(z.array(z.string().max(64)).max(BY_IDS_MAX, `Нэг удаад ${BY_IDS_MAX}-аас олон хичээл авах боломжгүй`)),
})

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input)
  if (!r.success) throw validation(r.error.issues[0]?.message ?? 'Хүсэлтийн өгөгдөл буруу байна')
  return r.data
}

export const courseRoutes: FastifyPluginAsync = async (app) => {
  app.get('/courses', async (req): Promise<Paginated<CourseSummary>> => {
    const { q, category, level, maxPrice, page, limit } = parse(listQuery, req.query)

    const where: Prisma.CourseWhereInput = {
      ...(category && { category }),
      ...(level && { level }),
      ...(maxPrice !== undefined && { price: { lte: maxPrice } }),
      ...(q && { id: { in: await searchCourseIds(app.prisma, q) } }),
    }

    const [total, rows] = await app.prisma.$transaction([
      app.prisma.course.count({ where }),
      app.prisma.course.findMany({
        where,
        select: summarySelect,
        // Хуудаслалт тогтвортой байхын тулд давтагдашгүй түлхүүрээр эрэмбэлнэ
        orderBy: { id: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return { items: rows.map(toSummary), total, page, limit }
  })

  // `/courses/:slug`-аас өмнө бүртгэгдэх шаардлагагүй — Fastify статик замыг давуу үздэг
  app.get('/courses/by-ids', async (req): Promise<CourseSummary[]> => {
    const { ids } = parse(byIdsQuery, req.query)
    if (ids.length === 0) return []

    const rows = await app.prisma.course.findMany({ where: { id: { in: ids } }, select: summarySelect })
    const byId = new Map(rows.map((r) => [r.id, r]))
    // Сагсны дарааллыг хадгална
    return ids.flatMap((id) => {
      const row = byId.get(id)
      return row ? [toSummary(row)] : []
    })
  })

  app.get<{ Params: { slug: string } }>('/courses/:slug', { preHandler: optionalAuth }, async (req) => {
    const row = await app.prisma.course.findUnique({ where: { slug: req.params.slug }, include: detailInclude })
    if (!row) throw notFound('Хичээл олдсонгүй')

    const owned = req.user
      ? (await app.prisma.enrollment.count({ where: { userId: req.user.id, courseId: row.id } })) > 0
      : false

    return toCourse(row, owned)
  })

  app.get('/categories', async (): Promise<string[]> => {
    const rows = await app.prisma.course.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    })
    return rows.map((r) => r.category)
  })
}
