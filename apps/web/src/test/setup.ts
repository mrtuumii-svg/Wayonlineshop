import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, expect } from 'vitest'
import { useAuthStore } from '@/features/auth/authStore'
import { useCartStore } from '@/features/cart/cartStore'

expect.extend(matchers)

// findBy*/waitFor анхдагчаар 1с хүлээдэг — бүх тест зэрэг ажиллахад (jsdom × 23 файл) хүрэлцэхгүй, санамсаргүй унадаг
configure({ asyncUtilTimeout: 3000 })

afterEach(() => {
  cleanup()
  // Store-уудын санах ойн төлөвийг цэвэрлээд дараа нь localStorage-ийг хоосолно
  useAuthStore.setState({ user: null, token: null })
  useCartStore.setState({ courseIds: [] })
  localStorage.clear()
})
