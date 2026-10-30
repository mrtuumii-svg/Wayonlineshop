import { act, screen, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import type { AdminApi, ApiClient } from '@/api/client'
import { ApiError } from '@/api/errors'
import type { User } from '@/api/types'
import { youtubeIdFrom } from '@/features/admin/youtube'
import { useAuthStore } from '@/features/auth/authStore'
import { renderApp, testApi } from '@/test/renderApp'

const adminUser: User = { id: 'a1', name: 'Админ', email: 'admin@way.mn', role: 'admin' }
const normalUser: User = { id: 'u1', name: 'Бат', email: 'bat@way.mn', role: 'user' }

/** Mock каталог + хуурамч админ API. getMe нь `user`-ийг буцаана (сайт нээгдэхэд role шинэчилдэг) */
function adminTestApi(user: User, over: Partial<AdminApi> = {}) {
  const admin: AdminApi = {
    getSalesReport: vi.fn(async () => ({
      revenue: 137000,
      orders: { paid: 2, pending: 1 },
      topCourses: [{ courseId: 'c1', title: 'React эхлэл', sold: 2, revenue: 98000 }],
    })),
    getUsers: vi.fn(async () => [
      { ...adminUser, role: 'admin' as const, createdAt: '2026-10-30T00:00:00Z' },
      { ...normalUser, role: 'user' as const, createdAt: '2026-10-30T00:00:00Z' },
    ]),
    setUserRole: vi.fn(async (id, role) => ({ ...normalUser, id, role, createdAt: '2026-10-30T00:00:00Z' })),
    getOrders: vi.fn(async () => []),
    getInstructors: vi.fn(async () => [{ id: 'i1', name: 'Б. Тэмүүлэн' }]),
    createCourse: vi.fn(async () => ({ id: 'new', slug: 'python-ekhlel' })),
    updateCourse: vi.fn(async (id) => ({ id, slug: 'react-ekhlel' })),
    deleteCourse: vi.fn(async () => undefined),
    ...over,
  }
  const api: ApiClient = { ...testApi(), getMe: async () => user, admin }
  return { api, admin }
}

function loginAs(user: User) {
  act(() => useAuthStore.getState().setSession(user, 'test-token'))
}

describe('хандалт', () => {
  it('энгийн хэрэглэгчид "Удирдлага" цэс харагдахгүй, /admin руу орвол нүүр рүү буцна', async () => {
    loginAs(normalUser)
    const { router } = renderApp('/admin', { api: adminTestApi(normalUser).api })
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(screen.queryByRole('link', { name: 'Удирдлага' })).not.toBeInTheDocument()
  })

  it('нэвтрээгүй бол нэвтрэх хуудас руу', async () => {
    const { router } = renderApp('/admin')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('админд цэс харагдаж, самбар тайланг харуулна', async () => {
    loginAs(adminUser)
    renderApp('/admin', { api: adminTestApi(adminUser).api })
    expect(screen.getByRole('link', { name: 'Удирдлага' })).toBeInTheDocument()
    expect(await screen.findByText('137,000₮')).toBeInTheDocument()
    expect(screen.getByText('React эхлэл')).toBeInTheDocument()
  })

  it('backend role-ийг хассан бол сайт нээгдэхэд цэс алга болно', async () => {
    loginAs(adminUser) // хадгалсан хуучин мэдээлэл: админ
    renderApp('/', { api: adminTestApi(normalUser).api }) // backend: одоо энгийн хэрэглэгч
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Удирдлага' })).not.toBeInTheDocument())
  })
})

describe('хичээл', () => {
  it('худалдаалагдсан хичээлийг устгах гэвэл ойлгомжтой мессеж', async () => {
    loginAs(adminUser)
    const { api } = adminTestApi(adminUser, {
      deleteCourse: vi.fn(async () => {
        throw new ApiError('CONFLICT', 'conflict')
      }),
    })
    const { user } = renderApp('/admin/courses', { api })

    const row = (await screen.findByRole('link', { name: 'React эхлэл' })).closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Устгах' }))
    await user.click(within(row).getByRole('button', { name: /устгахыг батлах/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('худалдаж авсан тул устгах боломжгүй')
  })

  it('засахад зөвхөн өөрчлөгдсөн талбарыг илгээнэ', async () => {
    loginAs(adminUser)
    const { api, admin } = adminTestApi(adminUser)
    const { user, router } = renderApp('/admin/courses/react-ekhlel/edit', { api })

    const price = await screen.findByLabelText('Үнэ (₮)')
    await user.clear(price)
    await user.type(price, '39000')
    await user.click(screen.getByRole('button', { name: 'Хадгалах' }))

    await waitFor(() => expect(admin.updateCourse).toHaveBeenCalledWith('c1', { price: 39000 }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/courses'))
  })

  it('шинэ хичээл: буруу видео хаягийг илгээхгүй, зөвийг ID болгож илгээнэ', async () => {
    loginAs(adminUser)
    const { api, admin } = adminTestApi(adminUser)
    const { user } = renderApp('/admin/courses/new', { api })

    await user.type(await screen.findByLabelText('Гарчиг'), 'Python эхлэл')
    await user.type(screen.getByLabelText(/Хаяг \(slug\)/), 'python-ekhlel')
    await user.type(screen.getByLabelText('Тайлбар'), 'Python-ий үндэс')
    await user.type(screen.getByLabelText('Үнэ (₮)'), '45000')
    await user.type(screen.getByLabelText('Ангилал'), 'Програмчлал')
    await user.selectOptions(await screen.findByLabelText('Багш'), await screen.findByRole('option', { name: 'Б. Тэмүүлэн' }))
    await user.type(screen.getByLabelText('Бүлгийн нэр'), 'Танилцуулга')
    await user.type(screen.getByLabelText('1.1 Хичээлийн нэр'), 'Суулгах')
    await user.type(screen.getByLabelText('Минут'), '5')
    const video = screen.getByLabelText('YouTube хаяг эсвэл ID')

    await user.type(video, 'буруу')
    await user.click(screen.getByRole('button', { name: 'Хичээл нэмэх' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('YouTube')
    expect(admin.createCourse).not.toHaveBeenCalled()

    await user.clear(video)
    await user.type(video, 'https://www.youtube.com/watch?v=aqz-KE-bpKQ')
    await user.click(screen.getByRole('button', { name: 'Хичээл нэмэх' }))
    await waitFor(() =>
      expect(admin.createCourse).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'python-ekhlel',
          price: 45000,
          instructorId: 'i1',
          sections: [{ title: 'Танилцуулга', lessons: [{ title: 'Суулгах', durationSec: 300, isPreview: false, youtubeId: 'aqz-KE-bpKQ' }] }],
        }),
      ),
    )
  }, 20_000) // олон талбарт бичдэг тул бусад тестээс удаан
})

describe('хэрэглэгч, захиалга', () => {
  it('өөрийгөө админаас хасах товч байхгүй, бусдыг админ болгож болно', async () => {
    loginAs(adminUser)
    const { api, admin } = adminTestApi(adminUser)
    const { user } = renderApp('/admin/users', { api })

    const myRow = (await screen.findByText('admin@way.mn')).closest('tr')!
    expect(within(myRow).queryByRole('button')).not.toBeInTheDocument()

    const batRow = screen.getByText('bat@way.mn').closest('tr')!
    await user.click(within(batRow).getByRole('button', { name: 'Админ болгох' }))
    expect(admin.setUserRole).toHaveBeenCalledWith('u1', 'admin')
  })

  it('захиалгыг төлөвөөр шүүнэ', async () => {
    loginAs(adminUser)
    const { api, admin } = adminTestApi(adminUser)
    const { user } = renderApp('/admin/orders', { api })

    await user.click(await screen.findByRole('button', { name: 'Төлөгдсөн' }))
    await waitFor(() => expect(admin.getOrders).toHaveBeenLastCalledWith('paid'))
  })
})

test.each([
  ['aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
  ['https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=10', 'aqz-KE-bpKQ'],
  ['https://youtu.be/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
  ['https://www.youtube.com/shorts/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
  ['буруу', null],
])('youtubeIdFrom(%s)', (input, expected) => {
  expect(youtubeIdFrom(input)).toBe(expected)
})
