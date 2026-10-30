import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiProvider } from '@/api/ApiProvider'
import type { ApiClient } from '@/api/client'
import { ApiError } from '@/api/errors'
import type { ChatRequest } from '@/api/types'
import { ChatWidget } from './ChatWidget'

const ID = '11111111-1111-4111-8111-111111111111'

/** Сервер шиг: яриаг санах ойд хадгалж, chat/getConversation-ийг хариулна */
function fakeChatApi() {
  const db = new Map<string, { role: 'user' | 'assistant'; content: string }[]>()
  const requests: ChatRequest[] = []
  const api = {
    async chat(input: ChatRequest) {
      requests.push(input)
      const id = input.conversationId ?? ID
      const reply = `Хариу: ${input.message}`
      db.set(id, [...(db.get(id) ?? []), { role: 'user', content: input.message }, { role: 'assistant', content: reply }])
      return { conversationId: id, reply }
    },
    async getConversation(id: string) {
      const messages = db.get(id)
      if (!messages) throw new ApiError('NOT_FOUND', 'Яриа олдсонгүй')
      return { id, messages }
    },
  } as unknown as ApiClient
  return { api, db, requests }
}

function renderWidget(api: ApiClient) {
  const user = userEvent.setup()
  const view = render(
    <ApiProvider api={api}>
      <ChatWidget />
    </ApiProvider>,
  )
  return { user, ...view }
}

async function ask(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByLabelText('Мессеж'), text)
  await user.click(screen.getByRole('button', { name: 'Илгээх' }))
  await screen.findByText(`Хариу: ${text}`)
}

// jsdom-д scrollIntoView байхгүй
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => localStorage.clear())

test('эхний асуулт шинэ яриа үүсгэж, дугаарыг localStorage-д хадгална', async () => {
  const { api, requests } = fakeChatApi()
  const { user } = renderWidget(api)

  await user.click(screen.getByRole('button', { name: 'Туслахтай ярих' }))
  await ask(user, 'Сайн уу')
  await ask(user, 'Үнэ хэд вэ?')

  expect(localStorage.getItem('way-chat-conversation')).toBe(ID)
  // Зөвхөн шинэ мессеж явна, түүх биш
  expect(requests).toEqual([{ message: 'Сайн уу' }, { conversationId: ID, message: 'Үнэ хэд вэ?' }])
})

test('refresh-ийн дараа яриаг сангаас сэргээнэ', async () => {
  const { api } = fakeChatApi()
  const first = renderWidget(api)
  await first.user.click(screen.getByRole('button', { name: 'Туслахтай ярих' }))
  await ask(first.user, 'Сайн уу')
  first.unmount() // = refresh

  const { user } = renderWidget(api)
  await user.click(screen.getByRole('button', { name: 'Туслахтай ярих' }))

  expect(await screen.findByText('Сайн уу')).toBeInTheDocument()
  expect(screen.getByText('Хариу: Сайн уу')).toBeInTheDocument()
})

test('сан дээр байхгүй дугаарыг устгаж шинээр эхэлнэ', async () => {
  localStorage.setItem('way-chat-conversation', 'deleted-id')
  const { api, requests } = fakeChatApi()
  const { user } = renderWidget(api)

  await user.click(screen.getByRole('button', { name: 'Туслахтай ярих' }))
  await ask(user, 'Сайн уу')

  expect(requests[0]).toEqual({ message: 'Сайн уу' })
  expect(localStorage.getItem('way-chat-conversation')).toBe(ID)
})

test('«Шинэ яриа» номерыг хаяж, дэлгэцийг цэвэрлэнэ', async () => {
  const { api, requests } = fakeChatApi()
  const { user } = renderWidget(api)
  await user.click(screen.getByRole('button', { name: 'Туслахтай ярих' }))
  await ask(user, 'Сайн уу')

  await user.click(screen.getByRole('button', { name: 'Шинэ яриа' }))

  expect(screen.queryByText('Хариу: Сайн уу')).not.toBeInTheDocument()
  expect(localStorage.getItem('way-chat-conversation')).toBeNull()
  expect(screen.getByRole('button', { name: 'Шинэ яриа' })).toBeDisabled()

  await ask(user, 'Дахин сайн уу')
  expect(requests.at(-1)).toEqual({ message: 'Дахин сайн уу' })
})

test('алдаа гарвал асуултыг буцааж оруулна', async () => {
  const api = {
    chat: () => Promise.reject(new ApiError('UNAVAILABLE', 'Туслах түр завгүй байна.')),
    getConversation: () => Promise.reject(new ApiError('NOT_FOUND', 'x')),
  } as unknown as ApiClient
  const { user } = renderWidget(api)

  await user.click(screen.getByRole('button', { name: 'Туслахтай ярих' }))
  await user.type(screen.getByLabelText('Мессеж'), 'Сайн уу')
  await user.click(screen.getByRole('button', { name: 'Илгээх' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Туслах түр завгүй байна.')
  expect(screen.getByLabelText('Мессеж')).toHaveValue('Сайн уу')
  expect(localStorage.getItem('way-chat-conversation')).toBeNull()
})
