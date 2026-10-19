/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { qpayPlugin } from './server/qpay.ts'

export default defineConfig(({ mode }) => {
  // QPAY_* нь VITE_ угтваргүй тул клиент bundle-д хэзээ ч орохгүй, зөвхөн серверийн middleware уншина
  const qpayEnv = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'QPAY_')
  return {
    // GitHub Pages дээр /<repo>/ дэд замаар үйлчилнэ
    base: process.env.BASE_PATH ?? '/',
    plugins: [react(), tailwindcss(), qpayPlugin(qpayEnv)],
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
