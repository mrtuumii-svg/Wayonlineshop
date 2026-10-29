import type { FastifyInstance } from 'fastify'
import { seed } from '../../prisma/seed.js'
import { createTestPrisma, resetDb } from '../test/db.js'
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

const get = (url: string, token?: string) =>
  app.inject({ method: 'GET', url, headers: token ? { authorization: `Bearer ${token}` } : {} })

const ids = (body: { items: { id: string }[] }) => body.items.map((c) => c.id).sort()

async function registerUser(email = 'buyer@example.com'): Promise<{ id: string; token: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { name: 'Худалдан авагч', email, password: 'secret123' },
  })
  const { user, token } = res.json()
  return { id: user.id, token }
}

/** Төлөгдсөн захиалга + эрх — Phase 6-ийн webhook-ийн үр дүнг шууд DB-д бичнэ */
async function enroll(userId: string, courseId: string) {
  const order = await prisma.order.create({
    data: { userId, total: 0, status: 'paid', provider: 'test', items: { create: { courseId, priceAtPurchase: 0 } } },
  })
  await prisma.enrollment.create({ data: { userId, courseId, orderId: order.id } })
}

describe('GET /courses', () => {
  it('анхдагч: эхний хуудас, 12 хүртэл, нийт тоотой', async () => {
    const res = await get('/courses')

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ total: 8, page: 1, limit: 12 })
    expect(body.items).toHaveLength(8)
  })

  it('CourseSummary хэлбэртэй — хичээлийн тоо, нийт хугацааг тооцоолно', async () => {
    const body = (await get('/courses?q=react')).json()

    expect(body.items).toEqual([
      {
        id: 'c1',
        slug: 'react-ekhlel',
        title: 'React эхлэл',
        price: 49000,
        thumbnail: expect.any(String),
        category: 'Програмчлал',
        level: 'beginner',
        instructor: { name: 'Б. Тэмүүлэн', avatar: expect.any(String) },
        lessonCount: 3,
        totalDurationSec: 307 + 420 + 615,
      },
    ])
  })

  it('жагсаалт видеоны ID, sections, тайлбар, bio-г хэзээ ч тараахгүй', async () => {
    const res = await get('/courses?limit=50')
    expect(res.statusCode).toBe(200)
    expect(res.json().items).toHaveLength(8)

    for (const key of ['youtubeId', 'sections', 'description', 'bio', 'videoUrl']) {
      expect(res.body).not.toContain(`"${key}"`)
    }
  })

  it.each([
    ['category=Дизайн', ['c2', 'c5']],
    ['level=advanced', ['c4']],
    ['maxPrice=40000', ['c2', 'c8']],
    ['category=Програмчлал&level=beginner', ['c1']],
    ['category=Маркетинг&maxPrice=50000', ['c7']],
  ])('шүүлт %s', async (query, expected) => {
    const body = (await get(`/courses?${encodeURI(query)}`)).json()
    expect(ids(body)).toEqual(expected)
    expect(body.total).toBe(expected.length)
  })

  it.each([
    ['гарчгаар', 'react', ['c1']],
    ['тайлбараар', 'persona', ['c5']],
    ['багшийн нэрээр', 'номин', ['c6', 'c7']],
    ['категориор', 'англи хэл', ['c8']],
    ['кирилл том үсгээр', 'МАРКЕТИНГ', ['c6', 'c7']],
    ['монгол Ү үсэг том/жижиг', 'ҮНДЭС', ['c2']],
    ['латин том үсгээр', 'TYPESCRIPT', ['c3']],
    ['хоосон зайтай', '  react  ', ['c1']],
  ])('q хайлт %s', async (_label, q, expected) => {
    const body = (await get(`/courses?q=${encodeURIComponent(q)}`)).json()
    expect(ids(body)).toEqual(expected)
  })

  it('q дахь LIKE-ийн тусгай тэмдэгтүүд (%, _) шууд утгаараа хайгдана', async () => {
    expect((await get('/courses?q=%25')).json().total).toBe(0)
    expect((await get('/courses?q=_')).json().total).toBe(0)
  })

  it('q-г шүүлттэй хослуулна', async () => {
    const body = (await get(`/courses?q=${encodeURIComponent('сарнай')}&level=intermediate`)).json()
    expect(ids(body)).toEqual(['c5'])
  })

  it('хуудаслалт тогтвортой дараалалтай — хуудас давхцахгүй, бүгдийг хамарна', async () => {
    const seen: string[] = []
    for (let page = 1; page <= 3; page++) {
      const body = (await get(`/courses?limit=3&page=${page}`)).json()
      expect(body).toMatchObject({ total: 8, page, limit: 3 })
      seen.push(...body.items.map((c: { id: string }) => c.id))
    }
    expect(seen).toHaveLength(8)
    expect(new Set(seen).size).toBe(8)
  })

  it('хэтэрсэн хуудас → хоосон жагсаалт, нийт тоо хэвээр', async () => {
    const body = (await get('/courses?page=99')).json()
    expect(body).toMatchObject({ items: [], total: 8, page: 99 })
  })

  it.each(['limit=51', 'limit=0', 'page=0', 'page=1.5', 'level=expert', 'maxPrice=-1', 'maxPrice=abc'])(
    '%s → 400 VALIDATION',
    async (query) => {
      const res = await get(`/courses?${query}`)
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe('VALIDATION')
    },
  )
})

