import { books, type BookSeed } from '@way/catalog'
import { ApiError } from '../errors'
import type { Book, BookFilter, BookSummary, Course, Paginated } from '../types'

/**
 * Mock-ийн номын хэсэг. Өгөгдөл нь backend-ийн seed-тэй ИЖИЛ эх сурвалжаас (@way/catalog) —
 * mock болон бодит backend зөрөхгүй. Дүрэм нь apps/api/src/routes/books.ts-тэй ижил.
 */
const PAGE_LIMIT_DEFAULT = 24
const PAGE_LIMIT_MAX = 60
const RELATED_COUNT = 6

const normalize = (s: string) => s.trim().toLocaleLowerCase('mn')

const toSummary = (b: BookSeed): BookSummary => ({
  id: b.id,
  slug: b.slug,
  title: b.title,
  author: b.author,
  category: b.category,
  year: b.year ?? null,
  coverUrl: b.coverUrl ?? null,
})

const sorted = [...books].sort((a, b) => a.title.localeCompare(b.title, 'en') || a.id.localeCompare(b.id))

export function createMockBooks(courses: Course[], wait: () => Promise<void>) {
  return {
    async getBooks(filter: BookFilter = {}): Promise<Paginated<BookSummary>> {
      const page = filter.page ?? 1
      const limit = filter.limit ?? PAGE_LIMIT_DEFAULT
      if (!Number.isInteger(page) || page < 1) throw new ApiError('VALIDATION', 'Хуудасны дугаар буруу байна')
      if (!Number.isInteger(limit) || limit < 1 || limit > PAGE_LIMIT_MAX) {
        throw new ApiError('VALIDATION', `Хуудасны хэмжээ 1–${PAGE_LIMIT_MAX} хооронд байх ёстой`)
      }
      await wait()

      const q = filter.q ? normalize(filter.q) : ''
      const matched = sorted
        .filter((b) => !filter.category || b.category === filter.category)
        .filter((b) => !filter.courseId || b.courseId === filter.courseId)
        .filter((b) => !q || [b.title, b.author, b.description].some((t) => normalize(t).includes(q)))

      const start = (page - 1) * limit
      return { items: matched.slice(start, start + limit).map(toSummary), total: matched.length, page, limit }
    },

    async getBook(slug: string): Promise<Book> {
      await wait()
      const b = books.find((x) => x.slug === slug)
      if (!b) throw new ApiError('NOT_FOUND', 'Ном олдсонгүй')
      const course = courses.find((c) => c.id === b.courseId)
      const sameCourseFirst = (x: BookSeed) => (b.courseId && x.courseId === b.courseId ? 0 : 1)
      const related = sorted
        .filter((x) => x.category === b.category && x.id !== b.id)
        .sort((x, y) => sameCourseFirst(x) - sameCourseFirst(y))
        .slice(0, RELATED_COUNT)
        .map(toSummary)
      return {
        ...toSummary(b),
        description: b.description,
        language: b.language,
        readUrl: b.readUrl,
        course: course ? { slug: course.slug, title: course.title, thumbnail: course.thumbnail } : null,
        related,
      }
    },

    async getBookCategories(): Promise<string[]> {
      await wait()
      return [...new Set(books.map((b) => b.category))].sort((a, b) => a.localeCompare(b, 'mn'))
    },
  }
}
