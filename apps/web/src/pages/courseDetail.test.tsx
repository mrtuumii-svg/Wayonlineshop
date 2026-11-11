import { screen } from '@testing-library/react'
import { useCartStore } from '@/features/cart/cartStore'
import { buyCourses, loginAs, renderApp, testApi } from '@/test/renderApp'

test('shows course info and curriculum', async () => {
  renderApp('/courses/react-ekhlel')
  expect(await screen.findByRole('heading', { name: 'React эхлэл' })).toBeInTheDocument()
  expect(screen.getByText('49,000₮')).toBeInTheDocument()
  expect(screen.getByText('Анхны компонент')).toBeInTheDocument()
  expect(screen.getByText('5:07')).toBeInTheDocument()
})

test('add to cart switches button to go-to-cart link', async () => {
  const { user } = renderApp('/courses/react-ekhlel')
  await user.click(await screen.findByRole('button', { name: 'Сагсанд нэмэх' }))
  expect(useCartStore.getState().courseIds).toEqual(['c1'])
  expect(screen.getByRole('link', { name: 'Сагс руу очих' })).toHaveAttribute('href', '/cart')
})

test('preview opens a video player', async () => {
  const { user } = renderApp('/courses/react-ekhlel')
  await user.click(await screen.findByRole('button', { name: 'Урьдчилан үзэх' }))
  expect(document.querySelector('iframe')).toHaveAttribute('src', expect.stringContaining('youtube-nocookie.com/embed/aqz-KE-bpKQ'))
})

test('owned course shows watch link instead of add-to-cart', async () => {
  const api = testApi()
  await loginAs(api, {})
  await buyCourses(api, ['c1'])
  renderApp('/courses/react-ekhlel', { api })
  expect(await screen.findByRole('link', { name: 'Үзэх' })).toHaveAttribute('href', '/learn/react-ekhlel/l1')
  expect(screen.queryByRole('button', { name: 'Сагсанд нэмэх' })).not.toBeInTheDocument()
})

test('notice from navigation state is shown', async () => {
  const { router } = renderApp('/')
  await router.navigate('/courses/react-ekhlel', { state: { notice: 'Энэ хичээлийг худалдаж авна уу' } })
  expect(await screen.findByText('Энэ хичээлийг худалдаж авна уу')).toBeInTheDocument()
})

test('unknown slug renders 404', async () => {
  renderApp('/courses/nope')
  expect(await screen.findByText('Хуудас олдсонгүй')).toBeInTheDocument()
})

describe('demo reviews', () => {
  afterEach(() => vi.unstubAllEnvs())

  test('hidden unless VITE_DEMO_REVIEWS=true', async () => {
    renderApp('/courses/react-ekhlel')
    await screen.findByRole('heading', { name: 'React эхлэл' })
    expect(screen.queryByRole('heading', { name: /Сэтгэгдэл/ })).not.toBeInTheDocument()
  })

  test('shown with a demo label and average rating when enabled', async () => {
    vi.stubEnv('VITE_DEMO_REVIEWS', 'true')
    renderApp('/courses/react-ekhlel')
    const section = (await screen.findByRole('heading', { name: /Сэтгэгдэл/ })).closest('section')!
    expect(section).toHaveTextContent('Demo сэтгэгдэл')
    expect(section).toHaveTextContent(/\d\.\d/)
    expect(section.querySelectorAll('li').length).toBeGreaterThan(0)
  })
})
