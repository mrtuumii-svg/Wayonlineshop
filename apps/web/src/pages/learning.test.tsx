import { screen } from '@testing-library/react'
import { buyCourses, loginAs, renderApp, testApi } from '@/test/renderApp'

async function ownedSetup() {
  const api = testApi()
  await loginAs(api, {})
  await buyCourses(api, ['c1'])
  return api
}

test('my courses empty state', async () => {
  const api = testApi()
  await loginAs(api, {})
  renderApp('/my-courses', { api })
  expect(await screen.findByText('Та одоогоор хичээл худалдаж аваагүй байна')).toBeInTheDocument()
})

test('my courses shows progress and continue link', async () => {
  const api = await ownedSetup()
  await api.markLessonComplete('c1', 'l1')
  renderApp('/my-courses', { api })
  expect(await screen.findByText('Явц: 33%')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Үргэлжлүүлэх' })).toHaveAttribute('href', '/learn/react-ekhlel/l2')
})

test('fully completed course continues from first lesson', async () => {
  const api = await ownedSetup()
  for (const id of ['l1', 'l2', 'l3']) await api.markLessonComplete('c1', id)
  renderApp('/my-courses', { api })
  expect(await screen.findByText('Явц: 100%')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Үргэлжлүүлэх' })).toHaveAttribute('href', '/learn/react-ekhlel/l1')
})

test('learn page plays the lesson video', async () => {
  const api = await ownedSetup()
  renderApp('/learn/react-ekhlel/l2', { api })
  expect(await screen.findByRole('heading', { name: 'Орчин бэлтгэх' })).toBeInTheDocument()
  expect(document.querySelector('iframe')).toHaveAttribute('src', expect.stringContaining('youtube-nocookie.com/embed/eRsGyueVLvQ'))
})

test('mark complete updates state and next link works', async () => {
  const api = await ownedSetup()
  const { user, router } = renderApp('/learn/react-ekhlel/l1', { api })
  await user.click(await screen.findByRole('button', { name: 'Дууссан гэж тэмдэглэх' }))
  expect(await screen.findByRole('button', { name: 'Дууссан ✓' })).toBeDisabled()
  expect((await api.getProgress('c1')).completedLessonIds).toEqual(['l1'])
  await user.click(screen.getByRole('link', { name: 'Дараагийн хичээл' }))
  expect(router.state.location.pathname).toBe('/learn/react-ekhlel/l2')
})

test('last lesson has no next link', async () => {
  const api = await ownedSetup()
  renderApp('/learn/react-ekhlel/l3', { api })
  await screen.findByRole('button', { name: 'Дууссан гэж тэмдэглэх' })
  expect(screen.queryByRole('link', { name: 'Дараагийн хичээл' })).not.toBeInTheDocument()
})

test('not owned redirects to detail with notice', async () => {
  const api = testApi()
  await loginAs(api, {})
  const { router } = renderApp('/learn/react-ekhlel/l2', { api })
  expect(await screen.findByText('Энэ хичээлийг худалдаж авна уу')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/courses/react-ekhlel')
})

test('unknown lesson id renders 404', async () => {
  const api = await ownedSetup()
  renderApp('/learn/react-ekhlel/zzz', { api })
  expect(await screen.findByText('Хуудас олдсонгүй')).toBeInTheDocument()
})

test('learn page requires login', async () => {
  const { router } = renderApp('/learn/react-ekhlel/l1')
  await screen.findByRole('button', { name: 'Нэвтрэх' })
  expect(router.state.location.pathname).toBe('/login')
})
