import { lessonCount, progressPercent, resumeLessonId, totalDurationSec } from '@/lib/courseStats'
import type { ApiClient } from '../client'
import { ApiError } from '../errors'
import type { Course, CourseSummary, MyCourse, Order, OrderStatus, User } from '../types'
import { categories, courses } from './fixtures'
import { readJson, writeJson } from './storage'

const USERS_KEY = 'way.mock.users'
const ORDERS_KEY = 'way.mock.orders'
const PROGRESS_KEY = 'way.mock.progress'

const PAGE_LIMIT_DEFAULT = 12
const PAGE_LIMIT_MAX = 50
const INVOICE_TTL_MS = 10 * 60 * 1000

interface StoredUser extends User {
  password: string
}

/** `polls` нь fake провайдерын "хэдэн удаа шалгасан" тоолуур. */
type StoredOrder = Order & { userId: string; polls: number }

export interface MockApiOptions {
  storage: Storage
  getToken: () => string | null
  /** Хоцрол (ms): тоо эсвэл [min, max] санамсаргүй. 0 бол хоцролгүй. */
  delay?: number | [number, number]
  /**
   * Fake төлбөр: `getOrder`-ийн хэдэн дуудлагын ДАРАА `paid` болох.
   * 0 (анхдагч) бол эхний шалгалтад төлөгдсөн байна. Асинхрон бүтэц
   * (pending → шалгах → paid) хэвээр хэрэгжинэ, зөвхөн хугацаа нь тэг.
   */
  payAfterPolls?: number
}

const normalize = (s: string) => s.trim().toLocaleLowerCase('mn')

/** Зөвхөн жагсаалтад шаардлагатай талбарууд. `sections`, `youtubeId`, багшийн bio энд хэзээ ч ирэхгүй. */
function toSummary(c: Course): CourseSummary {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    price: c.price,
    thumbnail: c.thumbnail,
    category: c.category,
    level: c.level,
    instructor: { name: c.instructor.name, avatar: c.instructor.avatar },
    lessonCount: lessonCount(c),
    totalDurationSec: totalDurationSec(c),
  }
}

function fakeQr(orderId: string): { text: string; image: string } {
  const text = `way-mock-invoice:${orderId}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#fff"/><rect x="8" y="8" width="24" height="24" fill="#0f172a"/><rect x="64" y="8" width="24" height="24" fill="#0f172a"/><rect x="8" y="64" width="24" height="24" fill="#0f172a"/><rect x="44" y="44" width="12" height="12" fill="#0f172a"/></svg>`
  return { text, image: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }
}

export interface MockApi extends ApiClient {
  /**
   * Гадны провайдер (QPay) төлбөрийг баталгаажуулсны дараа захиалгыг `paid` болгоно.
   * Бодит backend-д энэ нь webhook-ийн үүрэг.
   */
  markOrderPaid(orderId: string): void
}

