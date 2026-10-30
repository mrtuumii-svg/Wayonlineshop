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

let n = 0
/** Хэрэглэгч бүртгүүлээд (хүсвэл админ болгоод) токены толгойг буцаана */
async function userHeaders(admin = false): Promise<{ authorization: string }> {
  const email = `user${++n}@example.com`
  const res = await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'Тест', email, password: 'secret1' } })
  if (admin) await prisma.user.update({ where: { email }, data: { role: 'admin' } })
  return { authorization: `Bearer ${res.json().token}` }
}

const newCourse = (over: object = {}) => ({
  slug: 'python-ekhlel',
  title: 'Python эхлэл',
  description: 'Python-ий үндэс',
  price: 45000,
  thumbnail: 'https://picsum.photos/seed/python/640/360',
  category: 'Програмчлал',
  level: 'beginner',
  instructorId: 'i1',
  sections: [{ title: 'Танилцуулга', lessons: [{ title: 'Суулгах', durationSec: 300, isPreview: true, youtubeId: 'aqz-KE-bpKQ' }] }],
  ...over,
})

const order = async (headers: { authorization: string }, courseIds: string[]) =>
  (await app.inject({ method: 'POST', url: '/orders', headers, payload: { courseIds } })).json() as { orderId: string }

describe('эрх', () => {
  it('нэвтрээгүй → 401, энгийн хэрэглэгч → 403, админ → 200', async () => {
    expect((await app.inject('/admin/users')).statusCode).toBe(401)
    expect((await app.inject({ url: '/admin/users', headers: await userHeaders() })).statusCode).toBe(403)
    expect((await app.inject({ url: '/admin/users', headers: await userHeaders(true) })).statusCode).toBe(200)
  })

  it('бүх админ route хамгаалагдсан (энгийн хэрэглэгч → 403)', async () => {
    const user = await userHeaders()
    const calls = [
      { method: 'GET', url: '/admin/orders' },
      { method: 'GET', url: '/admin/instructors' },
      { method: 'GET', url: '/admin/reports/sales' },
      { method: 'PATCH', url: '/admin/users/x', payload: { role: 'admin' } },
      { method: 'POST', url: '/admin/courses', payload: newCourse() },
      { method: 'PATCH', url: '/admin/courses/c1', payload: { price: 1 } },
      { method: 'DELETE', url: '/admin/courses/c1' },
    ] as const
    for (const c of calls) expect((await app.inject({ ...c, headers: user })).statusCode, `${c.method} ${c.url}`).toBe(403)
    expect((await prisma.course.findUniqueOrThrow({ where: { id: 'c1' } })).price).toBe(49000)
  })

  it('нэвтрэх, /auth/me хариунд role ирнэ', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'А', email: 'adm@example.com', password: 'secret1' } })
    await prisma.user.update({ where: { email: 'adm@example.com' }, data: { role: 'admin' } })

    const login = (await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'adm@example.com', password: 'secret1' } })).json()
    expect(login.user.role).toBe('admin')
    const me = (await app.inject({ url: '/auth/me', headers: { authorization: `Bearer ${login.token}` } })).json()
    expect(me.role).toBe('admin')
  })

  it('админ эрхийг хассан бол хуучин токен ч шууд 403', async () => {
    const headers = await userHeaders(true)
    await prisma.user.updateMany({ where: { role: 'admin' }, data: { role: 'user' } })
    expect((await app.inject({ url: '/admin/users', headers })).statusCode).toBe(403)
  })

  it('бүртгүүлэхдээ role илгээсэн ч админ болохгүй', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'Х', email: 'h@example.com', password: 'secret1', role: 'admin' } })
    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'h@example.com' } })).role).toBe('user')
  })
})

describe('хэрэглэгчид', () => {
  it('жагсаалтад passwordHash байхгүй', async () => {
    const res = await app.inject({ url: '/admin/users', headers: await userHeaders(true) })
    expect(res.body).not.toContain('passwordHash')
    expect(res.body).not.toContain('$argon2')
  })

  it('бусдыг админ болгоно, өөрийгөө админаас хасах → 409', async () => {
    const admin = await userHeaders(true)
    await userHeaders()
    const users = (await app.inject({ url: '/admin/users', headers: admin })).json() as { id: string; role: string }[]
    const normal = users.find((u) => u.role === 'user')!
    const me = users.find((u) => u.role === 'admin')!

    const res = await app.inject({ method: 'PATCH', url: `/admin/users/${normal.id}`, headers: admin, payload: { role: 'admin' } })
    expect(res.json()).toMatchObject({ id: normal.id, role: 'admin', createdAt: expect.any(String) })

    const self = await app.inject({ method: 'PATCH', url: `/admin/users/${me.id}`, headers: admin, payload: { role: 'user' } })
    expect(self.statusCode).toBe(409)
    expect(self.json().code).toBe('CONFLICT')
  })
})

