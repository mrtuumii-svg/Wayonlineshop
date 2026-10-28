import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import { createOpenAiCompatibleLlm, type Llm } from './chat/llm.js'
import type { Config } from './config.js'
import { createPrisma, type PrismaClient } from './db.js'
import { registerErrorHandler } from './errorHandler.js'
import { createFakeProvider } from './payments/fake.js'
import type { PaymentProvider } from './payments/provider.js'
import { authRoutes } from './routes/auth.js'
import { chatRoutes } from './routes/chat.js'
import { courseRoutes } from './routes/courses.js'
import { healthRoutes } from './routes/health.js'
import { meRoutes } from './routes/me.js'
import { orderRoutes } from './routes/orders.js'

declare module 'fastify' {
  interface FastifyInstance {
    config: Config
    prisma: PrismaClient
    payments: PaymentProvider
    /** LLM_API_KEY байхгүй бол null — `/chat` 503 буцаана */
    llm: Llm | null
  }
}

/** Ердийн endpoint-уудын квот. `/auth/*` нь route дээрээ хатуу квоттой. */
const RATE_LIMIT_MAX = 100
const RATE_LIMIT_WINDOW = '1 minute'

/**
 * Тохиргоог параметрээр авна (глобал импорт биш) — тестэд хуурамч тохиргоотой
 * апп зохиож, сүлжээнд listen хийхгүйгээр `app.inject()`-ээр шалгах боломж өгнө.
 */
export async function buildApp(
  config: Config,
  deps: { prisma?: PrismaClient; llm?: Llm | null } = {},
): Promise<FastifyInstance> {
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

  const llm =
    deps.llm !== undefined
      ? deps.llm
      : config.LLM_API_KEY
        ? createOpenAiCompatibleLlm({ apiKey: config.LLM_API_KEY, baseUrl: config.LLM_BASE_URL, model: config.LLM_MODEL })
        : null
  app.decorate('llm', llm)

  // Fake провайдер "төлөгдсөн" webhook-ийг сүлжээгээр биш, апп руу шууд (inject) хүргэнэ —
  // гэхдээ бодит webhook-тэй яг ижил route, ижил гарын үсгийн шалгалтаар дамжина.
  const payments = createFakeProvider({
    secret: config.PAYMENT_WEBHOOK_SECRET,
    payAfterMs: config.FAKE_PAY_AFTER_MS,
    deliver: async (payload, headers) => {
      const res = await app.inject({ method: 'POST', url: '/payments/webhook', payload: payload as object, headers })
      if (res.statusCode !== 200) throw new Error(`fake webhook ${res.statusCode}: ${res.body}`)
    },
    onDeliverError: (err) => app.log.error({ err }, 'Fake төлбөрийн webhook амжилтгүй'),
  })
  app.decorate('payments', payments)

  // Эхлээд провайдерын таймеруудыг зогсооно, дараа нь DB-г хаана
  app.addHook('onClose', async () => payments.close())
  // Гаднаас өгсөн client-ийг эзэмшигч нь хаана
  if (!deps.prisma) app.addHook('onClose', () => prisma.$disconnect())

  await app.register(helmet)
  await app.register(cors, { origin: config.corsOrigins, credentials: true })
  await app.register(rateLimit, { max: RATE_LIMIT_MAX, timeWindow: RATE_LIMIT_WINDOW })

  registerErrorHandler(app)
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(courseRoutes)
  await app.register(orderRoutes)
  await app.register(meRoutes)
  await app.register(chatRoutes)

  return app
}
