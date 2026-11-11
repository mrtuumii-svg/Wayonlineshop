import { books } from '@way/catalog'
import { screen, waitFor, within } from '@testing-library/react'
import { coverPalette, coverSrc } from '@/features/books/cover'
import { renderApp } from '@/test/renderApp'

test('нүүр хуудас бүх хичээл ба үнэгүй номуудыг харуулна', async () => {
  renderApp('/')
  expect(await screen.findByText('Бүх хичээлүүд')).toBeInTheDocument()
  // mock-ийн 8 хичээл бүгд (өмнө нь зөвхөн 4)
  expect(await screen.findByRole('link', { name: 'Англи хэлээр ярилцах' })).toBeInTheDocument()
  expect(screen.getByText('Үнэгүй номууд')).toBeInTheDocument()
  expect(await screen.findByRole('link', { name: `Бүх ${books.length} ном →` })).toHaveAttribute('href', '/books')
})

test('толгой хэсэгт "Номууд" цэс байна', async () => {
  renderApp('/')
  expect(screen.getByRole('link', { name: 'Номууд' })).toHaveAttribute('href', '/books')
})

test('номын каталог: 40 ном, ангиллаар шүүнэ', async () => {
  const { user, router } = renderApp('/books')
  expect(await screen.findByText(`${books.length} ном`)).toBeInTheDocument()

  await user.click(await screen.findByRole('button', { name: 'Дизайн' }))

  const design = books.filter((b) => b.category === 'Дизайн')
  expect(await screen.findByText(`${design.length} ном`)).toBeInTheDocument()
  expect(router.state.location.search).toBe(`?category=${encodeURIComponent('Дизайн')}`)
  expect(screen.getByRole('button', { name: 'Дизайн' })).toHaveAttribute('aria-pressed', 'true')
})

test('номын каталог: хайлт URL-д орж, үр дүнг шүүнэ', async () => {
  const { user, router } = renderApp('/books')
  await user.type(await screen.findByLabelText('Ном хайх'), 'pro git')
  await user.click(screen.getByRole('button', { name: 'Хайх' }))

  expect(await screen.findByText('1 ном')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Pro Git' })).toHaveAttribute('href', '/books/pro-git')
  expect(router.state.location.search).toBe('?q=pro+git')
})

test('номын дэлгэрэнгүй: үнэгүй унших линк шинэ цонхонд, холбогдох хичээл, ижил номууд', async () => {
  renderApp('/books/pro-git')

  expect(await screen.findByRole('heading', { level: 1, name: 'Pro Git' })).toBeInTheDocument()
  const read = screen.getByRole('link', { name: /Одоо унших/ })
  expect(read).toHaveAttribute('href', 'https://git-scm.com/book/en/v2')
  expect(read).toHaveAttribute('target', '_blank')
  expect(read).toHaveAttribute('rel', expect.stringContaining('noopener'))
  expect(screen.getByRole('heading', { name: 'Ижил төстэй номууд' })).toBeInTheDocument()
})

test('холбогдох хичээл байвал хичээл рүү линктэй (mock-д байгаа хичээл)', async () => {
  // Practical Typography → c18 нь mock-д байхгүй; Resilient Web Design → c2 (Figma үндэс) байгаа
  renderApp('/books/resilient-web-design')
  const aside = (await screen.findByText('Холбогдох хичээл')).closest('aside')!
  expect(within(aside).getByRole('link', { name: 'Figma үндэс' })).toHaveAttribute('href', '/courses/figma-undsen')
})

test('хичээлийн хуудсанд холбогдох номууд харагдана', async () => {
  renderApp('/courses/react-ekhlel')
  expect(await screen.findByRole('heading', { name: 'Холбогдох номууд' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Full Stack Open' })).toHaveAttribute('href', '/books/full-stack-open')
})

test('байхгүй ном → 404 хуудас', async () => {
  renderApp('/books/baihgui')
  expect(await screen.findByText('Хуудас олдсонгүй')).toBeInTheDocument()
})

test('нүүргүй номд загварчилсан нүүр зурна', async () => {
  renderApp('/books/full-stack-open')
  await waitFor(() => expect(screen.getAllByRole('img', { name: 'Full Stack Open номын нүүр' }).length).toBeGreaterThan(0))
})

test('coverSrc: Open Library-ийн хэмжээг картанд дунд болгоно, бусдыг хөндөхгүй', () => {
  expect(coverSrc('https://covers.openlibrary.org/b/isbn/1-L.jpg', 'card')).toBe('https://covers.openlibrary.org/b/isbn/1-M.jpg')
  expect(coverSrc('https://covers.openlibrary.org/b/isbn/1-L.jpg', 'large')).toBe('https://covers.openlibrary.org/b/isbn/1-L.jpg')
  expect(coverSrc('https://www.gutenberg.org/x.jpg', 'card')).toBe('https://www.gutenberg.org/x.jpg')
})

test('coverPalette: ижил ном үргэлж ижил өнгө', () => {
  expect(coverPalette('Дизайн', 'b30')).toEqual(coverPalette('Дизайн', 'b30'))
})
