import { act, screen, waitFor } from '@testing-library/react'
import { ApiError } from '@/api/errors'
import { useCartStore } from '@/features/cart/cartStore'
import { buyCourses, loginAs, renderApp, testApi } from '@/test/renderApp'

test('switching user does not show the previous user courses', async () => {
  const api = testApi()
  await loginAs(api, { email: 'a@test.mn' })
  await buyCourses(api, ['c1'])
  renderApp('/my-courses', { api })
  expect(await screen.findByText('Явц: 0%')).toBeInTheDocument()
  await act(() => loginAs(api, { email: 'b@test.mn' }))
  expect(await screen.findByText('Та одоогоор хичээл худалдаж аваагүй байна')).toBeInTheDocument()
})

test('after paying, the learn page shows the video without a stale course', async () => {
  const api = testApi()
  await loginAs(api, {})
  const { user, router } = renderApp('/courses/react-ekhlel', { api })
  await user.click(await screen.findByRole('button', { name: 'Сагсанд нэмэх' }))
  await act(() => router.navigate('/checkout'))
  await user.click(await screen.findByRole('button', { name: 'QPay-ээр төлөх' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/my-courses'))
  await act(() => router.navigate('/learn/react-ekhlel/l2'))
  await screen.findByRole('heading', { name: 'Орчин бэлтгэх' })
  expect(document.querySelector('iframe[src*="youtube-nocookie.com/embed/"]')).not.toBeNull()
})

test('cart shows error state with retry when courses fail to load', async () => {
  const api = testApi()
  api.getCoursesByIds = vi
    .fn()
    .mockRejectedValueOnce(new ApiError('UNKNOWN', 'x'))
    .mockImplementation(testApi().getCoursesByIds)
  useCartStore.setState({ courseIds: ['c1'] })
  const { user } = renderApp('/cart', { api })
  await user.click(await screen.findByRole('button', { name: 'Дахин оролдох' }))
  expect(await screen.findByText('Нийт: 49,000₮')).toBeInTheDocument()
})

test('checkout shows error state instead of redirecting when courses fail to load', async () => {
  const api = testApi()
  await loginAs(api, {})
  api.getCoursesByIds = vi.fn().mockRejectedValue(new ApiError('UNKNOWN', 'x'))
  useCartStore.setState({ courseIds: ['c1'] })
  const { router } = renderApp('/checkout', { api })
  expect(await screen.findByRole('button', { name: 'Дахин оролдох' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/checkout')
})