describe('GET /courses/by-ids', () => {
  it('хүссэн дарааллаар summary буцаана, байхгүй ID-г алгасна', async () => {
    const res = await get('/courses/by-ids?ids=c3,nope,c1')

    expect(res.statusCode).toBe(200)
    expect(res.json().map((c: { id: string }) => c.id)).toEqual(['c3', 'c1'])
    expect(res.body).not.toContain('"youtubeId"')
  })

  it('хоосон → []', async () => {
    expect((await get('/courses/by-ids?ids=')).json()).toEqual([])
    expect((await get('/courses/by-ids')).json()).toEqual([])
  })

  it('50-аас олон ID → 400', async () => {
    const many = Array.from({ length: 51 }, (_, i) => `x${i}`).join(',')
    const res = await get(`/courses/by-ids?ids=${many}`)
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /courses/:slug', () => {
  type L = { id: string; isPreview: boolean; youtubeId?: string }
  const lessonsOf = (body: { sections: { lessons: L[] }[] }) => body.sections.flatMap((s) => s.lessons)

  it('бүлэг, хичээлүүдийг дарааллаар нь, багшийн bio-той буцаана', async () => {
    const res = await get('/courses/react-ekhlel')

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({
      id: 'c1',
      slug: 'react-ekhlel',
      description: expect.stringContaining('React'),
      instructor: { name: 'Б. Тэмүүлэн', avatar: expect.any(String), bio: expect.any(String) },
    })
    expect(body.sections.map((s: { title: string }) => s.title)).toEqual(['Танилцуулга', 'Компонент'])
    expect(lessonsOf(body).map((l) => l.id)).toEqual(['l1', 'l2', 'l3'])
  })

  it('нэвтрээгүй: зөвхөн preview хичээлд youtubeId байна', async () => {
    const body = (await get('/courses/react-ekhlel')).json()
    const [l1, l2, l3] = lessonsOf(body)

    expect(l1).toMatchObject({ isPreview: true, youtubeId: expect.stringMatching(/^[\w-]{11}$/) })
    expect(l2).not.toHaveProperty('youtubeId')
    expect(l3).not.toHaveProperty('youtubeId')
  })

  it('худалдаж аваагүй нэвтэрсэн хэрэглэгч: preview биш хичээлд youtubeId байхгүй', async () => {
    const { token } = await registerUser()
    const lessons = lessonsOf((await get('/courses/react-ekhlel', token)).json())

    expect(lessons.filter((l) => !l.isPreview).every((l) => !('youtubeId' in l))).toBe(true)
  })

  it('эзэмшигч: бүх хичээлд youtubeId байна', async () => {
    const { id, token } = await registerUser()
    await enroll(id, 'c1')

    const lessons = lessonsOf((await get('/courses/react-ekhlel', token)).json())
    expect(lessons.every((l) => /^[\w-]{11}$/.test(l.youtubeId ?? ''))).toBe(true)
  })

  it('өөр хичээлийн эзэмшигч энэ хичээлийн видеог авахгүй', async () => {
    const { id, token } = await registerUser()
    await enroll(id, 'c2')

    const lessons = lessonsOf((await get('/courses/react-ekhlel', token)).json())
    expect(lessons.filter((l) => !l.isPreview).some((l) => 'youtubeId' in l)).toBe(false)
  })

  it('төлөгдөөгүй захиалга эрх өгөхгүй (эрх нь зөвхөн Enrollment-ээс)', async () => {
    const { id, token } = await registerUser()
    await prisma.order.create({
      data: { userId: id, total: 49000, status: 'pending', provider: 'test', items: { create: { courseId: 'c1', priceAtPurchase: 49000 } } },
    })

    const lessons = lessonsOf((await get('/courses/react-ekhlel', token)).json())
    expect(lessons.filter((l) => !l.isPreview).some((l) => 'youtubeId' in l)).toBe(false)
  })

  it('хүчингүй токентой ч нийтийн хуудас нээгдэнэ (нэвтрээгүй мэт)', async () => {
    const res = await get('/courses/react-ekhlel', 'garbage-token')

    expect(res.statusCode).toBe(200)
    expect(lessonsOf(res.json()).filter((l) => !l.isPreview).some((l) => 'youtubeId' in l)).toBe(false)
  })

  it('байхгүй slug → 404 NOT_FOUND', async () => {
    const res = await get('/courses/baikhgui')
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 'NOT_FOUND', message: 'Хичээл олдсонгүй' })
  })
})

describe('GET /categories', () => {
  it('хичээлтэй категориудыг давхардалгүй буцаана', async () => {
    const res = await get('/categories')

    expect(res.statusCode).toBe(200)
    expect([...res.json()].sort()).toEqual(['Англи хэл', 'Дизайн', 'Маркетинг', 'Програмчлал'])
  })
})
