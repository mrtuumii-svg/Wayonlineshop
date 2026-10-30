import type { FastifyInstance } from 'fastify'
import { seed } from '../../prisma/seed.js'
import { type ChatMessage, type Llm, LlmUnavailableError } from '../chat/llm.js'
import { createTestPrisma, resetDb } from '../test/db.js'
import { buildTestApp } from '../test/testApp.js'

const prisma = createTestPrisma()
let app: FastifyInstance

/** Бодит model-ийн оронд: дуудлагыг тэмдэглээд урьдчилан тогтоосон хариу буцаана */
function fakeLlm(result: string | Error = 'Тийм, байна.') {
  const calls: { system: string; messages: ChatMessage[]; maxTokens: number }[] = []
  const llm: Llm = {
    async complete(input) {
      calls.push(input)
      if (result instanceof Error) throw result
      return { text: result, usage: { inputTokens: 100, outputTokens: 10 } }
    },
  }
  return { llm, calls }
}

async function start(llm: Llm | null) {
  app = await buildTestApp({}, { llm })
  await app.ready()
}

const chat = (payload: unknown) => app.inject({ method: 'POST', url: '/chat', payload: payload as object })
const ask = (message: string, conversationId?: string) => chat({ message, conversationId })
const getConversation = (id: string) => app.inject({ method: 'GET', url: `/chat/${id}` })

beforeEach(async () => {
  await resetDb(prisma)
  await seed(prisma)
})

