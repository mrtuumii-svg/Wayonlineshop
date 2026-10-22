import type { MockApiOptions } from './mockApi'
import { createMockApi } from './mockApi'

let token: string | null = null
const api = (opts: Partial<MockApiOptions> = {}) =>
  createMockApi({ storage: localStorage, getToken: () => token, delay: 0, ...opts })

/** Захиалга үүсгээд fake провайдераар төлүүлнэ (нэг poll). */
async function buy(ids: string[]): Promise<string> {
  const intent = await api().checkout(ids)
  await api().getOrder(intent.orderId)
  return intent.orderId
}

beforeEach(async () => {
  token = null
  token = (await api().register({ name: 'A', email: 'a@test.mn', password: 'secret1' })).token
})

test('checkout creates a pending order with a QR, not a paid one', async () => {
  const intent = await api().checkout(['c1', 'c2'])
  expect(intent).toMatchObject({ status: 'pending' })
  expect(intent.orderId).toBeTruthy()
  expect(intent.qr.text).toBeTruthy()
  expect(intent.qr.image).toBeTruthy()
  expect(Date.parse(intent.expiresAt)).toBeGreaterThan(Date.now())
})

test('a pending order grants nothing until it is paid', async () => {
  const intent = await api().checkout(['c1'])
  expect(await api().getMyCourses()).toEqual([])
  await expect(api().getProgress('c1')).rejects.toMatchObject({ code: 'FORBIDDEN' })

  const order = await api().getOrder(intent.orderId)
  expect(order.status).toBe('paid')
  expect((await api().getMyCourses()).map((c) => c.id)).toEqual(['c1'])
})

test('getOrder reports pending until the fake provider pays', async () => {
  const slow = api({ payAfterPolls: 2 })
  const intent = await slow.checkout(['c1'])
  expect((await slow.getOrder(intent.orderId)).status).toBe('pending')
  expect((await slow.getOrder(intent.orderId)).status).toBe('pending')
  expect((await slow.getOrder(intent.orderId)).status).toBe('paid')
  expect((await slow.getOrder(intent.orderId)).status).toBe('paid')
})

test('paid order totals and course ids are correct', async () => {
  const id = await buy(['c1', 'c2'])
  expect(await api().getOrder(id)).toMatchObject({ courseIds: ['c1', 'c2'], total: 88000, status: 'paid' })
})

test('checkout skips owned and unknown ids; all skipped → VALIDATION', async () => {
  await buy(['c1'])
  const id = await buy(['c1', 'c2', 'ghost'])
  const order = await api().getOrder(id)
  expect(order.courseIds).toEqual(['c2'])
  expect(order.total).toBe(39000)
  await expect(api().checkout(['c1'])).rejects.toMatchObject({ code: 'VALIDATION' })
})

test('checkout dedupes repeated ids', async () => {
  const id = await buy(['c1', 'c1'])
  expect((await api().getOrder(id)).courseIds).toEqual(['c1'])
  expect((await api().getOrder(id)).total).toBe(49000)
})

test('checkout without token → UNAUTHORIZED', async () => {
  token = null
  await expect(api().checkout(['c1'])).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
})

test('getOrder hides unknown and other users orders', async () => {
  await expect(api().getOrder('ghost')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  const intent = await api().checkout(['c1'])
  token = (await api().register({ name: 'B', email: 'b@test.mn', password: 'secret1' })).token
  await expect(api().getOrder(intent.orderId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
})

test('getMyCourses returns summaries with progress embedded', async () => {
  expect(await api().getMyCourses()).toEqual([])
  await buy(['c1'])

  const [mine] = await api().getMyCourses()
  expect(mine).toMatchObject({
    id: 'c1',
    slug: 'react-ekhlel',
    lessonCount: 3,
    progressPercent: 0,
    resumeLessonId: 'l1',
    completedLessonIds: [],
  })
  expect(mine).not.toHaveProperty('sections')

  await api().markLessonComplete('c1', 'l1')
  const [updated] = await api().getMyCourses()
  expect(updated).toMatchObject({ progressPercent: 33, resumeLessonId: 'l2', completedLessonIds: ['l1'] })
})

test('a fully completed course resumes from the first lesson', async () => {
  await buy(['c1'])
  for (const id of ['l1', 'l2', 'l3']) await api().markLessonComplete('c1', id)
  const [mine] = await api().getMyCourses()
  expect(mine).toMatchObject({ progressPercent: 100, resumeLessonId: 'l1' })
})

test('purchases are per user', async () => {
  await buy(['c1'])
  token = (await api().register({ name: 'B', email: 'b@test.mn', password: 'secret1' })).token
  expect(await api().getMyCourses()).toEqual([])
})

test('owned course exposes all youtubeIds', async () => {
  await buy(['c1'])
  const lessons = (await api().getCourse('react-ekhlel')).sections.flatMap((s) => s.lessons)
  expect(lessons.every((l) => l.youtubeId)).toBe(true)
})

test('progress: FORBIDDEN when not owned, idempotent mark when owned', async () => {
  await expect(api().getProgress('c1')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await buy(['c1'])
  expect(await api().getProgress('c1')).toEqual({ courseId: 'c1', completedLessonIds: [] })
  await api().markLessonComplete('c1', 'l2')
  const p = await api().markLessonComplete('c1', 'l2')
  expect(p.completedLessonIds).toEqual(['l2'])
  expect(await api().getProgress('c1')).toEqual(p)
})

test('markLessonComplete with lesson not in course → NOT_FOUND', async () => {
  await buy(['c1'])
  await expect(api().markLessonComplete('c1', 'zzz')).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
