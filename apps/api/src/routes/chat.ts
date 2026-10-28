import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { LlmUnavailableError } from '../chat/llm.js'
import { buildSystemPrompt } from '../chat/prompt.js'
import { unavailable, validation } from '../errors.js'

/** Хариултын дээд хязгаар (token). System prompt-ын "1–3 өгүүлбэр"-ийн хамгаалалт. */
const MAX_TOKENS = 500
const MESSAGE_MAX_CHARS = 2000
const HISTORY_MAX = 40

/** Model-ийн дуудлага бүр мөнгө — ердийн квотоос хатуу */
const CHAT_RATE_LIMIT = { max: 20, timeWindow: '1 minute' }

const BUSY_MESSAGE = 'Туслах түр завгүй байна. Хэсэг хүлээгээд дахин оролдоно уу.'

const chatBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1, 'Мессеж хоосон байна').max(MESSAGE_MAX_CHARS, 'Мессеж хэт урт байна'),
      }),
    )
    .min(1, 'Мессеж хоосон байна')
    .max(HISTORY_MAX, 'Яриа хэт урт байна. Шинэ яриа эхлүүлнэ үү.')
    .refine((m) => m.at(-1)?.role === 'user', 'Сүүлийн мессеж хэрэглэгчийнх байх ёстой'),
})

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post('/chat', { config: { rateLimit: CHAT_RATE_LIMIT } }, async (req) => {
    const parsed = chatBody.safeParse(req.body)
    if (!parsed.success) throw validation(parsed.error.issues[0]?.message ?? 'Хүсэлтийн өгөгдөл буруу байна')

    if (!app.llm) throw unavailable('Туслах одоогоор тохируулагдаагүй байна.')

    const system = await buildSystemPrompt(app.prisma)
    try {
      const { text, usage } = await app.llm.complete({ system, messages: parsed.data.messages, maxTokens: MAX_TOKENS })
      req.log.info({ model: app.config.LLM_MODEL, ...usage }, 'chat usage')
      return { reply: text }
    } catch (err) {
      if (err instanceof LlmUnavailableError) {
        req.log.warn({ err }, 'LLM түр ажиллахгүй')
        throw unavailable(BUSY_MESSAGE)
      }
      throw err
    }
  })
}
