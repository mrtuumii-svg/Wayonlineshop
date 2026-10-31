import type { Order, PaymentIntent } from '@way/contract'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../auth/requireAuth.js'
import { AppError, notFound, unavailable, validation } from '../errors.js'
import { createCheckThrottle } from '../payments/checkThrottle.js'
import { QPAY_CALLBACK_PATH } from '../payments/qpay.js'
import { settleOrder } from '../payments/settle.js'

/** Нэхэмжлэхийн хүчинтэй хугацаа. Дууссан pending захиалга `failed` болно. */
export const INVOICE_TTL_MS = 10 * 60 * 1000
const MAX_ITEMS = 50

const checkoutBody = z.object({
  courseIds: z
    .array(z.string().min(1).max(64), 'Сагс буруу байна')
    .min(1, 'Сагс хоосон байна')
    .max(MAX_ITEMS, `Нэг удаад ${MAX_ITEMS}-аас олон хичээл авах боломжгүй`),
})

const callbackQuery = z.object({ order: z.string().min(1).max(64) })

export const QPAY_UNAVAILABLE = 'QPay-тэй холбогдож чадсангүй. Дахин оролдоно уу.'

const expiresAt = (createdAt: Date) => new Date(createdAt.getTime() + INVOICE_TTL_MS)

export const orderRoutes: FastifyPluginAsync = async (app) => {
  const { prisma, payments } = app
  const throttle = createCheckThrottle()

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
      if (err instanceof AppError) throw err
      req.log.error({ err }, 'Төлбөрийн нэхэмжлэх үүсгэж чадсангүй')
      throw unavailable(QPAY_UNAVAILABLE)
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
    const expired = expiresAt(order.createdAt).getTime() <= Date.now()
    // Callback хүрэхгүй (localhost) эсвэл алдагдсан үед төлбөрийг провайдероос өөрөө асууна.
    // Хугацаа дуусахад throttle-оос үл хамааран сүүлийн удаа асууна — сүүлийн секундэд төлсөн мөнгө алдагдахгүй.
    let checkFailed = false
    if (
      status === 'pending' &&
      order.provider === payments.name &&
      order.providerInvoiceId &&
      (expired || throttle.shouldCheck(order.id))
    ) {
      try {
        if ((await payments.checkPayment(order.providerInvoiceId)) === 'paid') {
          await settleOrder(prisma, order)
          status = 'paid'
        }
      } catch (err) {
        req.log.error({ err }, 'Төлбөрийн статус шалгахад алдаа гарлаа')
        checkFailed = true
      }
    }

    // Шалгаж чадаагүй бол failed болгохгүй — дараагийн poll дахин оролдоно
    if (status === 'pending' && expired && !checkFailed) {
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
      await settleOrder(prisma, order)
    } else {
      // Төлөгдсөн захиалгыг хожуу ирсэн "failed" буцааж болохгүй
      await prisma.order.updateMany({ where: { id: order.id, status: { not: 'paid' } }, data: { status: 'failed' } })
    }

    return { ok: true }
  })

  // QPay-ийн callback гарын үсэггүй — агуулгад нь итгэхгүй, зөвхөн "шалгах" дохио гэж үзнэ.
  // Хуурамч callback хамгийн муудаа нэг нэмэлт шалгалт л үүсгэнэ. Callback захиалгыг хэзээ ч failed болгохгүй.
  app.route({
    method: ['GET', 'POST'],
    url: QPAY_CALLBACK_PATH,
    handler: async (req) => {
      const parsed = callbackQuery.safeParse(req.query)
      if (!parsed.success) throw notFound('Нэхэмжлэх олдсонгүй')

      const order = await prisma.order.findUnique({
        where: { id: parsed.data.order },
        include: { items: { select: { courseId: true } } },
      })
      if (!order) throw notFound('Нэхэмжлэх олдсонгүй')
      if (order.status === 'paid' || order.provider !== payments.name || !order.providerInvoiceId) return { ok: true }

      let status
      try {
        status = await payments.checkPayment(order.providerInvoiceId)
      } catch (err) {
        // 200 биш хариуд QPay callback-аа дахин илгээнэ
        req.log.error({ err }, 'QPay-ийн төлбөр шалгахад алдаа гарлаа')
        throw unavailable(QPAY_UNAVAILABLE)
      }
      if (status === 'paid') await settleOrder(prisma, order)
      return { ok: true }
    },
  })
}
