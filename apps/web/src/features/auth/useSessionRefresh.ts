import { useEffect } from 'react'
import { useApi } from '@/api/ApiProvider'
import { isApiError } from '@/api/errors'
import { useAuthStore } from './authStore'

/**
 * Сайт нээгдэхэд хадгалсан хэрэглэгчийн мэдээллийг (ялангуяа role) backend-ээс шинэчилнэ.
 * Үгүй бол хэн нэгнийг админ болгосон/хассаныг дахин нэвтрэх хүртэл сайт мэдэхгүй.
 */
export function useSessionRefresh() {
  const api = useApi()
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    api
      .getMe()
      .then((user) => {
        if (!cancelled) useAuthStore.getState().setSession(user, token)
      })
      .catch((err) => {
        // Токен хүчингүй болсон бол гаргана. Сүлжээний алдаа бол хадгалсан хэвээр үлдээнэ.
        if (!cancelled && isApiError(err) && err.code === 'UNAUTHORIZED') useAuthStore.getState().clear()
      })
    return () => {
      cancelled = true
    }
  }, [api, token])
}