export function createMockApi(opts: MockApiOptions): MockApi {
  const { delay = [200, 500], payAfterPolls = 0 } = opts

  async function wait() {
    const ms = Array.isArray(delay) ? delay[0] + Math.random() * (delay[1] - delay[0]) : delay
    if (ms > 0) await new Promise((r) => setTimeout(r, ms))
    else await Promise.resolve()
  }

  const users = () => readJson<StoredUser[]>(opts.storage, USERS_KEY, [])
  const publicUser = ({ id, name, email }: StoredUser): User => ({ id, name, email })
  const session = (u: StoredUser) => ({ user: publicUser(u), token: `mock-token-${u.id}` })

  /** Токеноор хэрэглэгчийг олно, олдохгүй бол UNAUTHORIZED */
  function requireUser(): User {
    const token = opts.getToken()
    const u = token ? users().find((x) => `mock-token-${x.id}` === token) : undefined
    if (!u) throw new ApiError('UNAUTHORIZED', 'Нэвтэрнэ үү')
    return publicUser(u)
  }

  const orders = () => readJson<StoredOrder[]>(opts.storage, ORDERS_KEY, [])
  const progressMap = () => readJson<Record<string, string[]>>(opts.storage, PROGRESS_KEY, {})
  const publicOrder = ({ id, courseIds, total, status }: StoredOrder): Order => ({ id, courseIds, total, status })

  /** Эрх нь ЗӨВХӨН төлөгдсөн захиалгаас гарна. */
  function ownedIds(userId: string): Set<string> {
    return new Set(
      orders()
        .filter((o) => o.userId === userId && o.status === 'paid')
        .flatMap((o) => o.courseIds),
    )
  }

  function isOwned(courseId: string): boolean {
    try {
      return ownedIds(requireUser().id).has(courseId)
    } catch {
      return false
    }
  }

  /** Нэвтэрсэн бөгөөд хичээлийг худалдаж авсан байх ёстой */
  function requireOwned(courseId: string): { user: User; course: Course } {
    const user = requireUser()
    const course = courses.find((c) => c.id === courseId)
    if (!course) throw new ApiError('NOT_FOUND', 'Хичээл олдсонгүй')
    if (!ownedIds(user.id).has(courseId)) throw new ApiError('FORBIDDEN', 'Энэ хичээлийг худалдаж авна уу')
    return { user, course }
  }

  /** Худалдаж аваагүй, preview биш хичээлийн youtubeId-г нууна */
  function present(course: Course): Course {
    const copy = structuredClone(course)
    if (isOwned(copy.id)) return copy
    for (const section of copy.sections) {
      for (const l of section.lessons) {
        if (!l.isPreview) delete l.youtubeId
      }
    }
    return copy
  }

  function toMyCourse(c: Course, userId: string): MyCourse {
    const completed = progressMap()[`${userId}:${c.id}`] ?? []
    return {
      ...toSummary(c),
      progressPercent: progressPercent(c, completed),
      resumeLessonId: resumeLessonId(c, completed),
      completedLessonIds: completed,
    }
  }

  return {
    async getCourses(filter = {}) {
      const page = filter.page ?? 1
      const limit = filter.limit ?? PAGE_LIMIT_DEFAULT
      if (!Number.isInteger(page) || page < 1) {
        throw new ApiError('VALIDATION', 'Хуудасны дугаар буруу байна')
      }
      if (!Number.isInteger(limit) || limit < 1 || limit > PAGE_LIMIT_MAX) {
        throw new ApiError('VALIDATION', `Хуудасны хэмжээ 1–${PAGE_LIMIT_MAX} хооронд байх ёстой`)
      }
      await wait()

      const q = filter.q ? normalize(filter.q) : ''
      const matched = courses
        .filter((c) => !filter.category || c.category === filter.category)
        .filter((c) => !filter.level || c.level === filter.level)
        .filter((c) => filter.maxPrice === undefined || c.price <= filter.maxPrice)
        .filter(
          (c) =>
            !q || [c.title, c.description, c.category, c.instructor.name].some((t) => normalize(t).includes(q)),
        )

      const start = (page - 1) * limit
      return { items: matched.slice(start, start + limit).map(toSummary), total: matched.length, page, limit }
    },

    async getCoursesByIds(ids) {
      if (ids.length === 0) return []
      await wait()
      const want = new Set(ids)
      return courses.filter((c) => want.has(c.id)).map(toSummary)
    },

    async getCourse(slug) {
      await wait()
      const c = courses.find((x) => x.slug === slug)
      if (!c) throw new ApiError('NOT_FOUND', 'Хичээл олдсонгүй')
      return present(c)
    },

    async getCategories() {
      await wait()
      return [...categories]
    },

    async register({ name, email, password }) {
      await wait()
      const all = users()
      const normalized = email.trim().toLowerCase()
      if (all.some((u) => u.email === normalized)) {
        throw new ApiError('VALIDATION', 'Энэ имэйл бүртгэлтэй байна')
      }
      const u: StoredUser = { id: crypto.randomUUID(), name: name.trim(), email: normalized, password }
      writeJson(opts.storage, USERS_KEY, [...all, u])
      return session(u)
    },

    async login({ email, password }) {
      await wait()
      const normalized = email.trim().toLowerCase()
      const u = users().find((x) => x.email === normalized && x.password === password)
      if (!u) throw new ApiError('UNAUTHORIZED', 'Имэйл эсвэл нууц үг буруу байна')
      return session(u)
    },

    async getMe() {
      await wait()
      return requireUser()
    },

    async checkout(courseIds) {
      await wait()
      const user = requireUser()
      const owned = ownedIds(user.id)
      // fixtures-ийн дарааллаар шүүх нь давхардсан id-г дам арилгана
      const toBuy = courses.filter((c) => courseIds.includes(c.id) && !owned.has(c.id))
      if (toBuy.length === 0) throw new ApiError('VALIDATION', 'Худалдаж авах хичээл алга')

      const order: StoredOrder = {
        id: crypto.randomUUID(),
        userId: user.id,
        courseIds: toBuy.map((c) => c.id),
        total: toBuy.reduce((sum, c) => sum + c.price, 0),
        status: 'pending',
        polls: 0,
      }
      writeJson(opts.storage, ORDERS_KEY, [...orders(), order])

      return {
        orderId: order.id,
        status: 'pending',
        qr: fakeQr(order.id),
        expiresAt: new Date(Date.now() + INVOICE_TTL_MS).toISOString(),
      }
    },

    async getOrder(orderId) {
      await wait()
      const user = requireUser()
      const all = orders()
      // Бусдын захиалгыг FORBIDDEN биш NOT_FOUND гэж хэлнэ — байгаа эсэхийг ч таниулахгүй
      const i = all.findIndex((o) => o.id === orderId && o.userId === user.id)
      if (i === -1) throw new ApiError('NOT_FOUND', 'Захиалга олдсонгүй')

      const found = all[i]!
      if (found.status !== 'pending') return publicOrder(found)

      const polls = found.polls + 1
      const status: OrderStatus = polls > payAfterPolls ? 'paid' : 'pending'
      const next: StoredOrder = { ...found, polls, status }
      writeJson(
        opts.storage,
        ORDERS_KEY,
        all.map((o, j) => (j === i ? next : o)),
      )
      return publicOrder(next)
    },

    markOrderPaid(orderId) {
      const all = orders()
      writeJson(
        opts.storage,
        ORDERS_KEY,
        all.map((o) => (o.id === orderId && o.status === 'pending' ? { ...o, status: 'paid' as const } : o)),
      )
    },

    async getMyCourses() {
      await wait()
      const user = requireUser()
      const owned = ownedIds(user.id)
      return courses.filter((c) => owned.has(c.id)).map((c) => toMyCourse(c, user.id))
    },

    async getProgress(courseId) {
      await wait()
      const { user } = requireOwned(courseId)
      return { courseId, completedLessonIds: progressMap()[`${user.id}:${courseId}`] ?? [] }
    },

    async markLessonComplete(courseId, lessonId) {
      await wait()
      const { user, course } = requireOwned(courseId)
      if (!course.sections.some((s) => s.lessons.some((l) => l.id === lessonId))) {
        throw new ApiError('NOT_FOUND', 'Хичээл олдсонгүй')
      }
      const map = progressMap()
      const key = `${user.id}:${courseId}`
      const done = map[key] ?? []
      const next = done.includes(lessonId) ? map : { ...map, [key]: [...done, lessonId] }
      writeJson(opts.storage, PROGRESS_KEY, next)
      return { courseId, completedLessonIds: next[key] ?? done }
    },

    /** Mock-д AI байхгүй — бодит хариуг `VITE_API_MODE=http` горимд авна */
    async chat() {
      await wait()
      return { reply: 'Туслах зөвхөн бодит API-тай (VITE_API_MODE=http) ажиллана.' }
    },
  }
}
