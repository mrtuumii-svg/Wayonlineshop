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
  ...over,
})

/** Сүлжээнд listen хийхгүй — `app.inject()`-ээр хүсэлт симуляци хийнэ. */
export const buildTestApp = (over?: Partial<Config>) => buildApp(testConfig(over))
