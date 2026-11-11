import type { PrismaClient } from '../db.js'

/**
 * Захиалгыг `paid` болгож эрх (enrollment) олгоно. Webhook, QPay callback, polling гурвуулаа үүгээр дамжина.
 * Мөнгө орсон бол хугацаа дууссан (failed) захиалгад ч эрх өгнө.
 * createMany + skipDuplicates (ON CONFLICT DO NOTHING) — давтан/зэрэг дуудлага эрхийг давхардуулахгүй.
 */
export async function settleOrder(
  prisma: PrismaClient,
  order: { id: string; userId: string; items: { courseId: string }[] },
): Promise<void> {
  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: 'paid' } }),
    prisma.enrollment.createMany({
      data: order.items.map((i) => ({ userId: order.userId, courseId: i.courseId, orderId: order.id })),
      skipDuplicates: true,
    }),
  ])
}
