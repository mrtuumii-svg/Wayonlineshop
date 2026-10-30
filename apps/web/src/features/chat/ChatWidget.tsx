import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useApi } from '@/api/ApiProvider'
import { isApiError } from '@/api/errors'
import type { ChatMessage } from '@/api/types'

const GREETING = 'Сайн байна уу! Way Academy-ийн хичээл, үнэ, төлбөрийн талаар асуугаарай.'

/**
 * Баруун доод булангийн AI туслах.
 * Яриа зөвхөн React state-д байгаа тул refresh хийхэд алга болно (Хичээл 10-д DB-д хадгална).
 */
export function ChatWidget() {
  const api = useApi()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Шинэ мессеж ирэхэд доош гүйлгэнэ
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, sending, open])

  async function send(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setError(null)
    setSending(true)
    try {
      const { reply } = await api.chat(next)
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Алдаа гарлаа. Дахин оролдоно уу.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <section
          aria-label="AI туслах"
          className="flex h-[min(32rem,calc(100vh-6rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <header className="flex items-center justify-between bg-brand-600 px-4 py-3 text-white">
            <h2 className="text-sm font-semibold">Way Academy туслах</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Хаах"
              className="rounded-lg px-2 text-lg leading-none hover:bg-white/15"
            >
              ×
            </button>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm" aria-live="polite">
            <Bubble role="assistant" content={GREETING} />
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} />
            ))}
            {sending && <p className="text-slate-500">Бичиж байна…</p>}
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-red-700">
                {error}
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
            <label htmlFor="chat-input" className="sr-only">
              Мессеж
            </label>
            <input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Асуултаа бичнэ үү…"
              maxLength={2000}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Илгээх
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Туслахыг хаах' : 'Туслахтай ярих'}
        className="grid size-14 place-items-center rounded-full bg-brand-600 text-2xl text-white shadow-lg transition hover:bg-brand-700 active:scale-95"
      >
        {open ? '×' : '💬'}
      </button>
    </div>
  )
}

function Bubble({ role, content }: ChatMessage) {
  const mine = role === 'user'
  return (
    <p
      className={`max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap ${
        mine ? 'ml-auto bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
      }`}
    >
      {content}
    </p>
  )
}