afterEach(async () => {
  await app?.close()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /chat', () => {
  it('model-ийн хариуг буцаана', async () => {
    const { llm } = fakeLlm('React эхлэл 49,000₮.')
    await start(llm)

    const res = await ask('React хичээл хэд вэ?')

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ reply: 'React эхлэл 49,000₮.', conversationId: expect.any(String) })
  })

  it('system prompt-д журам ба сангийн хичээлүүд орно (grounding)', async () => {
    const { llm, calls } = fakeLlm()
    await start(llm)

    await ask('Ямар хичээл байна?')

    const system = calls[0]?.system ?? ''
    expect(system).toContain('# Дүр')
    expect(system).toContain('QPay')
    expect(system).toContain('React эхлэл | 49,000₮ | Анхан шат | Програмчлал')
    expect(system).not.toContain('{{POLICY}}')
    expect(system).not.toContain('{{COURSES}}')
  })

  it('үнэ сан дээр өөрчлөгдмөгц дараагийн хүсэлтэд шинэ үнэ явна', async () => {
    const { llm, calls } = fakeLlm()
    await start(llm)

    await prisma.course.update({ where: { slug: 'react-ekhlel' }, data: { price: 39000 } })
    await ask('React хэд вэ?')

    expect(calls[0]?.system).toContain('React эхлэл | 39,000₮')
  })

  it('шинэ яриа үүсгэж, асуулт + хариуг token-той нь сан дээр хадгална', async () => {
    const { llm } = fakeLlm('Сайн байна уу!')
    await start(llm)

    const res = await ask('Сайн уу')

    const { conversationId } = res.json()
    const saved = await prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } })
    expect(saved.map((m) => [m.role, m.content, m.inputTokens, m.outputTokens])).toEqual([
      ['user', 'Сайн уу', null, null],
      ['assistant', 'Сайн байна уу!', 100, 10],
    ])
  })

  it('дараагийн асуултад түүхийг сангаас уншиж model-д дамжуулна', async () => {
    const { llm, calls } = fakeLlm('Сайн байна уу!')
    await start(llm)

    const { conversationId } = (await ask('Сайн уу')).json()
    const res = await ask('Дизайны хичээл байна уу?', conversationId)

    expect(res.json().conversationId).toBe(conversationId)
    expect(calls[1]?.messages).toEqual([
      { role: 'user', content: 'Сайн уу' },
      { role: 'assistant', content: 'Сайн байна уу!' },
      { role: 'user', content: 'Дизайны хичээл байна уу?' },
    ])
    expect(calls[1]?.maxTokens).toBeGreaterThan(0)
  })

  it('GET /chat/:id яриаг дарааллаар нь буцаана (refresh-ийн дараа)', async () => {
    const { llm } = fakeLlm('Хариу')
    await start(llm)
    const { conversationId } = (await ask('Асуулт 1')).json()
    await ask('Асуулт 2', conversationId)

    const res = await getConversation(conversationId)

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      id: conversationId,
      messages: [
        { role: 'user', content: 'Асуулт 1' },
        { role: 'assistant', content: 'Хариу' },
        { role: 'user', content: 'Асуулт 2' },
        { role: 'assistant', content: 'Хариу' },
      ],
    })
  })

  it.each(['00000000-0000-4000-8000-000000000000', 'not-a-uuid'])('байхгүй яриа (%s) → 404', async (id) => {
    const { llm, calls } = fakeLlm()
    await start(llm)

    expect((await getConversation(id)).statusCode).toBe(404)
    expect((await ask('Сайн уу', '00000000-0000-4000-8000-000000000000')).statusCode).toBe(404)
    expect(calls).toHaveLength(0)
  })

  it('model алдаа өгвөл юу ч хадгалахгүй', async () => {
    const { llm } = fakeLlm(new LlmUnavailableError('HTTP 503'))
    await start(llm)

    await ask('Сайн уу')

    expect(await prisma.conversation.count()).toBe(0)
    expect(await prisma.message.count()).toBe(0)
  })

  it('яриа хэт урт бол 400, model дуудахгүй', async () => {
    const { llm, calls } = fakeLlm()
    await start(llm)
    const conversation = await prisma.conversation.create({
      data: {
        messages: {
          create: Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? ('assistant' as const) : ('user' as const), content: `${i}` })),
        },
      },
    })

    const res = await ask('Дахиад нэг', conversation.id)

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('Шинэ яриа')
    expect(calls).toHaveLength(0)
  })

  it.each([
    ['хоосон мессеж', { message: '   ' }],
    ['хэт урт мессеж', { message: 'а'.repeat(2001) }],
    ['message байхгүй', {}],
    ['хуучин хэлбэр (бүх түүхийг клиент илгээх)', { messages: [{ role: 'user', content: 'Сайн уу' }] }],
    ['буруу conversationId', { message: 'Сайн уу', conversationId: 'abc' }],
  ])('буруу хүсэлт (%s) → 400, model дуудахгүй', async (_name, payload) => {
    const { llm, calls } = fakeLlm()
    await start(llm)

    const res = await chat(payload)

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('VALIDATION')
    expect(calls).toHaveLength(0)
  })

  it('model түр ажиллахгүй бол 503 + эелдэг мессеж', async () => {
    const { llm } = fakeLlm(new LlmUnavailableError('HTTP 503'))
    await start(llm)

    const res = await ask('Сайн уу')

    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ code: 'UNAVAILABLE', message: expect.stringContaining('түр завгүй') })
  })

  it('гэнэтийн алдааны дэлгэрэнгүй хариунд гарахгүй', async () => {
    const { llm } = fakeLlm(new Error('LLM хүсэлт амжилтгүй: HTTP 401 invalid key'))
    await start(llm)

    const res = await ask('Сайн уу')

    expect(res.statusCode).toBe(500)
    expect(res.body).not.toContain('invalid key')
  })

  it('key тохируулаагүй бол 503', async () => {
    await start(null)

    const res = await ask('Сайн уу')

    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBe('UNAVAILABLE')
  })

  it('минутад 20-оос олон хүсэлтийг хязгаарлана (model-ийн дуудлага мөнгө)', async () => {
    const { llm } = fakeLlm()
    await start(llm)

    for (let i = 0; i < 20; i++) expect((await ask('Сайн уу')).statusCode).toBe(200)
    const res = await ask('Сайн уу')

    expect(res.statusCode).toBe(429)
  })
})
