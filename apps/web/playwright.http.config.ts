import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath, URL } from 'node:url'

/**
 * E2E — бодит backend (`apps/api`) + тестийн DB-ийн эсрэг: `npm run e2e:http`.
 * Шаардлага: `docker compose up -d db-test` (эсвэл E2E_DATABASE_URL).
 *
 * Өгөгдөл устгахгүй: migration + idempotent seed л хийнэ, тест бүр шинэ имэйлээр бүртгүүлнэ.
 * Тиймээс дахин дахин ажиллуулж болно. Гэхдээ тестийн хэрэглэгч/захиалга үүсдэг тул production сан руу бүү заа.
 */
const WEB_PORT = 5175
const API_PORT = 3100
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://way:way_dev_only@localhost:5433/way_test'

export default defineConfig({
  testDir: 'e2e',
  // Бүх тест нэг сан, нэг API серверийг хуваалцана
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx prisma migrate deploy && npx prisma db seed && npx tsx src/server.ts',
      cwd: fileURLToPath(new URL('../api', import.meta.url)),
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        DATABASE_URL,
        // Зөвхөн E2E-д зориулсан, нууц биш утгууд
        JWT_SECRET: 'e2e-jwt-secret-not-for-production-use',
        PAYMENT_WEBHOOK_SECRET: 'e2e-webhook-secret-not-for-production',
        PAYMENT_PROVIDER: 'fake',
        FAKE_PAY_AFTER_MS: '500',
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
      },
    },
    {
      command: `npx vite --mode e2e --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { VITE_API_MODE: 'http', API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
})
