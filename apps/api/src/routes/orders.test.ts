import type { FastifyInstance } from 'fastify'
import { seed } from '../../prisma/seed.js'
import { signFakeWebhook } from '../payments/fake.js'
import { createTestPrisma, resetDb } from '../test/db.js'
import { buildTestApp, testConfig } from '../test/testApp.js'

const prisma = createTestPrisma()
const SECRET = testConfig().PAYMENT_WEBHOOK_SECRET
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

async function registerUser(email = 'buyer@example.com'): Promise<{ id: string; token: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { name: 'Худалдан авагч', email, password: 'secret123' },
  })
  const { user, token } = res.json()
  return { id: user.id, token }
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` })

const checkout = (token: string | null, courseIds: unknown) =>
  app.inject({ method: 'POST', url: '/orders', headers: token ? auth(token) : {}, payload: { courseIds } })

const getOrder = (token: string, id: string) => app.inject({ method: 'GET', url: `/orders/${id}`, headers: auth(token) })

async function invoiceIdOf(orderId: string): Promise<string> {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
  return o.providerInvoiceId!
}

function webhook(invoiceId: string, status: 'paid' | 'failed' = 'paid', signature = signFakeWebhook(SECRET, invoiceId, status)) {
  return app.inject({
    method: 'POST',
    url: '/payments/webhook',
    headers: { 'x-fake-signature': signature },
    payload: { invoiceId, status },
  })
}

describe('POST /orders', () => {
  it('нэвтрээгүй → 401', async () => {
    const res = await checkout(null, ['c1'])
    expect(res.statusCode).toBe(401)
  })

  it('pending захиалга + QR буцаана, үнийг серверээс тооцно', async () => {
    const { id, token } = await registerUser()
    const before = Date.now()

    const res = await checkout(token, ['c1', 'c2'])

    expect(res.statusCode).toBe(201)
    const intent = res.json()
    expect(intent).toMatchObject({
      orderId: expect.any(String),
      status: 'pending',
      qr: { text: expect.any(String), image: expect.stringMatching(/^data:image\//) },
    })
    const expiresAt = Date.parse(intent.expiresAt)
    expect(expiresAt).toBeGreaterThan(before + 9 * 60_000)
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 10 * 60_000)

    const order = await prisma.order.findUniqueOrThrow({ where: { id: intent.orderId }, include: { items: true } })
    expect(order).toMatchObject({ userId: id, status: 'pending', total: 49000 + 39000, provider: 'fake' })
    expect(order.providerInvoiceId).toBeTruthy()
    expect(order.items.map((i) => [i.courseId, i.priceAtPurchase]).sort()).toEqual([['c1', 49000], ['c2', 39000]])
  })

  it('клиентээс ирсэн үнэ/дүнг үл тооно', async () => {
    const { token } = await registerUser()
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: auth(token),
      payload: { courseIds: ['c1'], total: 1, price: 1 },
    })

    expect(res.statusCode).toBe(201)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.json().orderId } })
    expect(order.total).toBe(49000)
  })

  it('давхардсан болон байхгүй ID-г хасна', async () => {
    const { token } = await registerUser()
    const res = await checkout(token, ['c1', 'c1', 'nope'])

    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.json().orderId }, include: { items: true } })
    expect(order.items.map((i) => i.courseId)).toEqual(['c1'])
    expect(order.total).toBe(49000)
  })

  it('аль хэдийн эзэмшсэн хичээлийг захиалгаас хасна', async () => {
    const { token } = await registerUser()
    const first = (await checkout(token, ['c1'])).json()
    await webhook(await invoiceIdOf(first.orderId))

    const res = await checkout(token, ['c1', 'c2'])

    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.json().orderId }, include: { items: true } })
    expect(order.items.map((i) => i.courseId)).toEqual(['c2'])
    expect(order.total).toBe(39000)
  })

  it('бүгдийг эзэмшсэн бол → 400', async () => {
    const { token } = await registerUser()
    const first = (await checkout(token, ['c1'])).json()
    await webhook(await invoiceIdOf(first.orderId))

    const res = await checkout(token, ['c1'])
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ code: 'VALIDATION', message: 'Худалдаж авах хичээл алга' })
  })

  it.each([
    ['хоосон сагс', []],
    ['зөвхөн байхгүй хичээл', ['nope']],
    ['массив биш', 'c1'],
    ['50-аас олон', Array.from({ length: 51 }, (_, i) => `x${i}`)],
  ])('%s → 400 VALIDATION', async (_label, courseIds) => {
    const { token } = await registerUser()
    const res = await checkout(token, courseIds)

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('VALIDATION')
    expect(await prisma.order.count()).toBe(0)
  })
})

describe('GET /orders/:id', () => {
  it('өөрийн захиалгын статусыг буцаана', async () => {
    const { token } = await registerUser()
    const { orderId } = (await checkout(token, ['c2', 'c1'])).json()

    const res = await getOrder(token, orderId)

    expect(res.statusCode).toBe(200)
    const order = res.json()
    expect(order).toMatchObject({ id: orderId, total: 88000, status: 'pending' })
    expect([...order.courseIds].sort()).toEqual(['c1', 'c2'])
  })

  it('бусдын захиалга → 404 (байгаа эсэхийг ч таниулахгүй)', async () => {
    const alice = await registerUser('alice@example.com')
    const bob = await registerUser('bob@example.com')
    const { orderId } = (await checkout(alice.token, ['c1'])).json()

    const res = await getOrder(bob.token, orderId)
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 'NOT_FOUND', message: 'Захиалга олдсонгүй' })
  })

  it('байхгүй ID → 404', async () => {
    const { token } = await registerUser()
    expect((await getOrder(token, 'baikhgui')).statusCode).toBe(404)
  })

  it('нэвтрээгүй → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/orders/whatever' })
    expect(res.statusCode).toBe(401)
  })

  it('нэхэмжлэхийн хугацаа дууссан pending захиалга → failed', async () => {
    const { token } = await registerUser()
    const { orderId } = (await checkout(token, ['c1'])).json()
    await prisma.order.update({ where: { id: orderId }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } })

    expect((await getOrder(token, orderId)).json().status).toBe('failed')
  })
})

describe('POST /payments/webhook', () => {
  it('paid → захиалга paid болж эрх (enrollment) үүснэ', async () => {
    const { id, token } = await registerUser()
    const { orderId } = (await checkout(token, ['c1', 'c2'])).json()

    const res = await webhook(await invoiceIdOf(orderId))

    expect(res.statusCode).toBe(200)
    expect((await getOrder(token, orderId)).json().status).toBe('paid')
    const enrolled = await prisma.enrollment.findMany({ where: { userId: id } })
    expect(enrolled.map((e) => e.courseId).sort()).toEqual(['c1', 'c2'])
    expect(enrolled.every((e) => e.orderId === orderId)).toBe(true)
  })

  it('төлөгдсөний дараа хичээлийн бүх видео нээгдэнэ', async () => {
    const { token } = await registerUser()
    const { orderId } = (await checkout(token, ['c1'])).json()
    await webhook(await invoiceIdOf(orderId))

    const course = (await app.inject({ method: 'GET', url: '/courses/react-ekhlel', headers: auth(token) })).json()
    const lessons = course.sections.flatMap((s: { lessons: { youtubeId?: string }[] }) => s.lessons)
    expect(lessons.every((l: { youtubeId?: string }) => !!l.youtubeId)).toBe(true)
  })

  it('ижил webhook 2 удаа ирэхэд эрх давхардахгүй (idempotent)', async () => {
    const { id, token } = await registerUser()
    const { orderId } = (await checkout(token, ['c1'])).json()
    const invoiceId = await invoiceIdOf(orderId)

    const [a, b] = await Promise.all([webhook(invoiceId), webhook(invoiceId)])
    const c = await webhook(invoiceId)

    expect([a.statusCode, b.statusCode, c.statusCode]).toEqual([200, 200, 200])
    expect(await prisma.enrollment.count({ where: { userId: id } })).toBe(1)
  })

  it('хоёр өөр захиалгаар ижил хичээл төлөгдвөл эрх нэг л байна', async () => {
    const { id, token } = await registerUser()
    const first = (await checkout(token, ['c1'])).json()
    const second = (await checkout(token, ['c1'])).json()

    await webhook(await invoiceIdOf(first.orderId))
    const res = await webhook(await invoiceIdOf(second.orderId))

    expect(res.statusCode).toBe(200)
    expect(await prisma.enrollment.count({ where: { userId: id, courseId: 'c1' } })).toBe(1)
  })

  it.each([
    ['буруу гарын үсэг', () => 'deadbeef'],
    ['өөр түлхүүрээр зурсан', (inv: string) => signFakeWebhook('another-secret-that-is-long-enough!!', inv, 'paid')],
    ['хоосон гарын үсэг', () => ''],
  ])('%s → 400, статус хөдлөхгүй', async (_label, sign) => {
    const { token } = await registerUser()
    const { orderId } = (await checkout(token, ['c1'])).json()
    const invoiceId = await invoiceIdOf(orderId)

    const res = await webhook(invoiceId, 'paid', sign(invoiceId))

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('VALIDATION')
    expect((await getOrder(token, orderId)).json().status).toBe('pending')
    expect(await prisma.enrollment.count()).toBe(0)
  })

  it('"failed" гэсэн гарын үсгээр "paid" илгээвэл → 400', async () => {
    const { token } = await registerUser()
    const { orderId } = (await checkout(token, ['c1'])).json()
    const invoiceId = await invoiceIdOf(orderId)

    const res = await webhook(invoiceId, 'paid', signFakeWebhook(SECRET, invoiceId, 'failed'))
    expect(res.statusCode).toBe(400)
    expect(await prisma.enrollment.count()).toBe(0)
  })

  it('failed → захиалга failed, эрх үүсэхгүй', async () => {
    const { token } = await registerUser()
    const { orderId } = (await checkout(token, ['c1'])).json()

    const res = await webhook(await invoiceIdOf(orderId), 'failed')

    expect(res.statusCode).toBe(200)
    expect((await getOrder(token, orderId)).json().status).toBe('failed')
    expect(await prisma.enrollment.count()).toBe(0)
  })

  it('paid болсон захиалгыг дараагийн failed webhook буцаахгүй', async () => {
    const { token } = await registerUser()
    const { orderId } = (await checkout(token, ['c1'])).json()
    const invoiceId = await invoiceIdOf(orderId)
    await webhook(invoiceId)

    await webhook(invoiceId, 'failed')

    expect((await getOrder(token, orderId)).json().status).toBe('paid')
    expect(await prisma.enrollment.count()).toBe(1)
  })

  it('хугацаа дууссаны дараа төлбөр орж ирвэл эрх өгнө (мөнгө авсан)', async () => {
    const { token } = await registerUser()
    const { orderId } = (await checkout(token, ['c1'])).json()
    await prisma.order.update({ where: { id: orderId }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } })
    expect((await getOrder(token, orderId)).json().status).toBe('failed')

    await webhook(await invoiceIdOf(orderId))

    expect((await getOrder(token, orderId)).json().status).toBe('paid')
    expect(await prisma.enrollment.count()).toBe(1)
  })

  it('танихгүй нэхэмжлэх → 404', async () => {
    const res = await webhook('unknown-invoice')
    expect(res.statusCode).toBe(404)
  })
})

describe('fake провайдерын автомат төлбөр (dev)', () => {
  it('FAKE_PAY_AFTER_MS-ийн дараа захиалга өөрөө paid болно', async () => {
    await app.close()
    app = await buildTestApp({ FAKE_PAY_AFTER_MS: 50 })
    await app.ready()
    const { token } = await registerUser()
    const { orderId } = (await checkout(token, ['c1'])).json()

    let status = 'pending'
    for (let i = 0; i < 40 && status === 'pending'; i++) {
      await new Promise((r) => setTimeout(r, 50))
      status = (await getOrder(token, orderId)).json().status
    }
    expect(status).toBe('paid')
  })

  it('апп хаагдахад хүлээгдэж буй автомат төлбөр цуцлагдана', async () => {
    await app.close()
    app = await buildTestApp({ FAKE_PAY_AFTER_MS: 200 })
    await app.ready()
    const { token } = await registerUser()
    const { orderId } = (await checkout(token, ['c1'])).json()

    await app.close()
    await new Promise((r) => setTimeout(r, 400))

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.status).toBe('pending')
    app = await buildTestApp()
    await app.ready()
  })
})
