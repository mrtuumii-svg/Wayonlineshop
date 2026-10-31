import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuthStore } from './authStore'

/**
 * Зөвхөн админд. Нэвтрээгүй → нэвтрэх хуудас, энгийн хэрэглэгч → нүүр.
 * Энэ нь зөвхөн тав тух: хэн нэгэн кодоо засаад орсон ч backend 403 буцаана.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.user?.role)
  const { pathname } = useLocation()
  if (!token) return <Navigate to={`/login?redirect=${encodeURIComponent(pathname)}`} replace />
  if (role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}
