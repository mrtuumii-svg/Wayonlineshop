import { useAuthStore } from '@/features/auth/authStore'
import { ApiError } from '@/api/errors'
import { createApi } from '@/api/createApi'
import { createQueryClient } from './queryClient'

test('UNAUTHORIZED query error triggers onUnauthorized', async () => {
  const onUnauth = vi.fn()
  const qc = createQueryClient(onUnauth, { retry: false })
  await qc
    .fetchQuery({ queryKey: ['x'], queryFn: () => Promise.reject(new ApiError('UNAUTHORIZED', 'x')) })
    .catch(() => {})
  expect(onUnauth).toHaveBeenCalledOnce()
})

test('other errors do not trigger onUnauthorized', async () => {
  const onUnauth = vi.fn()
  const qc = createQueryClient(onUnauth, { retry: false })
  await qc.fetchQuery({ queryKey: ['y'], queryFn: () => Promise.reject(new ApiError('NOT_FOUND', 'x')) }).catch(() => {})
  expect(onUnauth).not.toHaveBeenCalled()
})

test('UNAUTHORIZED mutation error triggers onUnauthorized', async () => {
  const onUnauth = vi.fn()
  const qc = createQueryClient(onUnauth, { retry: false })
  const m = qc.getMutationCache().build(qc, { mutationFn: () => Promise.reject(new ApiError('UNAUTHORIZED', 'x')) })
  await m.execute(undefined).catch(() => {})
  expect(onUnauth).toHaveBeenCalledOnce()
})

test('createApi http mode talks to VITE_API_URL with the stored token', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('["Дизайн"]', { status: 200 }))
  try {
    useAuthStore.setState({ token: 'stored-token' })
    const api = createApi({ VITE_API_MODE: 'http', VITE_API_URL: 'https://api.way.test' })

    expect(await api.getCategories()).toEqual(['Дизайн'])
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://api.way.test/categories')
    expect(new Headers(init!.headers).get('authorization')).toBe('Bearer stored-token')
    // Төлбөрийг backend-ийн провайдер баталгаажуулна — туршилтын товч харагдахгүй
    expect(api.simulatePayment).toBeUndefined()
  } finally {
    fetchSpy.mockRestore()
    useAuthStore.setState({ token: null })
  }
})

test('createApi http mode defaults to the /api dev proxy', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }))
  try {
    await createApi({ VITE_API_MODE: 'http' }).getCategories()
    expect(fetchSpy.mock.calls[0]![0]).toBe('/api/categories')
  } finally {
    fetchSpy.mockRestore()
  }
})

test('createApi rejects an unknown mode', () => {
  expect(() => createApi({ VITE_API_MODE: 'grpc' })).toThrow(/VITE_API_MODE/)
})

test('createApi defaults to mock', async () => {
  const api = createApi({ VITE_MOCK_DELAY: '0' })
  expect(await api.getCategories()).toHaveLength(4)
})