describe('хичээл', () => {
  it('нэмэх: бүлэг, видеотой нь нэг дор үүсч каталогт гарна', async () => {
    const res = await app.inject({ method: 'POST', url: '/admin/courses', headers: await userHeaders(true), payload: newCourse() })
    expect(res.statusCode).toBe(201)

    const course = (await app.inject('/courses/python-ekhlel')).json()
    expect(course.sections[0].lessons[0]).toMatchObject({ title: 'Суулгах', youtubeId: 'aqz-KE-bpKQ' })
  })

  it.each([
    ['давхардсан slug', { slug: 'react-ekhlel' }, 'slug'],
    ['буруу slug', { slug: 'Python Эхлэл' }, 'slug'],
    ['сөрөг үнэ', { price: -1 }, 'сөрөг'],
    ['байхгүй багш', { instructorId: 'zzz' }, 'Багш'],
    ['бүлэггүй', { sections: [] }, 'бүлэг'],
  ])('нэмэх: %s → 400', async (_name, over, msg) => {
    const res = await app.inject({ method: 'POST', url: '/admin/courses', headers: await userHeaders(true), payload: newCourse(over) })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain(msg)
  })

  it('засах — SNAPSHOT: хуучин захиалгын дүн өөрчлөгдөхгүй, шинэ нь шинэ үнээр', async () => {
    const old = await order(await userHeaders(), ['c1'])

    const res = await app.inject({ method: 'PATCH', url: '/admin/courses/c1', headers: await userHeaders(true), payload: { price: 39000 } })
    expect(res.json().price).toBe(39000)

    const oldOrder = await prisma.order.findUniqueOrThrow({ where: { id: old.orderId }, include: { items: true } })
    expect(oldOrder.total).toBe(49000)
    expect(oldOrder.items[0]?.priceAtPurchase).toBe(49000)
    const fresh = await order(await userHeaders(), ['c1'])
    expect((await prisma.order.findUniqueOrThrow({ where: { id: fresh.orderId } })).total).toBe(39000)
  })

  it('засах: хоосон → 400, байхгүй хичээл → 404', async () => {
    const admin = await userHeaders(true)
    expect((await app.inject({ method: 'PATCH', url: '/admin/courses/c1', headers: admin, payload: {} })).statusCode).toBe(400)
    expect((await app.inject({ method: 'PATCH', url: '/admin/courses/zzz', headers: admin, payload: { price: 1 } })).statusCode).toBe(404)
  })

  it('устгах: худалдаалагдаагүй → 204, бүлэг/видео нь хамт устна', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/admin/courses/c8', headers: await userHeaders(true) })
    expect(res.statusCode).toBe(204)
    expect(await prisma.course.count({ where: { id: 'c8' } })).toBe(0)
    expect(await prisma.section.count({ where: { courseId: 'c8' } })).toBe(0)
  })

  it('устгах: захиалагдсан хичээл → 409, хичээл хэвээр', async () => {
    await order(await userHeaders(), ['c1'])
    const res = await app.inject({ method: 'DELETE', url: '/admin/courses/c1', headers: await userHeaders(true) })
    expect(res.statusCode).toBe(409)
    expect(await prisma.course.count({ where: { id: 'c1' } })).toBe(1)
  })
})

describe('захиалга, тайлан', () => {
  it('захиалгын жагсаалт: хэрэглэгч, хичээлийн нэртэй, төлөвөөр шүүнэ', async () => {
    await order(await userHeaders(), ['c1'])
    const admin = await userHeaders(true)

    const all = (await app.inject({ url: '/admin/orders', headers: admin })).json()
    expect(all[0]).toMatchObject({ status: 'pending', total: 49000, user: { name: 'Тест' }, items: [{ title: 'React эхлэл', price: 49000 }] })
    expect((await app.inject({ url: '/admin/orders?status=paid', headers: admin })).json()).toEqual([])
    expect((await app.inject({ url: '/admin/orders?status=bad', headers: admin })).statusCode).toBe(400)
  })

  it('тайлан: зөвхөн төлөгдсөнийг орлогод тооцож, хичээлээр бүлэглэнэ', async () => {
    const make = async (courseIds: string[], status: 'paid' | 'pending') => {
      const { orderId } = await order(await userHeaders(), courseIds)
      await prisma.order.update({ where: { id: orderId }, data: { status } })
    }
    await make(['c1', 'c2'], 'paid')
    await make(['c1'], 'paid')
    await make(['c3'], 'pending')
    const prices = Object.fromEntries((await prisma.course.findMany({ select: { id: true, price: true } })).map((c) => [c.id, c.price]))

    const report = (await app.inject({ url: '/admin/reports/sales', headers: await userHeaders(true) })).json()

    expect(report.revenue).toBe(prices.c1! * 2 + prices.c2!)
    expect(report.orders).toEqual({ paid: 2, pending: 1 })
    expect(report.topCourses[0]).toMatchObject({ courseId: 'c1', sold: 2, revenue: prices.c1! * 2 })
  })

  it('багш нарын жагсаалт', async () => {
    const list = (await app.inject({ url: '/admin/instructors', headers: await userHeaders(true) })).json()
    expect(list.length).toBe(await prisma.instructor.count())
  })
})
