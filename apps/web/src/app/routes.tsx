import type { RouteObject } from 'react-router'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { RequireAdmin } from '@/features/auth/RequireAdmin'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { DashboardPage } from '@/pages/admin/DashboardPage'
import { CartPage } from '@/pages/CartPage'
import { CatalogPage } from '@/pages/CatalogPage'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { CourseDetailPage } from '@/pages/CourseDetailPage'
import { HomePage } from '@/pages/HomePage'
import { LearnPage } from '@/pages/LearnPage'
import { LoginPage } from '@/pages/LoginPage'
import { MyCoursesPage } from '@/pages/MyCoursesPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { Layout } from './Layout'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'courses', element: <CatalogPage /> },
      { path: 'courses/:slug', element: <CourseDetailPage /> },
      { path: 'cart', element: <CartPage /> },
      {
        path: 'checkout',
        element: (
          <RequireAuth>
            <CheckoutPage />
          </RequireAuth>
        ),
      },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      {
        path: 'my-courses',
        element: (
          <RequireAuth>
            <MyCoursesPage />
          </RequireAuth>
        ),
      },
      {
        path: 'learn/:slug/:lessonId',
        element: (
          <RequireAuth>
            <LearnPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin',
        element: (
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        ),
        children: [{ index: true, element: <DashboardPage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
