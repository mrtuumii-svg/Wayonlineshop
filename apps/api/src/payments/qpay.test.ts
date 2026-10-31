import { createQpayProvider, QpayError, type QpayProviderOptions } from './qpay.js'

const BASE = 'https://merchant-sandbox.qpay.mn'

interface Call {
  url: string
  init: RequestInit
}

type Responder = (call: Call) => Response | Promise<Response>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const tokenResponse = (expires_in = 3600) => json({ access_token: 'tok', expires_in })
const invoiceResponse = () => json({ invoice_id: 'inv_1', qr_text: 'qrtext', qr_image: 'AAAA' })

/** URL-ийн path-аар хариу сонгодог fetch stub. Дуудлага бүрийг бүртгэнэ. */
function stubFetch(routes: Record<string, Responder | Responder[]>) {
  const calls: Call[] = []
  const counters: Record<string, number> = {}
  const fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    const call = { url, init }
    calls.push(call)
    const path = new URL(url).pathname
    const r = routes[path]
    if (!r) throw new Error(`stub: ${path} тохируулаагүй`)
    if (Array.isArray(r)) {
      const i = counters[path] ?? 0
      counters[path] = i + 1
      return r[Math.min(i, r.length - 1)]!(call)
    }
    return r(call)
  }) as typeof globalThis.fetch
  const to = (path: string) => calls.filter((c) => new URL(c.url).pathname === path)
  return { fetch, calls, to }
}

const provider = (fetch: typeof globalThis.fetch, over: Partial<QpayProviderOptions> = {}) =>
  createQpayProvider({
    baseUrl: BASE,
    clientId: 'TEST_MERCHANT',
    clientSecret: '123456',
    invoiceCode: 'TEST_INVOICE',
    callbackBaseUrl: 'https://api.way.mn',
    fetch,
    ...over,
  })

const bodyOf = (c: Call) => JSON.parse(String(c.init.body))
const header = (c: Call, name: string) => new Headers(c.init.headers).get(name)

describe('createInvoice', () => {
  it('QPay-ийн invoice-ийг үүсгэж QR буцаана', async () => {
    const s = stubFetch({ '/v2/auth/token': () => tokenResponse(), '/v2/invoice': () => invoiceResponse() })

    const invoice = await provider(s.fetch).createInvoice({ orderId: 'ord_1', amount: 49000 })

    const [auth] = s.to('/v2/auth/token')
    expect(auth!.init.method).toBe('POST')
    expect(header(auth!, 'authorization')).toBe(`Basic ${Buffer.from('TEST_MERCHANT:123456').toString('base64')}`)
    const [inv] = s.to('/v2/invoice')
    expect(inv!.url).toBe(`${BASE}/v2/invoice`)
    expect(header(inv!, 'authorization')).toBe('Bearer tok')
    expect(bodyOf(inv!)).toEqual({
      invoice_code: 'TEST_INVOICE',
      sender_invoice_no: 'ord_1',
      invoice_receiver_code: 'terminal',
      invoice_description: 'Way Academy',
      amount: 49000,
      callback_url: 'https://api.way.mn/payments/qpay/callback?order=ord_1',
    })
    expect(invoice).toEqual({ invoiceId: 'inv_1', qr: { text: 'qrtext', image: 'data:image/png;base64,AAAA' } })
  })

  it('callbackBaseUrl-ийн төгсгөлийн "/"-г давхардуулахгүй', async () => {
    const s = stubFetch({ '/v2/auth/token': () => tokenResponse(), '/v2/invoice': () => invoiceResponse() })

    await provider(s.fetch, { callbackBaseUrl: 'https://api.way.mn/' }).createInvoice({ orderId: 'ord_1', amount: 1 })

    expect(bodyOf(s.to('/v2/invoice')[0]!).callback_url).toBe('https://api.way.mn/payments/qpay/callback?order=ord_1')
  })

  it('orderId-г URL-д encode хийнэ', async () => {
    const s = stubFetch({ '/v2/auth/token': () => tokenResponse(), '/v2/invoice': () => invoiceResponse() })

    await provider(s.fetch).createInvoice({ orderId: 'a&b', amount: 1 })

    expect(bodyOf(s.to('/v2/invoice')[0]!).callback_url).toBe('https://api.way.mn/payments/qpay/callback?order=a%26b')
  })
})

