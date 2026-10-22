import { ApiError } from './errors'
import { createHttpApi } from './httpApi'

type Call = { url: string; init: RequestInit }

function setup(responses: (Response | Error)[], token: string | null = 'tok') {
  const calls: Call[] = []
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const next = responses.shift()
    if (!next) throw new Error('хүлээгээгүй хүсэлт')
    // Response биш бүхнийг шидэгдсэн алдаа гэж үзнэ (jsdom-ийн DOMException нь Error-ийн instance биш)
    if (!(next instanceof Response)) throw next
    return next
  })
  const api = createHttpApi({ baseUrl: 'https://api.test/v', getToken: () => token, fetchFn })
  return { api, calls, fetchFn }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const headersOf = (c: Call) => new Headers(c.init.headers)

async function expectApiError(p: Promise<unknown>, code: string, message?: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(ApiError)
  expect((err as ApiError).code).toBe(code)
  if (message) expect((err as ApiError).message).toBe(message)
}

describe('хүсэлт угсралт', () => {
  test('getCourses: хоосон/undefined шүүлтийг алгасаж query string угсарна', async () => {
    const page = { items: [], total: 0, page: 2, limit: 6 }
    const { api, calls } = setup([json(page)])

    expect(await api.getCourses({ q: 'реакт & js', category: '', level: 'beginner', maxPrice: 50000, page: 2, limit: 6 })).toEqual(page)

    const url = new URL(calls[0]!.url)
    expect(url.origin + url.pathname).toBe('https://api.test/v/courses')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'реакт & js',
      level: 'beginner',
      maxPrice: '50000',
      page: '2',
      limit: '6',
    })
    expect(calls[0]!.init.method ?? 'GET').toBe('GET')
  })

  test('getCoursesByIds: хоосон бол сервер рүү хандахгүй', async () => {
    const { api, fetchFn } = setup([])
    expect(await api.getCoursesByIds([])).toEqual([])
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('getCoursesByIds: ID-уудыг таслалаар нийлүүлнэ', async () => {
    const { api, calls } = setup([json([])])
    await api.getCoursesByIds(['c1', 'c 2'])
    expect(new URL(calls[0]!.url).searchParams.get('ids')).toBe('c1,c 2')
  })

  test('замын параметрийг encode хийнэ (slug, id)', async () => {
    const { api, calls } = setup([json({}), json({}), json({})])
    await api.getCourse('a/b?c')
    await api.getOrder('../x')
    await api.markLessonComplete('c#1', 'l/2')
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.test/v/courses/a%2Fb%3Fc',
      'https://api.test/v/orders/..%2Fx',
      'https://api.test/v/me/progress/c%231/lessons/l%2F2',
    ])
    expect(calls[2]!.init.method).toBe('POST')
  })

  test.each([
    ['getCategories', (a: ReturnType<typeof createHttpApi>) => a.getCategories(), 'GET', '/categories', undefined],
    ['getMe', (a: ReturnType<typeof createHttpApi>) => a.getMe(), 'GET', '/auth/me', undefined],
    ['getMyCourses', (a: ReturnType<typeof createHttpApi>) => a.getMyCourses(), 'GET', '/me/courses', undefined],
    ['getProgress', (a: ReturnType<typeof createHttpApi>) => a.getProgress('c1'), 'GET', '/me/progress/c1', undefined],
    ['checkout', (a: ReturnType<typeof createHttpApi>) => a.checkout(['c1', 'c2']), 'POST', '/orders', { courseIds: ['c1', 'c2'] }],
    [
      'login',
      (a: ReturnType<typeof createHttpApi>) => a.login({ email: 'a@b.mn', password: 'secret1' }),
      'POST',
      '/auth/login',
      { email: 'a@b.mn', password: 'secret1' },
    ],
    [
      'register',
      (a: ReturnType<typeof createHttpApi>) => a.register({ name: 'Бат', email: 'a@b.mn', password: 'secret1' }),
      'POST',
      '/auth/register',
      { name: 'Бат', email: 'a@b.mn', password: 'secret1' },
    ],
  ] as const)('%s → %s %s', async (_name, call, method, path, body) => {
    const { api, calls } = setup([json({ ok: true })])
    await call(api)

    expect(calls[0]!.url).toBe(`https://api.test/v${path}`)
    expect(calls[0]!.init.method ?? 'GET').toBe(method)
    if (body) {
      expect(JSON.parse(String(calls[0]!.init.body))).toEqual(body)
      expect(headersOf(calls[0]!).get('content-type')).toBe('application/json')
    } else {
      expect(calls[0]!.init.body).toBeUndefined()
    }
  })

  test('токен байвал Bearer header илгээнэ, үгүй бол илгээхгүй', async () => {
    const withToken = setup([json([])], 'abc')
    await withToken.api.getCategories()
    expect(headersOf(withToken.calls[0]!).get('authorization')).toBe('Bearer abc')

    const anonymous = setup([json([])], null)
    await anonymous.api.getCategories()
    expect(headersOf(anonymous.calls[0]!).has('authorization')).toBe(false)
  })

  test('токеныг хүсэлт бүрт шинээр уншина (нэвтэрсний дараа)', async () => {
    let token: string | null = null
    const fetchFn = vi.fn<typeof fetch>(async () => json([]))
    const api = createHttpApi({ baseUrl: '/api', getToken: () => token, fetchFn })
    await api.getCategories()
    token = 'new'
    await api.getCategories()
    expect(new Headers(fetchFn.mock.calls[1]![1]!.headers).get('authorization')).toBe('Bearer new')
  })

  test('харьцангуй baseUrl ("/api") болон төгсгөлийн "/"-ийг зөв нийлүүлнэ', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json([]))
    await createHttpApi({ baseUrl: '/api/', getToken: () => null, fetchFn }).getCategories()
    expect(fetchFn.mock.calls[0]![0]).toBe('/api/categories')
  })

  test('backend-д simulatePayment байхгүй (провайдер өөрөө баталгаажуулна)', () => {
    const { api } = setup([])
    expect(api.simulatePayment).toBeUndefined()
  })
})

