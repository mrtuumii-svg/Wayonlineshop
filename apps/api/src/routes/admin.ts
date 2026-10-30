import type { AdminOrder, AdminUser, SalesReport } from '@way/contract'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../auth/requireAuth.js'
import { conflict, notFound, validation } from '../errors.js'

const lessonInput = z.object({
  title: z.string().trim().min(1, 'Хичээлийн нэр хоосон байна').max(200),
  durationSec: z.number().int().min(1, 'Үргэлжлэх хугацаа буруу'),
  isPreview: z.boolean().default(false),
  youtubeId: z.string().regex(/^[\w-]{11}$/, 'YouTube ID 11 тэмдэгт байх ёстой'),
})

const courseInput = z.object({
  // URL-д орох тул зөвхөн жижиг латин үсэг, тоо, зураас
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug: жижиг латин үсэг, тоо, зураас (react-ekhlel)').max(100),
  title: z.string().trim().min(1, 'Гарчиг хоосон байна').max(200),
  description: z.string().trim().min(1).max(5000),
  price: z.number().int('Үнэ бүхэл тоо байх ёстой').min(0, 'Үнэ сөрөг байж болохгүй'),
  thumbnail: z.url('Зургийн хаяг буруу'),
  category: z.string().trim().min(1).max(100),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  instructorId: z.string().min(1),
  sections: z
    .array(z.object({ title: z.string().trim().min(1).max(200), lessons: z.array(lessonInput).min(1, 'Бүлэгт хичээл алга') }))
    .min(1, 'Дор хаяж нэг бүлэг байх ёстой'),
})

const adminUserSelect = { id: true, name: true, email: true, role: true, createdAt: true } as const

const toAdminUser = ({ createdAt, ...u }: { id: string; name: string; email: string; role: AdminUser['role']; createdAt: Date }): AdminUser => ({
  ...u,
  createdAt: createdAt.toISOString(),
})

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input)
  if (!r.success) throw validation(r.error.issues[0]?.message ?? 'Хүсэлт буруу байна')
  return r.data
}

/**
 * Админы хэсэг. Энэ файлын бүх route `requireAdmin`-ээр хамгаалагдана (hook нь энэ plugin-д л үйлчилнэ).
 * Анхны админыг `npm run make-admin -w @way/api -- <имэйл>`-ээр өгнө.
 */
