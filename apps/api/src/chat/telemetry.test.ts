import type { FastifyBaseLogger } from 'fastify'
import { createTestPrisma, resetDb } from '../test/db.js'
import { buildTestApp } from '../test/testApp.js'
import { checkDailyBudget, costUsd, llmMetrics } from './telemetry.js'

const prisma = createTestPrisma()

beforeEach(async () => {
  await resetDb(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

const prices = { LLM_PRICE_INPUT_PER_MTOK: 1, LLM_PRICE_CACHED_PER_MTOK: 0.1, LLM_PRICE_OUTPUT_PER_MTOK: 5 }

describe('costUsd', () => {
  it('гарын авлагын §3-ийн дасгал: input 500, cache 5,000, output 200 → $0.0020', () => {
    // OpenAI хэлбэрт inputTokens нь cache-ийг агуулна: 500 + 5,000
    expect(costUsd({ inputTokens: 5500, cachedTokens: 5000, outputTokens: 200 }, prices)).toBeCloseTo(0.002, 10)
  })

  it('cache-гүй бол бүх input энгийн үнээр', () => {
    expect(costUsd({ inputTokens: 5500, cachedTokens: 0, outputTokens: 200 }, prices)).toBeCloseTo(0.0065, 10)
  })

  it('cache нийтээс их гэж ирвэл сөрөг тоо гаргахгүй', () => {
    expect(costUsd({ inputTokens: 100, cachedTokens: 500, outputTokens: 0 }, prices)).toBeCloseTo(0.00001, 10)
  })
})

const call = (over: object = {}) => ({
  traceId: 't1',
  conversationId: 'c1',
  model: 'm',
  inputTokens: 1000,
  cachedTokens: 0,
  outputTokens: 10,
  costUsd: 0.001,
  durationMs: 1000,
  ...over,
})

describe('llmMetrics', () => {
  it('хоосон үед бүгд 0 (0-д хуваахгүй)', async () => {
    const m = await llmMetrics(prisma, new Date(0))
    expect(m).toMatchObject({ calls: 0, totalCostUsd: 0, costPerConversationUsd: 0, cacheHitRate: 0, p95DurationMs: 0, errorRate: 0 })
  })

  it('6 тоог зөв тооцно', async () => {
    await prisma.llmCall.createMany({
      data: [
        // яриа c1: нэг хариулт, 2 эргэлт (agent loop)
        call({ traceId: 't1', step: 1, cachedTokens: 800 }),
        call({ traceId: 't1', step: 2, cachedTokens: 800 }),
        // яриа c2: нэг хариулт, алдаатай
        call({ traceId: 't2', conversationId: 'c2', inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 9000, error: 'HTTP 429' }),
        // хуучин мөр — тоонд орохгүй
        call({ traceId: 'old', costUsd: 100, createdAt: new Date('2020-01-01') }),
      ],
    })

    const m = await llmMetrics(prisma, new Date('2021-01-01'))

    expect(m.calls).toBe(3)
    expect(m.conversations).toBe(2)
    expect(m.totalCostUsd).toBeCloseTo(0.002, 8)
    expect(m.costPerConversationUsd).toBeCloseTo(0.001, 8)
    expect(m.callsPerReply).toBe(1.5)
    expect(m.cacheHitRate).toBeCloseTo(0.8, 8) // 1,600 / 2,000
    expect(m.p95DurationMs).toBe(8200) // [1000, 1000, 9000]-ийн 95%
    expect(m.errorRate).toBeCloseTo(1 / 3, 8)
  })
})

describe('checkDailyBudget', () => {
  const fakeLog = () => {
    const warns: unknown[][] = []
    return { log: { warn: (...a: unknown[]) => warns.push(a) } as unknown as FastifyBaseLogger, warns }
  }

  it('төсвөөс давбал анхааруулна, доор бол чимээгүй', async () => {
    await prisma.llmCall.create({ data: call({ costUsd: 3 }) })

    const under = fakeLog()
    await checkDailyBudget(prisma, under.log, 5)
    expect(under.warns).toHaveLength(0)

    await prisma.llmCall.create({ data: call({ costUsd: 3 }) })
    const over = fakeLog()
    await checkDailyBudget(prisma, over.log, 5)
    expect(over.warns).toHaveLength(1)
    expect(over.warns[0]?.[0]).toMatchObject({ spentUsd: 6, budgetUsd: 5 })
  })

  it('0 бол шалгахгүй', async () => {
    await prisma.llmCall.create({ data: call({ costUsd: 999 }) })
    const l = fakeLog()
    await checkDailyBudget(prisma, l.log, 0)
    expect(l.warns).toHaveLength(0)
  })
})

describe('GET /admin/llm-metrics', () => {
  it('зөвхөн админд, days-ээр шүүнэ', async () => {
    const app = await buildTestApp()
    await app.ready()
    try {
      const register = async (email: string) =>
        (await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'Т', email, password: 'secret1' } })).json()
          .token as string
      const userToken = await register('u@example.com')
      const adminToken = await register('a@example.com')
      await prisma.user.update({ where: { email: 'a@example.com' }, data: { role: 'admin' } })
      await prisma.llmCall.create({ data: call() })

      const asUser = await app.inject({ method: 'GET', url: '/admin/llm-metrics', headers: { authorization: `Bearer ${userToken}` } })
      expect(asUser.statusCode).toBe(403)

      const res = await app.inject({ method: 'GET', url: '/admin/llm-metrics?days=7', headers: { authorization: `Bearer ${adminToken}` } })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ calls: 1, conversations: 1 })

      const bad = await app.inject({ method: 'GET', url: '/admin/llm-metrics?days=0', headers: { authorization: `Bearer ${adminToken}` } })
      expect(bad.statusCode).toBe(400)
    } finally {
      await app.close()
    }
  })
})
