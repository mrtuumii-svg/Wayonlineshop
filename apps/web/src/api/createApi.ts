import { useAuthStore } from '@/features/auth/authStore'
import type { ApiClient } from './client'
import { createHttpApi } from './httpApi'
import { createMockApi } from './mock/mockApi'
import { withQpay } from './qpay'

const getToken = () => useAuthStore.getState().token

/**
 * `VITE_API_MODE`:
 * - `mock` (анхдагч) — localStorage дээрх mock. Unit тест, offline демо, GitHub Pages.
 * - `http` — бодит backend (`apps/api`). `VITE_API_URL` байхгүй бол dev proxy-ийн `/api`.
 */
export function createApi(env: {
  VITE_API_MODE?: string
  VITE_API_URL?: string
  VITE_MOCK_DELAY?: string
  VITE_PAYMENT_MODE?: string
  VITE_QPAY_SANDBOX?: string
}): ApiClient {
  const mode = env.VITE_API_MODE ?? 'mock'

  // Төлбөрийг backend-ийн провайдер хариуцна — VITE_PAYMENT_MODE энд хамаарахгүй
  if (mode === 'http') return createHttpApi({ baseUrl: env.VITE_API_URL || '/api', getToken })
  if (mode !== 'mock') throw new Error(`VITE_API_MODE буруу: "${mode}" ('mock' эсвэл 'http')`)

  const qpay = (env.VITE_PAYMENT_MODE ?? 'qpay') === 'qpay'
  const api = createMockApi({
    storage: localStorage,
    getToken,
    delay: env.VITE_MOCK_DELAY !== undefined ? Number(env.VITE_MOCK_DELAY) : [200, 500],
    // QPay горимд захиалга зөвхөн QPay баталгаажуулахад `paid` болно — fake провайдер өөрөө төлөхгүй
    ...(qpay && { payAfterPolls: Infinity }),
  })
  // Төлбөр нь dev серверийн /api/qpay middleware-ээр бодит QPay руу явна, бусад нь mock хэвээр
  return qpay ? withQpay(api, { sandbox: env.VITE_QPAY_SANDBOX === 'true' }) : api
}
