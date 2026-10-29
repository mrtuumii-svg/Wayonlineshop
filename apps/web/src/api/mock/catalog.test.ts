import { createMockApi } from './mockApi'

const api = () => createMockApi({ storage: localStorage, getToken: () => null, delay: 0 })

test('getCourses returns all 8 on one page by default', async () => {
  const r = await api().getCourses()
  expect(r.items).toHaveLength(8)
  expect(r).toMatchObject({ total: 8, page: 1 })
  expect(r.limit).toBeGreaterThanOrEqual(8)
})

test('getCourses filters by category and level', async () => {
  const r = await api().getCourses({ category: 'Дизайн' })
  expect(r.items.length).toBeGreaterThan(0)
  expect(r.items.every((c) => c.category === 'Дизайн')).toBe(true)
  expect(r.total).toBe(r.items.length)
  expect((await api().getCourses({ level: 'advanced' })).items).toHaveLength(1)
})

test('getCourses filters by maxPrice inclusive', async () => {
  const r = await api().getCourses({ maxPrice: 39000 })
  expect(r.items.every((c) => c.price <= 39000)).toBe(true)
  expect(r.items.map((c) => c.slug)).toContain('figma-undsen')
  expect(r.items.map((c) => c.slug)).not.toContain('react-ekhlel')
})

test('search is case-insensitive, trimmed, matches title', async () => {
  const r = await api().getCourses({ q: '  REACT ' })
  expect(r.items.map((c) => c.slug)).toContain('react-ekhlel')
  const r2 = await api().getCourses({ q: 'FIGMA ҮНДЭС' })
  expect(r2.items.map((c) => c.slug)).toEqual(['figma-undsen'])
})

test('search matches category name case-insensitively', async () => {
  const r = await api().getCourses({ q: 'ДИЗАЙН' })
  expect(r.items.map((c) => c.slug).sort()).toEqual(['figma-undsen', 'ux-sudalgaa'])
})

test('pagination slices items but reports the full total', async () => {
  const p1 = await api().getCourses({ page: 1, limit: 3 })
  expect(p1.items).toHaveLength(3)
  expect(p1).toMatchObject({ total: 8, page: 1, limit: 3 })

  const p3 = await api().getCourses({ page: 3, limit: 3 })
  expect(p3.items).toHaveLength(2)
  expect(p3.total).toBe(8)

  const ids = [...p1.items, ...(await api().getCourses({ page: 2, limit: 3 })).items, ...p3.items].map((c) => c.id)
  expect(new Set(ids).size).toBe(8)
})

test('a page past the end is empty but total still reflects the filter', async () => {
  const r = await api().getCourses({ page: 99, limit: 3 })
  expect(r.items).toEqual([])
  expect(r.total).toBe(8)
})

test('pagination keeps the filter applied', async () => {
  const r = await api().getCourses({ category: 'Програмчлал', page: 1, limit: 2 })
  expect(r.items).toHaveLength(2)
  expect(r.total).toBe(3)
  expect(r.items.every((c) => c.category === 'Програмчлал')).toBe(true)
})

test('out of range page or limit is rejected', async () => {
  await expect(api().getCourses({ limit: 51 })).rejects.toMatchObject({ code: 'VALIDATION' })
  await expect(api().getCourses({ limit: 0 })).rejects.toMatchObject({ code: 'VALIDATION' })
  await expect(api().getCourses({ page: 0 })).rejects.toMatchObject({ code: 'VALIDATION' })
})

test('list items are summaries: no sections and no video ids', async () => {
  const [first] = (await api().getCourses()).items
  expect(first).toBeDefined()
  expect(first).not.toHaveProperty('sections')
  expect(JSON.stringify(first)).not.toContain('youtubeId')
})

test('summaries carry lesson count and total duration', async () => {
  const r = await api().getCourses({ q: 'react' })
  expect(r.items[0]).toMatchObject({ slug: 'react-ekhlel', lessonCount: 3, totalDurationSec: 307 + 420 + 615 })
})

test('getCoursesByIds returns only the found ids, as summaries', async () => {
  const r = await api().getCoursesByIds(['c2', 'ghost', 'c1'])
  expect(r.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
  expect(r[0]).not.toHaveProperty('sections')
})

test('getCoursesByIds with no ids does not fetch anything', async () => {
  expect(await api().getCoursesByIds([])).toEqual([])
})

test('getCoursesByIds dedupes repeated ids', async () => {
  expect(await api().getCoursesByIds(['c1', 'c1'])).toHaveLength(1)
})

test('getCourse strips youtubeId except preview for anonymous', async () => {
  const c = await api().getCourse('react-ekhlel')
  const lessons = c.sections.flatMap((s) => s.lessons)
  expect(lessons.find((l) => l.id === 'l1')!.youtubeId).toBeDefined()
  expect(lessons.find((l) => l.id === 'l2')!.youtubeId).toBeUndefined()
})

test('getCourse throws NOT_FOUND for unknown slug', async () => {
  await expect(api().getCourse('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' })
})

test('getCategories returns the 4 categories', async () => {
  expect(await api().getCategories()).toEqual(['Програмчлал', 'Дизайн', 'Маркетинг', 'Англи хэл'])
})

test('returned data is a copy; mutating it does not affect later calls', async () => {
  const a = await api().getCourse('react-ekhlel')
  a.title = 'changed'
  expect((await api().getCourse('react-ekhlel')).title).toBe('React эхлэл')
})
