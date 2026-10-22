import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestPrisma, resetDb } from './db.js'

const prisma = createTestPrisma()

afterAll(async () => {
  await prisma.$disconnect()
})

describe('resetDb', () => {
  beforeEach(async () => {
    await resetDb(prisma)
  })

  it('бүх хүснэгтийг хоосолно (FK-тэй мөрүүд ч)', async () => {
    const instructor = await prisma.instructor.create({ data: { name: 'Б', avatar: 'a', bio: 'b' } })
    await prisma.course.create({
      data: {
        slug: 'x', title: 'X', description: 'd', price: 1000, thumbnail: 't',
        category: 'Програмчлал', level: 'beginner', instructorId: instructor.id,
      },
    })
    await prisma.user.create({ data: { name: 'U', email: 'u@example.com', passwordHash: 'h' } })

    await resetDb(prisma)

    expect(await prisma.course.count()).toBe(0)
    expect(await prisma.instructor.count()).toBe(0)
    expect(await prisma.user.count()).toBe(0)
  })

  it('migration-ийн түүхийг устгахгүй', async () => {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM _prisma_migrations`
    expect(Number(rows[0]?.n)).toBeGreaterThan(0)
  })
})
