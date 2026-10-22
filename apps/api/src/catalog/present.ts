import type { Course, CourseSummary, Lesson } from '@way/contract'
import type { Prisma } from '../generated/prisma/client.js'

/** Жагсаалтад хэрэгтэй хамгийн бага өгөгдөл — видеоны ID, тайлбар, bio энд хэзээ ч уншигдахгүй */
export const summarySelect = {
  id: true,
  slug: true,
  title: true,
  price: true,
  thumbnail: true,
  category: true,
  level: true,
  instructor: { select: { name: true, avatar: true } },
  sections: { select: { lessons: { select: { durationSec: true } } } },
} satisfies Prisma.CourseSelect

type SummaryRow = Prisma.CourseGetPayload<{ select: typeof summarySelect }>

export function toSummary({ sections, ...c }: SummaryRow): CourseSummary {
  const lessons = sections.flatMap((s) => s.lessons)
  return {
    ...c,
    instructor: { name: c.instructor.name, avatar: c.instructor.avatar },
    lessonCount: lessons.length,
    totalDurationSec: lessons.reduce((sum, l) => sum + l.durationSec, 0),
  }
}

export const detailInclude = {
  instructor: { select: { name: true, avatar: true, bio: true } },
  sections: {
    orderBy: { order: 'asc' },
    select: {
      id: true,
      title: true,
      lessons: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, durationSec: true, isPreview: true, youtubeId: true },
      },
    },
  },
} satisfies Prisma.CourseInclude

type DetailRow = Prisma.CourseGetPayload<{ include: typeof detailInclude }>

/**
 * Paywall: эзэмшээгүй хэрэглэгчид preview биш хичээлийн `youtubeId`-г огт буцаахгүй
 * (талбар нь хариунд байхгүй, хоосон утгатай ч биш). `mockApi.ts`-ийн `present()`-тэй ижил дүрэм.
 */
export function toCourse(row: DetailRow, owned: boolean): Course {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    price: row.price,
    thumbnail: row.thumbnail,
    category: row.category,
    level: row.level,
    instructor: row.instructor,
    sections: row.sections.map((s) => ({
      id: s.id,
      title: s.title,
      lessons: s.lessons.map(({ youtubeId, ...l }): Lesson => (owned || l.isPreview ? { ...l, youtubeId } : l)),
    })),
  }
}
