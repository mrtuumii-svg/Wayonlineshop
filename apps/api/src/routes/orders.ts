import type { Order, PaymentIntent } from '@way/contract'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../auth/requireAuth.js'
import { notFound, validation } from '../errors.js'

/** Нэхэмжлэхийн хүчинтэй хугацаа. Дууссан pending захиалга `failed` болно. */
export const INVOICE_TTL_MS = 10 * 60 * 1000
const MAX_ITEMS = 50

const checkoutBody = z.object({
  courseIds: z
    .array(z.string().min(1).max(64), 'Сагс буруу байна')
    .min(1, 'Сагс хоосон байна')
    .max(MAX_ITEMS, `Нэг удаад ${MAX_ITEMS}-аас олон хичээл авах боломжгүй`),
})

const expiresAt = (createdAt: Date) => new Date(createdAt.getTime() + INVOICE_TTL_MS)

export const orderRoutes: FastifyPluginAsync = async (app) => {
  const { prisma, payments } = app

  app.post('/orders', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = checkoutBody.safeParse(req.body)
    if (!parsed.success) throw validation(parsed.error.issues[0]?.message ?? 'Хүсэлтийн өгөгдөл буруу байна')
    const userId = req.user!.id
    const ids = [...new Set(parsed.data.courseIds)]

    // Үнийг ЗӨВХӨН серверээс авна. Аль хэдийн эзэмшсэн хичээлийг хасна.
    const courses = await prisma.course.findMany({
      where: { id: { in: ids }, enrollments: { none: { userId } } },
      select: { id: true, price: true },
      orderBy: { id: 'asc' },
    })
    if (courses.length === 0) throw validation('Худалдаж авах хичээл алга')

    const order = await prisma.order.create({
      data: {
        userId,
        total: courses.reduce((sum, c) => sum + c.price, 0),
        provider: payments.name,
        items: { create: courses.map((c) => ({ courseId: c.id, priceAtPurchase: c.price })) },
      },
    })

    let invoice
    try {
      invoice = await payments.createInvoice({ orderId: order.id, amount: order.total })
    } catch (err) {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'failed' } })
      throw err
    }
    await prisma.order.update({ where: { id: order.id }, data: { providerInvoiceId: invoice.invoiceId } })

    const intent: PaymentIntent = {
      orderId: order.id,
      status: 'pending',
      qr: invoice.qr,
      expiresAt: expiresAt(order.createdAt).toISOString(),
    }
    return reply.status(201).send(intent)
  })

  app.get<{ Params: { id: string } }>('/orders/:id', { preHandler: requireAuth }, async (req): Promise<Order> => {
    // Бусдын захиалгыг 403 биш 404 гэж хэлнэ — байгаа эсэхийг ч таниулахгүй
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { items: { select: { courseId: true } } },
    })
    if (!order) throw notFound('Захиалга олдсонгүй')

    let status = order.status
    if (status === 'pending' && expiresAt(order.createdAt).getTime() <= Date.now()) {
      // Энэ хооронд webhook paid болгосон байж болох тул зөвхөн pending-ийг л failed болгоно
      const { count } = await prisma.order.updateMany({
        where: { id: order.id, status: 'pending' },
        data: { status: 'failed' },
      })
      status = count > 0 ? 'failed' : (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status
    }

    return { id: order.id, courseIds: order.items.map((i) => i.courseId), total: order.total, status }
  })

  app.post('/payments/webhook', async (req) => {
    const { invoiceId, paid } = await payments.verifyWebhook({ body: req.body, headers: req.headers })

    const order = await prisma.order.findUnique({
      where: { providerInvoiceId: invoiceId },
      include: { items: { select: { courseId: true } } },
    })
    if (!order) throw notFound('Нэхэмжлэх олдсонгүй')

    if (paid) {
      // Мөнгө орсон бол хугацаа дууссан (failed) захиалгад ч эрх өгнө.
      // createMany + skipDuplicates (ON CONFLICT DO NOTHING) — давтан/зэрэг ирсэн webhook эрхийг давхардуулахгүй.
      await prisma.$transaction([
        prisma.order.update({ where: { id: order.id }, data: { status: 'paid' } }),
        prisma.enrollment.createMany({
          data: order.items.map((i) => ({ userId: order.userId, courseId: i.courseId, orderId: order.id })),
          skipDuplicates: true,
        }),
      ])
    } else {
      // Төлөгдсөн захиалгыг хожуу ирсэн "failed" буцааж болохгүй
      await prisma.order.updateMany({ where: { id: order.id, status: { not: 'paid' } }, data: { status: 'failed' } })
    }

    return { ok: true }
  })
}