export const adminRoutes: FastifyPluginAsync = async (app) => {
  const { prisma } = app
  app.addHook('preHandler', requireAdmin)

  app.get('/admin/users', async (): Promise<AdminUser[]> => {
    // passwordHash-ийг админд ч харуулахгүй
    const users = await prisma.user.findMany({ select: adminUserSelect, orderBy: { createdAt: 'desc' } })
    return users.map(toAdminUser)
  })

  // Хэрэглэгчийг админ болгох / админаас хасах
  app.patch<{ Params: { id: string } }>('/admin/users/:id', async (req): Promise<AdminUser> => {
    const { role } = parse(z.object({ role: z.enum(['user', 'admin'], 'role: user эсвэл admin') }), req.body)
    // Өөрийгөө админаас хасвал хэн ч удирдаж чадахгүй болж магадгүй
    if (req.params.id === req.user!.id && role !== 'admin') throw conflict('Өөрийн админ эрхийг хасах боломжгүй')
    if (!(await prisma.user.findUnique({ where: { id: req.params.id } }))) throw notFound('Хэрэглэгч олдсонгүй')
    return toAdminUser(await prisma.user.update({ where: { id: req.params.id }, data: { role }, select: adminUserSelect }))
  })

  // Хичээл нэмэх формын "Багш" сонголтод
  app.get('/admin/instructors', async () =>
    prisma.instructor.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  )

  // Бүх захиалга (шинэ нь эхэндээ). ?status=paid гэх мэтээр шүүнэ.
  app.get('/admin/orders', async (req): Promise<AdminOrder[]> => {
    const { status } = parse(z.object({ status: z.enum(['pending', 'paid', 'failed']).optional() }), req.query)
    const orders = await prisma.order.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        items: { select: { priceAtPurchase: true, course: { select: { title: true } } } },
      },
    })
    return orders.map(({ items, createdAt, ...o }) => ({
      ...o,
      createdAt: createdAt.toISOString(),
      items: items.map((i) => ({ title: i.course.title, price: i.priceAtPurchase })),
    }))
  })

  // Хичээл + бүлгүүд + видеонуудыг НЭГ дор үүсгэнэ (nested create = нэг transaction)
  app.post('/admin/courses', async (req, reply) => {
    const { sections, ...course } = parse(courseInput, req.body)

    if (await prisma.course.findUnique({ where: { slug: course.slug } })) throw validation('Энэ slug-тай хичээл байна')
    if (!(await prisma.instructor.findUnique({ where: { id: course.instructorId } }))) throw validation('Багш олдсонгүй')

    const created = await prisma.course.create({
      data: {
        ...course,
        sections: {
          create: sections.map((s, si) => ({
            order: si + 1,
            title: s.title,
            lessons: { create: s.lessons.map((l, li) => ({ ...l, order: li + 1 })) },
          })),
        },
      },
      select: { id: true, slug: true },
    })
    return reply.status(201).send(created)
  })

  // Зөвхөн илгээсэн талбаруудыг өөрчилнө (partial). Үнэ өөрчлөгдсөн ч хуучин захиалгын
  // дүн ӨӨРЧЛӨГДӨХГҮЙ — OrderItem.priceAtPurchase нь snapshot.
  app.patch<{ Params: { id: string } }>('/admin/courses/:id', async (req) => {
    const data = parse(courseInput.pick({ title: true, description: true, price: true, thumbnail: true, category: true, level: true }).partial(), req.body)
    if (Object.keys(data).length === 0) throw validation('Өөрчлөх талбар алга')
    if (!(await prisma.course.findUnique({ where: { id: req.params.id } }))) throw notFound('Хичээл олдсонгүй')

    return prisma.course.update({ where: { id: req.params.id }, data, select: { id: true, slug: true, title: true, price: true } })
  })

  /**
   * Худалдаалагдаж байгаагүй хичээлийг л устгана (бүлэг, видео нь cascade-аар хамт устана).
   * Хэн нэгэн худалдаж авсан бол 409: устгавал тэр хүний баримт, эрх эвдэрнэ.
   * Schema-д ч OrderItem → Course нь onDelete: Restrict — DB өөрөө ч хориглоно (давхар хамгаалалт).
   */
  app.delete<{ Params: { id: string } }>('/admin/courses/:id', async (req, reply) => {
    const course = await prisma.course.findUnique({ where: { id: req.params.id }, select: { _count: { select: { orderItems: true } } } })
    if (!course) throw notFound('Хичээл олдсонгүй')
    if (course._count.orderItems > 0) throw conflict('Худалдаалагдсан хичээлийг устгах боломжгүй')

    await prisma.course.delete({ where: { id: req.params.id } })
    return reply.status(204).send()
  })

  /**
   * Борлуулалтын тайлан. groupBy = SQL-ийн GROUP BY: мөр бүрийг биш, бүлгээр нь тоолно.
   * Орлогыг priceAtPurchase-аар тооцно (тухайн үеийн үнэ), одоогийн үнээр БИШ.
   */
  app.get('/admin/reports/sales', async (): Promise<SalesReport> => {
    const [byStatus, paidItems] = await Promise.all([
      prisma.order.groupBy({ by: ['status'], _count: { _all: true }, _sum: { total: true } }),
      prisma.orderItem.groupBy({
        by: ['courseId'],
        where: { order: { status: 'paid' } },
        _count: { _all: true },
        _sum: { priceAtPurchase: true },
        orderBy: { _sum: { priceAtPurchase: 'desc' } },
      }),
    ])
    const titles = new Map(
      (await prisma.course.findMany({ where: { id: { in: paidItems.map((i) => i.courseId) } }, select: { id: true, title: true } })).map(
        (c) => [c.id, c.title],
      ),
    )
    const paid = byStatus.find((s) => s.status === 'paid')

    return {
      revenue: paid?._sum.total ?? 0,
      orders: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      topCourses: paidItems.map((i) => ({
        courseId: i.courseId,
        title: titles.get(i.courseId) ?? '(устсан)',
        sold: i._count._all,
        revenue: i._sum.priceAtPurchase ?? 0,
      })),
    }
  })
}
