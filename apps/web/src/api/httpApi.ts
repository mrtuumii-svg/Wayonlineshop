import type { ApiClient, AuthResult } from './client'
import { ApiError } from './errors'
import type {
  ApiErrorCode,
  Course,
  CourseFilter,
  CourseSummary,
  MyCourse,
  Order,
  Paginated,
  PaymentIntent,
  Progress,
  User,
} from './types'

const CODES: readonly ApiErrorCode[] = ['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'RATE_LIMITED', 'UNKNOWN']

/** Серверийн бие танигдахгүй үед (прокси, gateway алдаа г.м.) HTTP статусаас код гаргана */
function codeFromStatus(status: number): ApiErrorCode {
  if (status === 400) return 'VALIDATION'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 429) return 'RATE_LIMITED'
  return 'UNKNOWN'
}

const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  VALIDATION: 'Хүсэлт буруу байна',
  UNAUTHORIZED: 'Нэвтэрнэ үү',
  FORBIDDEN: 'Танд хандах эрх байхгүй',
  NOT_FOUND: 'Олдсонгүй',
  RATE_LIMITED: 'Хэт олон хүсэлт. Хэсэг хүлээгээд дахин оролдоно уу.',
  UNKNOWN: 'Алдаа гарлаа. Дахин оролдоно уу.',
}

const REQUEST_TIMEOUT_MS = 15_000

export interface HttpApiOptions {
  /** Жишээ нь `/api` (dev proxy) эсвэл `https://api.way.mn` */
  baseUrl: string
  /** Хүсэлт бүрт шинээр уншина — нэвтэрсэн/гарсны дараа шууд үйлчилнэ */
  getToken: () => string | null
  fetchFn?: typeof fetch
}

const seg = encodeURIComponent

/** Backend (`apps/api`)-тай HTTP-ээр харилцах `ApiClient`. Төлбөрийг провайдер баталгаажуулдаг тул `simulatePayment` байхгүй. */
export function createHttpApi(opts: HttpApiOptions): ApiClient {
  const base = opts.baseUrl.replace(/\/+$/, '')
  const fetchFn = opts.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a))

  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const headers = new Headers()
    const token = opts.getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (body !== undefined) headers.set('Content-Type', 'application/json')

    let res: Response
    try {
      res = await fetchFn(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (e) {
      // instanceof DOMException биш — орчин бүр (браузер, Node, jsdom) өөр DOMException класстай
      const name = (e as { name?: unknown } | null)?.name
      const timedOut = name === 'TimeoutError' || name === 'AbortError'
      throw new ApiError('UNKNOWN', timedOut ? 'Сервер хариу өгсөнгүй. Дахин оролдоно уу.' : 'Сүлжээний алдаа. Дахин оролдоно уу.')
    }

    const data: unknown = await res.json().catch(() => undefined)
    if (!res.ok) {
      const err = (data ?? {}) as { code?: unknown; message?: unknown }
      const code = CODES.includes(err.code as ApiErrorCode) ? (err.code as ApiErrorCode) : codeFromStatus(res.status)
      const message = typeof err.message === 'string' && err.message ? err.message : DEFAULT_MESSAGE[code]
      throw new ApiError(code, message)
    }
    if (data === undefined) throw new ApiError('UNKNOWN', DEFAULT_MESSAGE.UNKNOWN)
    return data as T
  }

  const get = <T>(path: string) => request<T>('GET', path)
  const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body)

  return {
    getCourses(filter: CourseFilter = {}) {
      const params = new URLSearchParams()
      for (const [k, v] of Object.entries(filter)) {
        if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
      }
      const qs = params.toString()
      return get<Paginated<CourseSummary>>(`/courses${qs ? `?${qs}` : ''}`)
    },

    async getCoursesByIds(ids) {
      if (ids.length === 0) return []
      return get<CourseSummary[]>(`/courses/by-ids?${new URLSearchParams({ ids: ids.join(',') })}`)
    },

    getCourse: (slug) => get<Course>(`/courses/${seg(slug)}`),
    getCategories: () => get<string[]>('/categories'),

    register: (input) => post<AuthResult>('/auth/register', input),
    login: (input) => post<AuthResult>('/auth/login', input),
    getMe: () => get<User>('/auth/me'),

    checkout: (courseIds) => post<PaymentIntent>('/orders', { courseIds }),
    getOrder: (orderId) => get<Order>(`/orders/${seg(orderId)}`),

    getMyCourses: () => get<MyCourse[]>('/me/courses'),
    getProgress: (courseId) => get<Progress>(`/me/progress/${seg(courseId)}`),
    markLessonComplete: (courseId, lessonId) =>
      post<Progress>(`/me/progress/${seg(courseId)}/lessons/${seg(lessonId)}`),
  }
}
