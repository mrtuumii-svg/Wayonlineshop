import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Config } from './config.js'
import { createPrisma, type PrismaClient } from './db.js'
import { registerErrorHandler } from './errorHandler.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'

declare module 'fastify' {
  interface FastifyInstance {
    config: Config
    prisma: PrismaClient
  }
}

/** Ердийн endpoint-уудын квот. `/auth/*` нь route дээрээ хатуу квоттой. */
const RATE_LIMIT_MAX = 100
const RATE_LIMIT_WINDOW = '1 minute'

/**
 * Тохиргоог параметрээр авна (глобал импорт биш) — тестэд хуурамч тохиргоотой
 * апп зохиож, сүлжээнд listen хийхгүйгээр `app.inject()`-ээр шалгах боломж өгнө.
 */
export async function buildApp(config: Config, deps: { prisma?: PrismaClient } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: config.NODE_ENV === 'production' ? 'info' : 'debug' },
    // Прокси цаад талд байхад client IP зөв тодорхойлогдож rate limit ажиллана
    trustProxy: config.NODE_ENV === 'production',
  })

  // DB холболт нь эхний query дээр л нээгдэнэ — DB шаардахгүй тестэд ч апп зохиоход асуудалгүй
  const prisma = deps.prisma ?? createPrisma(config.DATABASE_URL)
  app.decorate('config', config)
  app.decorate('prisma', prisma)
  app.decorateRequest('user', null)
  // Гаднаас өгсөн client-ийг эзэмшигч нь хаана
  if (!deps.prisma) app.addHook('onClose', () => prisma.$disconnect())

  await app.register(helmet)
  await app.register(cors, { origin: config.corsOrigins, credentials: true })
  await app.register(rateLimit, { max: RATE_LIMIT_MAX, timeWindow: RATE_LIMIT_WINDOW })

  registerErrorHandler(app)
  await app.register(healthRoutes)
  await app.register(authRoutes)

  return app
}
