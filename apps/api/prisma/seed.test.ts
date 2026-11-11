import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestPrisma, resetDb } from '../src/test/db.js'
import { seed } from './seed.js'
import { books, COURSE_IMAGES } from '@way/catalog'
import { courses, YOUTUBE_IDS } from './seedData.js'

const prisma = createTestPrisma()

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  await resetDb(prisma)
})

describe('seed', () => {
  it('20 хичээл, 4 категори, 6 багш, 40 ном оруулна', async () => {
    await seed(prisma)

    expect(await prisma.course.count()).toBe(courses.length)
    expect(courses.length).toBe(20)
    expect(await prisma.book.count()).toBe(40)
    expect(await prisma.instructor.count()).toBe(6)
    const categories = await prisma.course.findMany({ distinct: ['category'], select: { category: true } })
    expect(categories.map((c) => c.category).sort()).toEqual(['Англи хэл', 'Дизайн', 'Маркетинг', 'Програмчлал'])
  })

  it('idempotent — 2 удаа ажиллуулахад давхардахгүй', async () => {
    await seed(prisma)
    const before = {
      courses: await prisma.course.count(),
      sections: await prisma.section.count(),
      lessons: await prisma.lesson.count(),
      books: await prisma.book.count(),
    }

    await seed(prisma)

    expect({
      courses: await prisma.course.count(),
      sections: await prisma.section.count(),
      lessons: await prisma.lesson.count(),
      books: await prisma.book.count(),
    }).toEqual(before)
  })

  it('frontend-ийн хичээлийн ID-г хадгална (явц/сагс зөрөхгүй)', async () => {
    await seed(prisma)

    const react = await prisma.course.findUniqueOrThrow({
      where: { slug: 'react-ekhlel' },
      include: { sections: { orderBy: { order: 'asc' }, include: { lessons: { orderBy: { order: 'asc' } } } } },
    })
    expect(react.id).toBe('c1')
    expect(react.price).toBe(49000)
    expect(react.sections.map((s) => s.lessons.map((l) => l.id))).toEqual([['l1', 'l2'], ['l3']])
    expect(react.sections[0]?.lessons[0]?.isPreview).toBe(true)
  })

  it('хичээл бүрт 11 тэмдэгтийн YouTube ID оноогдоно', async () => {
    await seed(prisma)

    const lessons = await prisma.lesson.findMany()
    expect(lessons.length).toBeGreaterThan(0)
    for (const l of lessons) expect(l.youtubeId).toMatch(/^[\w-]{11}$/)
    expect(Object.keys(YOUTUBE_IDS).sort()).toEqual(lessons.map((l) => l.id).sort())
  })

  it('хичээл бүр сэдэвт тохирсон зурагтай (санамсаргүй picsum биш)', async () => {
    await seed(prisma)
    const rows = await prisma.course.findMany({ select: { slug: true, thumbnail: true } })
    for (const c of rows) expect(c.thumbnail, c.slug).toBe(COURSE_IMAGES[c.slug])
  })

  it('ном бүр байгаа хичээл рүү заана (эсвэл холбоосгүй), slug давтагдахгүй', async () => {
    await seed(prisma)
    const courseIds = new Set(courses.map((c) => c.id))
    for (const b of books) if (b.courseId) expect(courseIds.has(b.courseId), b.slug).toBe(true)
    expect(new Set(books.map((b) => b.slug)).size).toBe(books.length)
    expect(await prisma.book.count({ where: { courseId: { not: null } } })).toBe(books.filter((b) => b.courseId).length)
  })
})
