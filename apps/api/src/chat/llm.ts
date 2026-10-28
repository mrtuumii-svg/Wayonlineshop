/**
 * AI model-той харилцах давхарга. OpenAI-ийн `/chat/completions` хэлбэрийг дагадаг
 * аль ч провайдер (Gemini, OpenAI, …) ажиллана — солихдоо зөвхөн `.env`-ийн
 * LLM_BASE_URL, LLM_MODEL, LLM_API_KEY-г өөрчилнө.
 */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LlmUsage {
  inputTokens: number
  outputTokens: number
}

export interface LlmResult {
  text: string
  usage: LlmUsage
}

export interface Llm {
  complete(input: { system: string; messages: ChatMessage[]; maxTokens: number }): Promise<LlmResult>
}

/** Провайдер түр ажиллахгүй (ачаалал, квот, timeout) — хэрэглэгчид "дахин оролдоно уу" гэж хэлнэ. */
export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmUnavailableError'
  }
}

interface CompletionResponse {
  choices?: { message?: { content?: string | null } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

const DEFAULT_TIMEOUT_MS = 20_000

export function createOpenAiCompatibleLlm(opts: {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs?: number
  fetchFn?: typeof fetch
}): Llm {
  const fetchFn = opts.fetchFn ?? fetch
  const url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`

  return {
    async complete({ system, messages, maxTokens }) {
      let res: Response
      try {
        res = await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
          body: JSON.stringify({
            model: opts.model,
            max_tokens: maxTokens,
            // System prompt нь messages жагсаалтын эхэнд тусдаа role-оор явна
            messages: [{ role: 'system', content: system }, ...messages],
          }),
          signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        })
      } catch (err) {
        // Timeout эсвэл сүлжээний алдаа
        throw new LlmUnavailableError(`LLM холбогдсонгүй: ${(err as Error).name}`)
      }

      // 429 (квот) ба 5xx (ачаалал) нь түр зуурын — бусад 4xx нь манай тохиргооны алдаа (key, model)
      if (res.status === 429 || res.status >= 500) {
        throw new LlmUnavailableError(`LLM түр ажиллахгүй: HTTP ${res.status}`)
      }
      if (!res.ok) {
        // Key-г хэзээ ч лог руу бичихгүй — зөвхөн статус ба провайдерын мессежийн эхлэл
        const detail = (await res.text().catch(() => '')).slice(0, 300)
        throw new Error(`LLM хүсэлт амжилтгүй: HTTP ${res.status} ${detail}`)
      }

      const body = (await res.json()) as CompletionResponse
      const text = body.choices?.[0]?.message?.content?.trim()
      if (!text) throw new LlmUnavailableError('LLM хоосон хариу буцаалаа')

      return {
        text,
        usage: {
          inputTokens: body.usage?.prompt_tokens ?? 0,
          outputTokens: body.usage?.completion_tokens ?? 0,
        },
      }
    },
  }
}
