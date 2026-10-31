import type { FastifyInstance } from 'fastify'
import { seed } from '../../prisma/seed.js'
import { signFakeWebhook } from '../payments/fake.js'
import { settleOrder } from '../payments/settle.js'
import { INVOICE_TTL_MS } from './orders.js'
import { createTestPrisma, resetDb } from '../test/db.js'
import { createStubProvider, type StubProvider } from '../test/stubProvider.js'
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

describe('QPay callback', () => {
  let stub: StubProvider

  beforeEach(async () => {
    await app.close()
    stub = createStubProvider()
    app = await buildTestApp({ PAYMENT_PROVIDER: 'qpay' }, { payments: stub })
    await app.ready()
  })

  const callback = (q: string, method: 'GET' | 'POST' = 'GET', payload?: object) =>
    app.inject({ method, url: `/payments/qpay/callback${q}`, ...(payload ? { payload } : {}) })

  async function pendingOrder() {
    const user = await registerUser()
    const { orderId } = (await checkout(user.token, ['c1'])).json()
    return { ...user, orderId }
  }

  const statusOf = async (orderId: string) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status

  it('QPay төлсөн гэвэл захиалга paid болж эрх үүснэ', async () => {
    const { id, orderId } = await pendingOrder()
    stub.status = 'paid'

    const res = await callback(`?order=${orderId}`)

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    expect(stub.checks).toEqual([await invoiceIdOf(orderId)])
    expect(await statusOf(orderId)).toBe('paid')
    expect(await prisma.enrollment.count({ where: { userId: id } })).toBe(1)
  })

  it('POST callback ч ажиллана', async () => {
    const { orderId } = await pendingOrder()
    stub.status = 'paid'

    const res = await callback(`?order=${orderId}`, 'POST', { payment_id: 'x' })

    expect(res.statusCode).toBe(200)
    expect(await statusOf(orderId)).toBe('paid')
  })

  it('QPay pending гэвэл юу ч өөрчлөгдөхгүй', async () => {
    const { id, orderId } = await pendingOrder()

    const res = await callback(`?order=${orderId}`)

    expect(res.statusCode).toBe(200)
    expect(await statusOf(orderId)).toBe('pending')
    expect(await prisma.enrollment.count({ where: { userId: id } })).toBe(0)
  })

  it('callback-ийн биед итгэхгүй — зөвхөн QPay API-ийн хариунд', async () => {
    const { orderId } = await pendingOrder()

    await callback(`?order=${orderId}`, 'POST', { payment_status: 'PAID', invoice_id: await invoiceIdOf(orderId) })

    expect(await statusOf(orderId)).toBe('pending')
  })

  it.each([[''], ['?order='], [`?order=${'x'.repeat(65)}`], ['?order=nope']])(
    'order байхгүй, буруу эсвэл танихгүй (%s) → 404',
    async (q) => {
      const res = await callback(q)

      expect(res.statusCode).toBe(404)
      expect(stub.checks).toEqual([])
    },
  )

  it('аль хэдийн paid захиалгад QPay дахин дуудагдахгүй', async () => {
    const { orderId } = await pendingOrder()
    stub.status = 'paid'
    await callback(`?order=${orderId}`)

    const res = await callback(`?order=${orderId}`)

    expect(res.statusCode).toBe(200)
    expect(stub.checks).toHaveLength(1)
  })

  it('өөр провайдерын (fake) захиалгад QPay дуудагдахгүй', async () => {
    const { orderId } = await pendingOrder()
    await prisma.order.update({ where: { id: orderId }, data: { provider: 'fake' } })
    stub.status = 'paid'

    const res = await callback(`?order=${orderId}`)

    expect(res.statusCode).toBe(200)
    expect(stub.checks).toEqual([])
    expect(await statusOf(orderId)).toBe('pending')
  })

  it('QPay алдаа өгвөл 503, захиалга хөдлөхгүй', async () => {
    const { orderId } = await pendingOrder()
    stub.checkError = new Error('down')

    const res = await callback(`?order=${orderId}`)

    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBe('UNAVAILABLE')
    expect(await statusOf(orderId)).toBe('pending')
  })

  it('давхар callback эрхийг давхардуулахгүй', async () => {
    const { id, orderId } = await pendingOrder()
    stub.status = 'paid'
    // Эхнийх paid болгоно; хоёр дахь нь paid-ийг алгасна. Зэрэг ирвэл доорх тест шалгана.
    await callback(`?order=${orderId}`)
    await callback(`?order=${orderId}`)

    expect(await prisma.enrollment.count({ where: { userId: id } })).toBe(1)
  })

  it('settleOrder-ийг зэрэг дуудахад эрх нэг л удаа үүснэ (callback ба poll зэрэг)', async () => {
    const { id, orderId } = await pendingOrder()
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })

    await Promise.all([settleOrder(prisma, order), settleOrder(prisma, order)])

    expect(await prisma.enrollment.count({ where: { userId: id } })).toBe(1)
    expect(await statusOf(orderId)).toBe('paid')
  })

  it('failed захиалгад QPay дуудагдахгүй — нэхэмжлэх нь цуцлагдсан', async () => {
    const { orderId } = await pendingOrder()
    await prisma.order.update({ where: { id: orderId }, data: { status: 'failed' } })

    const res = await callback(`?order=${orderId}`)

    expect(res.statusCode).toBe(200)
    expect(stub.checks).toEqual([])
  })

  it('нэг захиалгад 3 секундын дотор давтсан callback → 503 (QPay дахин илгээнэ), QPay дуудагдахгүй', async () => {
    const { orderId } = await pendingOrder()
    await callback(`?order=${orderId}`)

    const res = await callback(`?order=${orderId}`)

    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBe('UNAVAILABLE')
    expect(stub.checks).toHaveLength(1)
  })
})