describe('алдааны хөрвүүлэлт', () => {
  test('серверийн { code, message }-ийг тэр чигээр нь ApiError болгоно', async () => {
    const { api } = setup([json({ code: 'VALIDATION', message: 'Энэ имэйл бүртгэлтэй байна' }, 400)])
    await expectApiError(api.register({ name: 'a', email: 'a@b.mn', password: 'secret1' }), 'VALIDATION', 'Энэ имэйл бүртгэлтэй байна')
  })

  test.each([
    [400, 'VALIDATION'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [429, 'RATE_LIMITED'],
    [500, 'UNKNOWN'],
    [502, 'UNKNOWN'],
  ])('бие нь JSON биш %i → %s', async (status, code) => {
    const { api } = setup([new Response('<html>Bad Gateway</html>', { status })])
    await expectApiError(api.getCategories(), code)
  })

  test('танихгүй code ирвэл HTTP статусаас тодорхойлно', async () => {
    const { api } = setup([json({ code: 'SOMETHING_NEW', message: 'x' }, 403)])
    await expectApiError(api.getCategories(), 'FORBIDDEN')
  })

  test('сүлжээний алдаа → UNKNOWN, ойлгомжтой мессежтэй', async () => {
    const { api } = setup([new TypeError('Failed to fetch')])
    await expectApiError(api.getCategories(), 'UNKNOWN', 'Сүлжээний алдаа. Дахин оролдоно уу.')
  })

  test('хугацаа хэтэрвэл → UNKNOWN', async () => {
    const { api } = setup([new DOMException('timeout', 'TimeoutError')])
    await expectApiError(api.getCategories(), 'UNKNOWN', 'Сервер хариу өгсөнгүй. Дахин оролдоно уу.')
  })

  test('амжилттай статустай ч JSON биш хариу → UNKNOWN', async () => {
    const { api } = setup([new Response('not json', { status: 200 })])
    await expectApiError(api.getCategories(), 'UNKNOWN')
  })
})
