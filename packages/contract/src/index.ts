/**
 * Frontend болон backend хоёрын хуваалцдаг API гэрээ.
 * Хоёр тал зөрвөл build шууд унана — гэрээг нэг эх сурвалжид байлгах нь гол зорилго.
 */

export type Level = 'beginner' | 'intermediate' | 'advanced'

export interface Lesson {
  id: string
  title: string
  durationSec: number
  isPreview: boolean
  /** Зөвхөн preview эсвэл худалдаж авсан хичээлд ирнэ (mock) */
  videoUrl?: string
  /** YouTube-ийн 11 тэмдэгтийн ID. Зөвхөн preview эсвэл худалдаж авсан хичээлд ирнэ (backend) */
  youtubeId?: string
}

export interface Section {
  id: string
  title: string
  lessons: Lesson[]
}

export interface Course {
  id: string
  slug: string
  title: string
  description: string
  /** Төгрөгөөр, бүхэл тоо */
  price: number
  thumbnail: string
  category: string
  level: Level
  instructor: { name: string; avatar: string; bio: string }
  sections: Section[]
}

/**
 * Каталог/сагс/миний хичээлүүдийн жагсаалтад хэрэглэгдэх хөнгөн хувилбар.
 * `sections` зориуд байхгүй — жагсаалтын хуудсанд хэрэггүй бөгөөд өгөгдлийг
 * шаардлагагүй хүндрүүлнэ. Видеоны ID ч хэзээ ч энд ирэхгүй.
 */
export interface CourseSummary {
  id: string
  slug: string
  title: string
  /** Төгрөгөөр, бүхэл тоо */
  price: number
  thumbnail: string
  category: string
  level: Level
  instructor: { name: string; avatar: string }
  lessonCount: number
  totalDurationSec: number
}

/** Худалдаж авсан хичээл — явцыг сервер тооцоолж хамт буцаана (N+1 хүсэлт гарахгүй). */
export interface MyCourse extends CourseSummary {
  /** 0–100 бүхэл тоо */
  progressPercent: number
  /** Эхний дуусаагүй хичээл; хичээл байхгүй бол null */
  resumeLessonId: string | null
  completedLessonIds: string[]
}

export interface Paginated<T> {
  items: T[]
  /** Шүүлтэд тохирсон нийт тоо (хуудаслахаас өмнө) */
  total: number
  page: number
  limit: number
}

export interface User {
  id: string
  name: string
  email: string
}

/** Бүртгүүлэх/нэвтрэхийн хариу. Токеныг `Authorization: Bearer <token>` толгойд илгээнэ. */
export interface AuthResult {
  user: User
  token: string
}

export type OrderStatus = 'pending' | 'paid' | 'failed'

export interface Order {
  id: string
  courseIds: string[]
  total: number
  status: OrderStatus
}

/**
 * Төлбөр нь асинхрон: захиалга `pending`-ээр үүсч, QR уншуулсны дараа
 * провайдер webhook дуудаж `paid` болгоно. Клиент `getOrder`-оор статусыг хянана.
 */
export interface PaymentIntent {
  orderId: string
  status: 'pending'
  qr: { text: string; image: string }
  /** ISO. Хугацаа дуусвал захиалга `failed` болно. */
  expiresAt: string
}

export interface Progress {
  courseId: string
  completedLessonIds: string[]
}

export interface CourseFilter {
  q?: string
  category?: string
  level?: Level
  maxPrice?: number
  /** 1-ээс эхэлнэ */
  page?: number
  limit?: number
}

/**
 * Сервер болон клиентийн алдааны нэгдсэн код. HTTP status-тай 1:1 тааруулагдана:
 * VALIDATION→400, UNAUTHORIZED→401, FORBIDDEN→403, NOT_FOUND→404,
 * RATE_LIMITED→429, UNKNOWN→500.
 */
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'UNKNOWN'
