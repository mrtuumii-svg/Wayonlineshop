/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { qpayPlugin } from './server/qpay.ts'

export default defineConfig(({ mode }) => {
  // QPAY_* нь VITE_ угтваргүй тул клиент bundle-д хэзээ ч орохгүй, зөвхөн серверийн middleware уншина
  const qpayEnv = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'QPAY_')
  // http горимд `/api/*`-ийг backend руу дамжуулна (CORS шаардлагагүй). Зөвхөн dev сервер уншина.
  const apiTarget = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'API_').API_PROXY_TARGET || 'http://localhost:3000'
  return {
    // GitHub Pages дээр /<repo>/ дэд замаар үйлчилнэ
    base: process.env.BASE_PATH ?? '/',
    plugins: [react(), tailwindcss(), qpayPlugin(qpayEnv)],
    server: {
      proxy: {
        // `/api/qpay/*`-ийг qpay plugin түрүүлж барина (mock горим); бусад нь backend руу
        '/api': { target: apiTarget, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      },
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['src/test/setup.ts'],
      exclude: ['e2e/**', 'node_modules/**'],
    },
  }
})