describe('GET /orders/:id — провайдероос шалгах', () => {
  let stub: StubProvider

  beforeEach(async () => {
    await app.close()
    stub = createStubProvider()
    app = await buildTestApp({ PAYMENT_PROVIDER: 'qpay' }, { payments: stub })
    await app.ready()
  })

  async function pendingOrder() {
    const user = await registerUser()
    const { orderId } = (await checkout(user.token, ['c1'])).json()
    return { ...user, orderId }
  }

  const expire = (orderId: string) =>
    prisma.order.update({ where: { id: orderId }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } })

  /** Хугацаа дуусахаас 1 секундын өмнөх захиалга. Дараа нь `passSeconds`-ээр цагийг урагшлуулна. */
  const nearExpiry = (orderId: string) =>
    prisma.order.update({ where: { id: orderId }, data: { createdAt: new Date(Date.now() - INVOICE_TTL_MS + 1000) } })
  // Зөвхөн Date-ийг хуурна — таймер, сүлжээ, Prisma хэвийн ажиллана
  const passSeconds = (s: number) => vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + s * 1000 })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('QPay төлсөн бол poll paid буцааж эрх үүсгэнэ', async () => {
    const { id, token, orderId } = await pendingOrder()
    stub.status = 'paid'

    expect((await getOrder(token, orderId)).json().status).toBe('paid')
    expect(await prisma.enrollment.count({ where: { userId: id } })).toBe(1)
  })

  it('3 секундын дотор дахин poll хийхэд QPay дуудагдахгүй', async () => {
    const { token, orderId } = await pendingOrder()

    await getOrder(token, orderId)
    await getOrder(token, orderId)

    expect(stub.checks).toHaveLength(1)
  })

  it('poll үед QPay алдаа → pending, 200', async () => {
    const { token, orderId } = await pendingOrder()
    stub.checkError = new Error('down')

    const res = await getOrder(token, orderId)

    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('pending')
  })

  it('хугацаа дуусахад throttle-оос үл хамааран сүүлийн шалгалт хийнэ — төлсөн бол paid', async () => {
    const { token, orderId } = await pendingOrder()
    await nearExpiry(orderId)
    await getOrder(token, orderId)
    passSeconds(2)
    stub.status = 'paid'

    expect((await getOrder(token, orderId)).json().status).toBe('paid')
    expect(stub.checks).toHaveLength(2)
  })

  it('хугацаа дуусахад эхлээд нэхэмжлэхийг цуцалж, дараа нь шалгаад failed болгоно', async () => {
    const { token, orderId } = await pendingOrder()
    await nearExpiry(orderId)
    await getOrder(token, orderId)
    passSeconds(2)

    expect((await getOrder(token, orderId)).json().status).toBe('failed')
    expect(stub.cancels).toEqual([await invoiceIdOf(orderId)])
    // Цуцлахаас өмнө шалгавал хооронд нь орсон төлбөр алдагдана
    expect(stub.events).toEqual(['check', 'cancel', 'check'])
  })

  it('цуцалж чадаагүй бол failed болгохгүй (хожуу төлбөр орж болзошгүй)', async () => {
    const { token, orderId } = await pendingOrder()
    await expire(orderId)
    stub.cancelError = new Error('down')

    expect((await getOrder(token, orderId)).json().status).toBe('pending')
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: 'pending' })
    expect(stub.checks).toHaveLength(1)
  })

  it('цуцалж чадаагүй ч төлөгдсөн бол paid', async () => {
    const { token, orderId } = await pendingOrder()
    await expire(orderId)
    stub.cancelError = new Error('INVOICE_PAID')
    stub.status = 'paid'

    expect((await getOrder(token, orderId)).json().status).toBe('paid')
  })

  it('хугацаа дууссан ба QPay алдаа → failed болохгүй', async () => {
    const { token, orderId } = await pendingOrder()
    await expire(orderId)
    stub.checkError = new Error('down')

    expect((await getOrder(token, orderId)).json().status).toBe('pending')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('pending')
  })

  it('хугацаа дууссан ба QPay унасан үед давтан poll throttle-д баригдана', async () => {
    const { token, orderId } = await pendingOrder()
    await expire(orderId)
    stub.checkError = new Error('down')

    await getOrder(token, orderId)
    await getOrder(token, orderId)

    expect(stub.checks).toHaveLength(1)
  })

  it('өөр провайдерын захиалгыг poll хийхэд QPay дуудагдахгүй', async () => {
    const { token, orderId } = await pendingOrder()
    await prisma.order.update({ where: { id: orderId }, data: { provider: 'fake' } })

    await getOrder(token, orderId)

    expect(stub.checks).toEqual([])
  })
})

describe('POST /orders — QPay алдаа', () => {
  it('createInvoice алдаа → 503, захиалга failed', async () => {
    await app.close()
    const stub = createStubProvider()
    stub.invoiceError = new Error('down')
    app = await buildTestApp({ PAYMENT_PROVIDER: 'qpay' }, { payments: stub })
    const { id, token } = await registerUser()

    const res = await checkout(token, ['c1'])

    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ code: 'UNAVAILABLE', message: 'QPay-тэй холбогдож чадсангүй. Дахин оролдоно уу.' })
    const orders = await prisma.order.findMany({ where: { userId: id } })
    expect(orders.map((o) => o.status)).toEqual(['failed'])
  })
})
