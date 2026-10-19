import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { createApi } from '@/api/createApi'
import { useAuthStore } from '@/features/auth/authStore'
import { Providers } from './Providers'
import { createQueryClient } from './queryClient'
import { routes } from './routes'
import '../index.css'

const api = createApi(import.meta.env)
const queryClient = createQueryClient(() => useAuthStore.getState().clear())
const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers api={api} queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
)
