import { createOpenAiCompatibleLlm, LlmUnavailableError } from './llm.js'

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

function setup(response: Response | Error) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    if (response instanceof Error) throw response
    return response
  }) as unknown as typeof fetch
  const llm = createOpenAiCompatibleLlm({ apiKey: 'k-123', baseUrl: 'https://llm.example/v1/', model: 'm-1', fetchFn })
  return { llm, calls }
}

const input = { system: 'SYS', messages: [{ role: 'user' as const, content: 'Сайн уу' }], maxTokens: 100 }

test('system prompt-ыг эхэнд нэмж, OpenAI хэлбэрээр илгээнэ', async () => {
  const { llm, calls } = setup(
    ok({ choices: [{ message: { content: ' Сайн байна уу! ' } }], usage: { prompt_tokens: 12, completion_tokens: 5 } }),
  )

  const res = await llm.complete(input)

  expect(res).toEqual({ text: 'Сайн байна уу!', usage: { inputTokens: 12, outputTokens: 5 } })
  expect(calls[0]?.url).toBe('https://llm.example/v1/chat/completions')
  expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe('Bearer k-123')
  expect(JSON.parse(calls[0]?.init.body as string)).toEqual({
    model: 'm-1',
    max_tokens: 100,
    messages: [
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'Сайн уу' },
    ],
  })
})

test.each([429, 500, 503])('HTTP %i нь түр зуурын алдаа', async (status) => {
  const { llm } = setup(new Response('busy', { status }))
  await expect(llm.complete(input)).rejects.toBeInstanceOf(LlmUnavailableError)
})

test('timeout/сүлжээний алдаа нь түр зуурын алдаа', async () => {
  const { llm } = setup(new DOMException('timeout', 'TimeoutError'))
  await expect(llm.complete(input)).rejects.toBeInstanceOf(LlmUnavailableError)
})

test('буруу key/model (4xx) нь жинхэнэ алдаа, key мессежид орохгүй', async () => {
  const { llm } = setup(new Response('{"error":"model not found"}', { status: 404 }))
  const err = await llm.complete(input).catch((e: unknown) => e)
  expect(err).not.toBeInstanceOf(LlmUnavailableError)
  expect((err as Error).message).toContain('404')
  expect((err as Error).message).not.toContain('k-123')
})

test('хоосон хариу нь түр зуурын алдаа, usage байхгүй бол 0', async () => {
  const empty = setup(ok({ choices: [{ message: { content: '' } }] }))
  await expect(empty.llm.complete(input)).rejects.toBeInstanceOf(LlmUnavailableError)

  const noUsage = setup(ok({ choices: [{ message: { content: 'Тийм' } }] }))
  expect((await noUsage.llm.complete(input)).usage).toEqual({ inputTokens: 0, outputTokens: 0 })
})