describe('token', () => {
  it('token-ийг cache-лэнэ', async () => {
    const s = stubFetch({ '/v2/auth/token': () => tokenResponse(), '/v2/invoice': () => invoiceResponse() })
    const p = provider(s.fetch)

    await p.createInvoice({ orderId: 'o1', amount: 1 })
    await p.createInvoice({ orderId: 'o2', amount: 1 })

    expect(s.to('/v2/auth/token')).toHaveLength(1)
  })

  it.each([
    ['үргэлжлэх секунд', () => 3600],
    ['unix секунд', () => Math.floor(Date.now() / 1000) + 3600],
  ])('expires_in-ийг %s гэж ойлгоод cache-лэнэ', async (_label, expires) => {
    const s = stubFetch({ '/v2/auth/token': () => tokenResponse(expires()), '/v2/invoice': () => invoiceResponse() })
    const p = provider(s.fetch)

    await p.createInvoice({ orderId: 'o1', amount: 1 })
    await p.createInvoice({ orderId: 'o2', amount: 1 })

    expect(s.to('/v2/auth/token')).toHaveLength(1)
  })

  it('1 минутаас бага хугацаатай token-ийг дахин ашиглахгүй', async () => {
    const s = stubFetch({ '/v2/auth/token': () => tokenResponse(30), '/v2/invoice': () => invoiceResponse() })
    const p = provider(s.fetch)

    await p.createInvoice({ orderId: 'o1', amount: 1 })
    await p.createInvoice({ orderId: 'o2', amount: 1 })

    expect(s.to('/v2/auth/token')).toHaveLength(2)
  })

  it('401 ирвэл token шинэчлээд нэг удаа дахин оролдоно', async () => {
    const s = stubFetch({
      '/v2/auth/token': () => tokenResponse(),
      '/v2/invoice': [() => json({}, 401), () => invoiceResponse()],
    })

    const invoice = await provider(s.fetch).createInvoice({ orderId: 'o1', amount: 1 })

    expect(invoice.invoiceId).toBe('inv_1')
    expect(s.to('/v2/auth/token')).toHaveLength(2)
  })

  it('дахин оролдсон ч 401 бол QpayError', async () => {
    const s = stubFetch({ '/v2/auth/token': () => tokenResponse(), '/v2/invoice': () => json({}, 401) })

    await expect(provider(s.fetch).createInvoice({ orderId: 'o1', amount: 1 })).rejects.toBeInstanceOf(QpayError)
    expect(s.to('/v2/invoice')).toHaveLength(2)
  })
})

describe('checkPayment', () => {
  const check = async (rows: { payment_status: string }[]) => {
    const s = stubFetch({
      '/v2/auth/token': () => tokenResponse(),
      '/v2/payment/check': () => json({ count: rows.length, rows }),
    })
    const status = await provider(s.fetch).checkPayment('inv_1')
    return { status, s }
  }

  it('PAID мөр байвал paid', async () => {
    const { status, s } = await check([{ payment_status: 'PAID' }])

    expect(status).toBe('paid')
    expect(bodyOf(s.to('/v2/payment/check')[0]!)).toEqual({
      object_type: 'INVOICE',
      object_id: 'inv_1',
      offset: { page_number: 1, page_limit: 100 },
    })
  })

  it('төлбөр байхгүй эсвэл төлөгдөөгүй бол pending', async () => {
    expect((await check([])).status).toBe('pending')
    expect((await check([{ payment_status: 'NEW' }])).status).toBe('pending')
  })
})

describe('алдаа', () => {
  it('OK биш хариу нь QpayError, мессежид secret байхгүй', async () => {
    const s = stubFetch({
      '/v2/auth/token': () => tokenResponse(),
      '/v2/invoice': () => json({ error: 'boom 123456 tok' }, 500),
    })

    const err = await provider(s.fetch)
      .createInvoice({ orderId: 'o1', amount: 1 })
      .catch((e: unknown) => e)

    expect(err).toBeInstanceOf(QpayError)
    const msg = (err as Error).message
    expect(msg).toContain('/v2/invoice')
    expect(msg).toContain('500')
    expect(msg).not.toContain('123456')
    expect(msg).not.toContain('tok')
  })

  it('сүлжээний алдаа нь QpayError', async () => {
    const fetch = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof globalThis.fetch

    await expect(provider(fetch).checkPayment('inv_1')).rejects.toBeInstanceOf(QpayError)
  })

  it('JSON биш хариу нь QpayError', async () => {
    const s = stubFetch({ '/v2/auth/token': () => tokenResponse(), '/v2/payment/check': () => new Response('<html>') })

    await expect(provider(s.fetch).checkPayment('inv_1')).rejects.toBeInstanceOf(QpayError)
  })

  it('timeout нь QpayError', async () => {
    const fetch = ((_url: string, init: RequestInit = {}) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal!.reason))
      })) as typeof globalThis.fetch

    await expect(provider(fetch, { timeoutMs: 20 }).checkPayment('inv_1')).rejects.toBeInstanceOf(QpayError)
  })

  it('verifyWebhook нь үргэлж VALIDATION шиднэ — QPay-ийн callback гарын үсэггүй', async () => {
    const s = stubFetch({})

    await expect(provider(s.fetch).verifyWebhook({ body: { invoiceId: 'inv_1' }, headers: {} })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
  })
})
