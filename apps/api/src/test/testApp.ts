import { buildApp } from '../app.js'
import type { Config } from '../config.js'
import { testDatabaseUrl } from './db.js'

/** Тестэд хүчинтэй тохиргоо. DATABASE_URL нь docker-compose-ийн тестийн сан. */
export const testConfig = (over: Partial<Config> = {}): Config => ({
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3000,
  DATABASE_URL: testDatabaseUrl,
  JWT_SECRET: 'test-secret-that-is-long-enough-32',
  corsOrigins: ['http://localhost:5173'],
  PAYMENT_PROVIDER: 'fake',
  PAYMENT_WEBHOOK_SECRET: 'test-webhook-secret-long-enough-32ch',
  // Тестэд автомат төлбөр унтраалттай — webhook-ийг тест өөрөө дуудна
  FAKE_PAY_AFTER_MS: 0,
  // Тестэд бодит model дуудахгүй — шаардлагатай тест fake `llm`-ийг deps-ээр өгнө
  LLM_BASE_URL: 'http://llm.invalid/v1',
  LLM_MODEL: 'test-model',
  LLM_TIMEOUT_MS: 30_000,
  CHAT_HISTORY_WINDOW: 4,
  // Тооцоо шалгахад амар тоонууд
  LLM_PRICE_INPUT_PER_MTOK: 1,
  LLM_PRICE_CACHED_PER_MTOK: 0.1,
  LLM_PRICE_OUTPUT_PER_MTOK: 5,
  LLM_DAILY_BUDGET_USD: 0,
  ...over,
})

/** Сүлжээнд listen хийхгүй — `app.inject()`-ээр хүсэлт симуляци хийнэ. */
export const buildTestApp = (over?: Partial<Config>, deps?: Parameters<typeof buildApp>[1]) =>
  buildApp(testConfig(over), deps)
