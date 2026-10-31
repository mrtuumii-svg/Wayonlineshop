import type { QpayConfig } from '../config.js'
import { validation } from '../errors.js'
import type { PaymentProvider } from './provider.js'

/** QPay төлбөр орсны дараа дуудах route. Callback бол зөвхөн дохио — төлбөрийг API-аас шалгана. */
export const QPAY_CALLBACK_PATH = '/payments/qpay/callback'

const DEFAULT_TIMEOUT_MS = 10_000
/** Token-ийг дуусахаас өмнө шинэчлэх зай */
const TOKEN_MARGIN_MS = 60_000

/** QPay-тэй харилцахад гарсан алдаа. Мессежид path ба status л орно — secret, token, хариуны бие хэзээ ч үгүй. */
export class QpayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QpayError'
  }
}

export interface QpayProviderOptions extends Omit<QpayConfig, 'sandbox'> {
  /** Callback-ийн суурь хаяг (`PUBLIC_API_URL`) */
  callbackBaseUrl: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

interface TokenResponse {
  access_token: string
  expires_in: number
}

interface InvoiceResponse {
  invoice_id: string
  qr_text: string
  qr_image: string
}

interface CheckResponse {
  rows: { payment_status: string }[]
}

/** QPay v2 merchant API. Логик нь `apps/web/server/qpay.ts`-аас зөөгдсөн. */
export function createQpayProvider(opts: QpayProviderOptions): PaymentProvider {
  const fetch = opts.fetch ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const callbackBase = opts.callbackBaseUrl.replace(/\/+$/, '')
  let token: { value: string; expiresAt: number } | null = null

  async function send(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(`${opts.baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    } catch {
      throw new QpayError(`QPay ${path} сүлжээ`)
    }
  }

  async function readJson<T>(path: string, res: Response): Promise<T> {
    if (!res.ok) throw new QpayError(`QPay ${path} ${res.status}`)
    try {
      return (await res.json()) as T
    } catch {
      throw new QpayError(`QPay ${path} JSON биш хариу`)
    }
  }

  async function getToken(): Promise<string> {
    if (token && token.expiresAt > Date.now()) return token.value
    const basic = Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString('base64')
    const path = '/v2/auth/token'
    const body = await readJson<TokenResponse>(path, await send(path, { method: 'POST', headers: { Authorization: `Basic ${basic}` } }))
    // QPay expires_in-ийг unix секундээр буцаадаг, гэхдээ үргэлжлэх секунд ч байж болно
    const expiresAt = body.expires_in > 1e9 ? body.expires_in * 1000 : Date.now() + body.expires_in * 1000
    token = { value: body.access_token, expiresAt: expiresAt - TOKEN_MARGIN_MS }
    return token.value
  }

  async function call<T>(path: string, payload: unknown): Promise<T> {
    const post = async () =>
      send(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    let res = await post()
    if (res.status === 401) {
      // Token хугацаанаас өмнө хүчингүй болсон байж болно — нэг удаа шинэчилнэ
      token = null
      res = await post()
    }
    return readJson<T>(path, res)
  }

  return {
    name: 'qpay',

    async createInvoice({ orderId, amount }) {
      const inv = await call<InvoiceResponse>('/v2/invoice', {
        invoice_code: opts.invoiceCode,
        sender_invoice_no: orderId,
        invoice_receiver_code: 'terminal',
        invoice_description: 'Way Academy',
        amount,
        callback_url: `${callbackBase}${QPAY_CALLBACK_PATH}?order=${encodeURIComponent(orderId)}`,
      })
      return { invoiceId: inv.invoice_id, qr: { text: inv.qr_text, image: `data:image/png;base64,${inv.qr_image}` } }
    },

    async verifyWebhook() {
      throw validation('QPay-ийн төлбөрийг callback-аар шалгана')
    },

    async checkPayment(invoiceId) {
      const res = await call<CheckResponse>('/v2/payment/check', {
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 100 },
      })
      return res.rows.some((r) => r.payment_status === 'PAID') ? 'paid' : 'pending'
    },

    close() {},
  }
}
