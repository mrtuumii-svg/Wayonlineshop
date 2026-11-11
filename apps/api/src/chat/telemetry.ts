/**
 * Telemetry (13-р хичээл): model-ийн дуудлага бүрийг `LlmCall` хүснэгтэд бичиж,
 * зардал, хурд, алдааг тоогоор харна.
 */
import type { FastifyBaseLogger } from 'fastify'
import type { Config } from '../config.js'
import type { PrismaClient } from '../db.js'
import type { LlmUsage } from './llm.js'

type Prices = Pick<Config, 'LLM_PRICE_INPUT_PER_MTOK' | 'LLM_PRICE_CACHED_PER_MTOK' | 'LLM_PRICE_OUTPUT_PER_MTOK'>

/**
 * Token → доллар. OpenAI хэлбэрт `inputTokens` нь cache-ээс уншсаныг АГУУЛДАГ тул
 * энгийн input = нийт − cache. Зөвхөн нийтээр тооцвол cache-ийн хэмнэлт харагдахгүй.
 */
export function costUsd(usage: LlmUsage, prices: Prices): number {
  const cached = Math.min(usage.cachedTokens, usage.inputTokens)
  const plain = usage.inputTokens - cached
  return (
    (plain * prices.LLM_PRICE_INPUT_PER_MTOK +
      cached * prices.LLM_PRICE_CACHED_PER_MTOK +
      usage.outputTokens * prices.LLM_PRICE_OUTPUT_PER_MTOK) /
    1_000_000
  )
}

export interface LlmCallRow {
  conversationId: string | null
  traceId: string
  step?: number
  model: string
  usage?: LlmUsage
  costUsd?: number
  durationMs: number
  stopReason?: string | null
  error?: string | null
}

/**
 * Нэг мөр бичнэ. Log бичих алдаа хэрэглэгчийн хариуг ХЭЗЭЭ Ч зогсоохгүй —
 * чадахгүй бол серверийн log-д анхааруулаад үргэлжилнэ.
 */
export async function recordLlmCall(prisma: PrismaClient, log: FastifyBaseLogger, row: LlmCallRow): Promise<void> {
  try {
    await prisma.llmCall.create({
      data: {
        conversationId: row.conversationId,
        traceId: row.traceId,
        step: row.step ?? 1,
        model: row.model,
        inputTokens: row.usage?.inputTokens ?? 0,
        cachedTokens: row.usage?.cachedTokens ?? 0,
        outputTokens: row.usage?.outputTokens ?? 0,
        costUsd: row.costUsd ?? 0,
        durationMs: row.durationMs,
        stopReason: row.stopReason ?? null,
        error: row.error ?? null,
      },
    })
  } catch (err) {
    log.warn({ err }, 'LlmCall бичиж чадсангүй (хариуд нөлөөлөхгүй)')
  }
}

const startOfTodayUtc = () => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Өнөөдрийн зардал төсвөөс давбал log-д анхааруулна. Жинхэнэ мэдэгдэл (cron) 25-р хичээлд. */
export async function checkDailyBudget(prisma: PrismaClient, log: FastifyBaseLogger, budgetUsd: number): Promise<void> {
  if (budgetUsd <= 0) return
  try {
    const { _sum } = await prisma.llmCall.aggregate({ where: { createdAt: { gte: startOfTodayUtc() } }, _sum: { costUsd: true } })
    const spent = Number(_sum.costUsd ?? 0)
    if (spent > budgetUsd) log.warn({ spentUsd: spent, budgetUsd }, 'Өнөөдрийн AI зардал төсвөөс давлаа')
  } catch (err) {
    log.warn({ err }, 'Өдрийн төсвийг шалгаж чадсангүй')
  }
}

export interface LlmMetrics {
  since: string
  calls: number
  conversations: number
  totalCostUsd: number
  costPerConversationUsd: number
  /** Нэг хариултад (trace) хэдэн дуудлага — agent loop давтагдвал өснө */
  callsPerReply: number
  /** Input-ийн хэдэн хувь cache-ээс уншигдсан (0–1). Гэнэт 0 болбол prompt-ын эхлэл өөрчлөгдсөн */
  cacheHitRate: number
  /** Хариултуудын 95% нь үүнээс хурдан (ms) */
  p95DurationMs: number
  /** Алдаатай дуудлагын хувь (0–1) */
  errorRate: number
}

/** Өдөр бүр харах 6 тоо (§4) — нэг SQL-ээр */
export async function llmMetrics(prisma: PrismaClient, since: Date): Promise<LlmMetrics> {
  const [r] = await prisma.$queryRaw<
    {
      calls: bigint
      conversations: bigint
      traces: bigint
      cost: number | null
      input: bigint | null
      cached: bigint | null
      p95: number | null
      errors: bigint
    }[]
  >`
    SELECT COUNT(*)                                                    AS calls,
           COUNT(DISTINCT "conversationId")                            AS conversations,
           COUNT(DISTINCT "traceId")                                   AS traces,
           SUM("costUsd")::float8                                      AS cost,
           SUM("inputTokens")                                          AS input,
           SUM("cachedTokens")                                         AS cached,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")  AS p95,
           COUNT(*) FILTER (WHERE "error" IS NOT NULL)                 AS errors
    FROM "LlmCall"
    WHERE "createdAt" >= ${since}`

  const calls = Number(r?.calls ?? 0)
  const conversations = Number(r?.conversations ?? 0)
  const traces = Number(r?.traces ?? 0)
  const cost = r?.cost ?? 0
  const input = Number(r?.input ?? 0)
  const ratio = (a: number, b: number) => (b > 0 ? a / b : 0)

  return {
    since: since.toISOString(),
    calls,
    conversations,
    totalCostUsd: cost,
    costPerConversationUsd: ratio(cost, conversations),
    callsPerReply: ratio(calls, traces),
    cacheHitRate: ratio(Number(r?.cached ?? 0), input),
    p95DurationMs: Math.round(r?.p95 ?? 0),
    errorRate: ratio(Number(r?.errors ?? 0), calls),
  }
}
