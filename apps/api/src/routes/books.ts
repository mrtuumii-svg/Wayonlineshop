import type { Book, BookSummary, Paginated } from '@way/contract'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { notFound, validation } from '../errors.js'
import type { Prisma } from '../generated/prisma/client.js'

const PAGE_LIMIT_DEFAULT = 24
const PAGE_LIMIT_MAX = 60
const RELATED_COUNT = 6

// Query string бүгд string-ээр ирнэ — бүхэл тоо гэдгийг regex-ээр шалгаад хөрвүүлнэ (courses.ts-тэй ижил)
const positiveInt = (msg: string) => z.string().regex(/^\d+$/, msg).transform(Number).pipe(z.number().int().min(1, msg))

const listQuery = z.object({
  q: z.string().trim().max(100, 'Хайлтын үг хэт урт байна').optional(),
  category: z.string().trim().min(1).max(100).optional(),
  courseId: z.string().trim().min(1).max(64).optional(),
  page: positiveInt('Хуудасны дугаар буруу байна').default(1),
  limit: positiveInt(`Хуудасны хэмжээ 1–${PAGE_LIMIT_MAX} хооронд байх ёстой`)
    .pipe(z.number().max(PAGE_LIMIT_MAX, `Хуудасны хэмжээ 1–${PAGE_LIMIT_MAX} хооронд байх ёстой`))
    .default(PAGE_LIMIT_DEFAULT),
})

/** Картад хэрэгтэй талбарууд л — тайлбар, линк жагсаалтаар явахгүй */
const summarySelect = {
  id: true,
  slug: true,
  title: true,
  author: true,
  category: true,
  year: true,
  coverUrl: true,
} satisfies Prisma.BookSelect

export const bookRoutes: FastifyPluginAsync = async (app) => {
  const { prisma } = app

  app.get('/books', async (req): Promise<Paginated<BookSummary>> => {
    const parsed = listQuery.safeParse(req.query)
    if (!parsed.success) throw validation(parsed.error.issues[0]?.message ?? 'Хүсэлтийн өгөгдөл буруу байна')
    const { q, category, courseId, page, limit } = parsed.data

    // 40 орчим ном — гарчиг, зохиогч, тайлбараар ILIKE хайлт хангалттай (хичээлийнх шиг тусгай индекс шаардахгүй)
    const where: Prisma.BookWhereInput = {
      ...(category && { category }),
      ...(courseId && { courseId }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { author: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      }),
    }

    const [total, items] = await prisma.$transaction([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        select: summarySelect,
        // Гарчгаар, давтагдашгүй id-аар — хуудас солиход давхцахгүй
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])
    return { items, total, page, limit }
  })

  app.get('/books/categories', async (): Promise<string[]> => {
    const rows = await prisma.book.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } })
    return rows.map((r) => r.category)
  })

  app.get<{ Params: { slug: string } }>('/books/:slug', async (req): Promise<Book> => {
    const book = await prisma.book.findUnique({
      where: { slug: req.params.slug },
      include: { course: { select: { slug: true, title: true, thumbnail: true } } },
    })
    if (!book) throw notFound('Ном олдсонгүй')

    // Ижил ангиллын номууд — нэг хичээлийнх нь эхэнд
    const candidates = await prisma.book.findMany({
      where: { category: book.category, id: { not: book.id } },
      select: { ...summarySelect, courseId: true },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    })
    const sameCourseFirst = (r: { courseId: string | null }) => (book.courseId && r.courseId === book.courseId ? 0 : 1)
    const related = [...candidates]
      .sort((a, b) => sameCourseFirst(a) - sameCourseFirst(b))
      .slice(0, RELATED_COUNT)
      .map(({ courseId: _courseId, ...r }) => r)

    return {
      id: book.id,
      slug: book.slug,
      title: book.title,
      author: book.author,
      category: book.category,
      year: book.year,
      coverUrl: book.coverUrl,
      description: book.description,
      language: book.language,
      readUrl: book.readUrl,
      course: book.course,
      related,
    }
  })
}
