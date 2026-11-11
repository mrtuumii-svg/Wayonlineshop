import { books } from '@way/catalog'
import type { FastifyInstance } from 'fastify'
import { seed } from '../../prisma/seed.js'
import { createTestPrisma, resetDb } from '../test/db.js'
import { buildTestApp } from '../test/testApp.js'

const prisma = createTestPrisma()
let app: FastifyInstance

beforeEach(async () => {
  await resetDb(prisma)
  await seed(prisma)
  app = await buildTestApp()
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

afterAll(async () => {
  await prisma.$disconnect()
})

const get = (url: string) => app.inject({ method: 'GET', url })
const slugs = (body: { items: { slug: string }[] }) => body.items.map((b) => b.slug).sort()

describe('GET /books', () => {
  it('анхдагч: 24 хүртэл, нийт тоотой, нэвтрэлт шаардахгүй (үнэгүй)', async () => {
    const body = (await get('/books')).json()
    expect(body).toMatchObject({ total: books.length, page: 1, limit: 24 })
    expect(body.items).toHaveLength(24)
  })

  it('картад зөвхөн хэрэгтэй талбар — тайлбар, линк жагсаалтаар явахгүй', async () => {
    const res = await get('/books?q=pro%20git')
    expect(res.json().items).toEqual([
      {
        id: 'b8',
        slug: 'pro-git',
        title: 'Pro Git',
        author: 'Scott Chacon, Ben Straub',
        category: 'Програмчлал',
        year: 2014,
        coverUrl: expect.stringContaining('openlibrary.org'),
      },
    ])
    expect(res.body).not.toContain('readUrl')
    expect(res.body).not.toContain('description')
  })

  it.each([
    ['category=Дизайн', books.filter((b) => b.category === 'Дизайн')],
    ['courseId=c14', books.filter((b) => b.courseId === 'c14')],
  ])('шүүлт %s', async (query, expected) => {
    const body = (await get(`/books?${encodeURI(query)}`)).json()
    expect(slugs(body)).toEqual(expected.map((b) => b.slug).sort())
  })

  it.each([
    ['гарчгаар (том үсэг)', 'PYTHON', 'think-python'],
    ['зохиогчоор', 'downey', 'think-stats'],
    ['монгол тайлбараар', 'алгоритмын', 'algorithms-erickson'],
  ])('q хайлт %s', async (_label, q, slug) => {
    const body = (await get(`/books?q=${encodeURIComponent(q)}`)).json()
    expect(slugs(body)).toContain(slug)
  })

  it('хуудаслалт давхцахгүй, бүгдийг хамарна', async () => {
    const seen: string[] = []
    for (let page = 1; page <= Math.ceil(books.length / 15); page++) {
      seen.push(...(await get(`/books?limit=15&page=${page}`)).json().items.map((b: { id: string }) => b.id))
    }
    expect(new Set(seen).size).toBe(books.length)
  })

  it.each(['limit=61', 'limit=0', 'page=0', 'page=abc'])('%s → 400', async (query) => {
    const res = await get(`/books?${query}`)
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('VALIDATION')
  })
})

describe('GET /books/:slug', () => {
  it('дэлгэрэнгүй: унших линк, хичээл, ижил ангиллын номууд (нэг хичээлийнх эхэнд)', async () => {
    const body = (await get('/books/dive-into-deep-learning')).json()

    expect(body).toMatchObject({
      title: 'Dive into Deep Learning',
      readUrl: 'https://d2l.ai/',
      language: 'Англи',
      course: { slug: 'mashin-surgalt', title: 'Машин сургалтын үндэс' },
    })
    expect(body.related.length).toBeLessThanOrEqual(6)
    expect(body.related.map((b: { slug: string }) => b.slug)).not.toContain('dive-into-deep-learning')
    // c14-ийн бусад 3 ном эхэнд
    const sameCourse = books.filter((b) => b.courseId === 'c14' && b.slug !== 'dive-into-deep-learning').map((b) => b.slug)
    expect(body.related.slice(0, 3).map((b: { slug: string }) => b.slug).sort()).toEqual(sameCourse.sort())
  })

  it('холбоогүй ном → course: null', async () => {
    expect((await get('/books/sicp')).json().course).toBeNull()
  })

  it('хичээл устахад ном үлдэж, холбоос нь арилна (onDelete: SetNull)', async () => {
    await prisma.course.delete({ where: { id: 'c18' } })
    expect((await get('/books/practical-typography')).json().course).toBeNull()
  })

  it('байхгүй ном → 404', async () => {
    expect((await get('/books/baihgui')).statusCode).toBe(404)
  })
})

it('GET /books/categories', async () => {
  expect((await get('/books/categories')).json()).toEqual(['Англи хэл', 'Дизайн', 'Маркетинг', 'Програмчлал'])
})
