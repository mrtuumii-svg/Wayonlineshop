import type { ChatConversation, ChatReply } from '@way/contract'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { LlmUnavailableError } from '../chat/llm.js'
import { buildSystemPrompt } from '../chat/prompt.js'
import { notFound, unavailable, validation } from '../errors.js'

/** Хариултын дээд хязгаар (token). System prompt-ын "1–3 өгүүлбэр"-ийн хамгаалалт. */
const MAX_TOKENS = 500
const MESSAGE_MAX_CHARS = 2000
/** Нэг ярианы мессежийн дээд тоо (асуулт + хариулт). Sliding window ирэх хүртэлх хамгаалалт. */
const HISTORY_MAX = 40

/** Model-ийн дуудлага бүр мөнгө — ердийн квотоос хатуу */
const CHAT_RATE_LIMIT = { max: 20, timeWindow: '1 minute' }

const BUSY_MESSAGE = 'Туслах түр завгүй байна. Хэсэг хүлээгээд дахин оролдоно уу.'
const NOT_FOUND_MESSAGE = 'Яриа олдсонгүй. Шинэ яриа эхлүүлнэ үү.'

/** Клиент зөвхөн шинэ мессежээ илгээнэ — түүхийг серверийн сангаас уншдаг тул хуурамчаар засах боломжгүй */
const chatBody = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1, 'Мессеж хоосон байна').max(MESSAGE_MAX_CHARS, 'Мессеж хэт урт байна'),
})

const conversationParams = z.object({ id: z.uuid() })

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post('/chat', { config: { rateLimit: CHAT_RATE_LIMIT } }, async (req): Promise<ChatReply> => {
    const parsed = chatBody.safeParse(req.body)
    if (!parsed.success) throw validation(parsed.error.issues[0]?.message ?? 'Хүсэлтийн өгөгдөл буруу байна')
    const { conversationId, message } = parsed.data

    if (!app.llm) throw unavailable('Туслах одоогоор тохируулагдаагүй байна.')

    // Өмнөх түүх: шинэ яриа бол хоосон
    let history: { role: 'user' | 'assistant'; content: string }[] = []
    if (conversationId) {
      const conversation = await app.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { messages: { orderBy: { createdAt: 'asc' }, select: { role: true, content: true } } },
      })
      if (!conversation) throw notFound(NOT_FOUND_MESSAGE)
      history = conversation.messages
    }
    if (history.length + 2 > HISTORY_MAX) throw validation('Яриа хэт урт байна. Шинэ яриа эхлүүлнэ үү.')

    const askedAt = new Date()
    const system = await buildSystemPrompt(app.prisma)
    let result
    try {
      result = await app.llm.complete({
        system,
        messages: [...history, { role: 'user', content: message }],
        maxTokens: MAX_TOKENS,
      })
    } catch (err) {
      if (err instanceof LlmUnavailableError) {
        req.log.warn({ err }, 'LLM түр ажиллахгүй')
        throw unavailable(BUSY_MESSAGE)
      }
      throw err
    }
    const { text, usage } = result
    req.log.info({ model: app.config.LLM_MODEL, ...usage }, 'chat usage')

    // Model амжилттай хариулсны дараа л хадгална — алдаа гарвал хагас яриа үлдэхгүй
    const messages = {
      create: [
        { role: 'user' as const, content: message, createdAt: askedAt },
        {
          role: 'assistant' as const,
          content: text,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          createdAt: new Date(Math.max(Date.now(), askedAt.getTime() + 1)),
        },
      ],
    }
    const saved = conversationId
      ? await app.prisma.conversation.update({ where: { id: conversationId }, data: { messages }, select: { id: true } })
      : await app.prisma.conversation.create({ data: { messages }, select: { id: true } })

    return { conversationId: saved.id, reply: text }
  })

  app.get('/chat/:id', async (req): Promise<ChatConversation> => {
    const params = conversationParams.safeParse(req.params)
    if (!params.success) throw notFound(NOT_FOUND_MESSAGE)

    const conversation = await app.prisma.conversation.findUnique({
      where: { id: params.data.id },
      select: { id: true, messages: { orderBy: { createdAt: 'asc' }, select: { role: true, content: true } } },
    })
    if (!conversation) throw notFound(NOT_FOUND_MESSAGE)
    return conversation
  })
}
