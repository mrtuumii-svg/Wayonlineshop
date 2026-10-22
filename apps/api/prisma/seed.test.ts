import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestPrisma, resetDb } from '../src/test/db.js'
import { seed } from './seed.js'
import { YOUTUBE_IDS } from './seedData.js'

const prisma = createTestPrisma()

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  await resetDb(prisma)
})

describe('seed', () => {
  it('frontend fixtures-тэй ижил 8 хичээл, 4 категори, 6 багш оруулна', async () => {
    await seed(prisma)

    expect(await prisma.course.count()).toBe(8)
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
    }

    await seed(prisma)

    expect({
      courses: await prisma.course.count(),
      sections: await prisma.section.count(),
      lessons: await prisma.lesson.count(),
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
})
