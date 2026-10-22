import { PrismaPg } from '@prisma/adapter-pg'
import type { FastifyInstance } from 'fastify'
import { seed } from '../../prisma/seed.js'
import { PrismaClient } from '../generated/prisma/client.js'
import { createTestPrisma, resetDb, testDatabaseUrl } from '../test/db.js'
import { buildTestApp } from '../test/testApp.js'

const prisma = createTestPrisma()
let app: FastifyInstance

beforeEach(async () => {
  await resetDb(prisma)
  await seed(prisma)
  app = await buildTestApp()
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

afterAll(async () => {
  await prisma.$disconnect()
})

async function registerUser(target = app, email = 'learner@example.com'): Promise<{ id: string; token: string }> {
  const res = await target.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { name: 'Суралцагч', email, password: 'secret123' },
  })
  const { user, token } = res.json()
  return { id: user.id, token }
}

async function enroll(userId: string, ...courseIds: string[]) {
  for (const courseId of courseIds) {
    const order = await prisma.order.create({
      data: { userId, total: 0, status: 'paid', provider: 'test', items: { create: { courseId, priceAtPurchase: 0 } } },
    })
    await prisma.enrollment.create({ data: { userId, courseId, orderId: order.id } })
  }
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` })
const myCourses = (token: string, target = app) => target.inject({ method: 'GET', url: '/me/courses', headers: auth(token) })
const progress = (token: string, courseId: string) =>
  app.inject({ method: 'GET', url: `/me/progress/${courseId}`, headers: auth(token) })
const complete = (token: string, courseId: string, lessonId: string) =>
  app.inject({ method: 'POST', url: `/me/progress/${courseId}/lessons/${lessonId}`, headers: auth(token) })

describe('нэвтрэлт шаардлагатай', () => {
  it.each([
    ['GET', '/me/courses'],
    ['GET', '/me/progress/c1'],
    ['POST', '/me/progress/c1/lessons/l1'],
  ] as const)('%s %s токенгүй → 401', async (method, url) => {
    const res = await app.inject({ method, url })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /me/courses', () => {
  it('юу ч худалдаж аваагүй бол хоосон', async () => {
    const { token } = await registerUser()
    expect((await myCourses(token)).json()).toEqual([])
  })

  it('төлөгдөөгүй захиалга энд харагдахгүй', async () => {
    const { id, token } = await registerUser()
    await prisma.order.create({
      data: { userId: id, total: 49000, provider: 'test', items: { create: { courseId: 'c1', priceAtPurchase: 49000 } } },
    })
    expect((await myCourses(token)).json()).toEqual([])
  })

  it('эзэмшсэн хичээлүүдийг явцтай нь буцаана (0%, 33%, 100%)', async () => {
    const { id, token } = await registerUser()
    await enroll(id, 'c1', 'c2', 'c3')
    await complete(token, 'c1', 'l2')
    await complete(token, 'c2', 'c2l1')
    await complete(token, 'c2', 'c2l2')

    const list = (await myCourses(token)).json()
    const byId = Object.fromEntries(list.map((c: { id: string }) => [c.id, c]))

    expect(Object.keys(byId).sort()).toEqual(['c1', 'c2', 'c3'])
    expect(byId.c1).toMatchObject({
      slug: 'react-ekhlel',
      lessonCount: 3,
      totalDurationSec: 307 + 420 + 615,
      progressPercent: 33,
      resumeLessonId: 'l1',
      completedLessonIds: ['l2'],
    })
    expect(byId.c2).toMatchObject({ progressPercent: 100, resumeLessonId: 'c2l1', completedLessonIds: ['c2l1', 'c2l2'] })
    expect(byId.c3).toMatchObject({ progressPercent: 0, resumeLessonId: 'c3l1', completedLessonIds: [] })
    expect(JSON.stringify(list)).not.toContain('youtubeId')
  })

  it('бусдын явц холилдохгүй', async () => {
    const alice = await registerUser(app, 'alice@example.com')
    const bob = await registerUser(app, 'bob@example.com')
    await enroll(alice.id, 'c1')
    await enroll(bob.id, 'c1')
    await complete(alice.token, 'c1', 'l1')

    const [bobC1] = (await myCourses(bob.token)).json()
    expect(bobC1).toMatchObject({ progressPercent: 0, completedLessonIds: [] })
  })

  it('N+1 биш: хичээлийн тооноос үл хамааран query-ийн тоо тогтмол', async () => {
    let queries = 0
    const counting = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
      log: [{ emit: 'event', level: 'query' }],
    })
    counting.$on('query', () => {
      queries++
    })
    const countingApp = await buildTestApp({}, { prisma: counting })
    await countingApp.ready()

    async function queriesFor(courseIds: string[], email: string) {
      const { id, token } = await registerUser(countingApp, email)
      await enroll(id, ...courseIds)
      for (const c of courseIds) {
        const first = (await prisma.lesson.findFirstOrThrow({ where: { section: { courseId: c } } })).id
        await prisma.lessonProgress.create({ data: { userId: id, lessonId: first } })
      }
      queries = 0
      const res = await myCourses(token, countingApp)
      expect(res.json()).toHaveLength(courseIds.length)
      return queries
    }

    try {
      const one = await queriesFor(['c1'], 'one@example.com')
      const many = await queriesFor(['c1', 'c2', 'c3', 'c4', 'c5', 'c6'], 'many@example.com')
      expect(many).toBe(one)
    } finally {
      await countingApp.close()
      await counting.$disconnect()
    }
  })
})

describe('GET /me/progress/:courseId', () => {
  it('эзэмшигчид дууссан хичээлүүдийг хичээлийн дарааллаар буцаана', async () => {
    const { id, token } = await registerUser()
    await enroll(id, 'c1')
    await complete(token, 'c1', 'l3')
    await complete(token, 'c1', 'l1')

    const res = await progress(token, 'c1')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ courseId: 'c1', completedLessonIds: ['l1', 'l3'] })
  })

  it('эзэмшээгүй хичээл → 403 FORBIDDEN', async () => {
    const { token } = await registerUser()
    const res = await progress(token, 'c1')
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ code: 'FORBIDDEN', message: 'Энэ хичээлийг худалдаж авна уу' })
  })

  it('байхгүй хичээл → 404', async () => {
    const { token } = await registerUser()
    const res = await progress(token, 'baikhgui')
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 'NOT_FOUND', message: 'Хичээл олдсонгүй' })
  })
})

describe('POST /me/progress/:courseId/lessons/:lessonId', () => {
  it('хичээлийг дууссанд тэмдэглэж шинэ явцыг буцаана', async () => {
    const { id, token } = await registerUser()
    await enroll(id, 'c1')

    const res = await complete(token, 'c1', 'l2')

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ courseId: 'c1', completedLessonIds: ['l2'] })
  })

  it('ижил хичээлийг 2 удаа (зэрэг ч) тэмдэглэхэд давхардахгүй', async () => {
    const { id, token } = await registerUser()
    await enroll(id, 'c1')

    const results = await Promise.all([complete(token, 'c1', 'l1'), complete(token, 'c1', 'l1')])
    const again = await complete(token, 'c1', 'l1')

    expect([...results, again].map((r) => r.statusCode)).toEqual([200, 200, 200])
    expect(again.json()).toEqual({ courseId: 'c1', completedLessonIds: ['l1'] })
    expect(await prisma.lessonProgress.count({ where: { userId: id } })).toBe(1)
  })

  it('өөр хичээлийн lessonId → 404, юу ч бичигдэхгүй', async () => {
    const { id, token } = await registerUser()
    await enroll(id, 'c1', 'c2')

    const res = await complete(token, 'c1', 'c2l1')

    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 'NOT_FOUND', message: 'Хичээл олдсонгүй' })
    expect(await prisma.lessonProgress.count()).toBe(0)
  })

  it('байхгүй lessonId → 404', async () => {
    const { id, token } = await registerUser()
    await enroll(id, 'c1')
    const res = await complete(token, 'c1', 'nope')
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 'NOT_FOUND', message: 'Хичээл олдсонгүй' })
  })

  it('эзэмшээгүй хичээл → 403, юу ч бичигдэхгүй', async () => {
    const { token } = await registerUser()

    const res = await complete(token, 'c1', 'l1')

    expect(res.statusCode).toBe(403)
    expect(await prisma.lessonProgress.count()).toBe(0)
  })

  it('байхгүй хичээл → 404', async () => {
    const { token } = await registerUser()
    const res = await complete(token, 'baikhgui', 'l1')
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 'NOT_FOUND', message: 'Хичээл олдсонгүй' })
  })
})
