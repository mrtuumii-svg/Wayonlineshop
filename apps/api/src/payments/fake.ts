import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { validation } from '../errors.js'
import type { DeliverWebhook, PaymentProvider } from './provider.js'

export const FAKE_SIGNATURE_HEADER = 'x-fake-signature'

type FakeStatus = 'paid' | 'failed'

/** `invoiceId:status`-ийн HMAC-SHA256 (hex). Статус ч гарын үсэгт орсон тул "failed"-ийг "paid" болгож хуурах боломжгүй. */
export function signFakeWebhook(secret: string, invoiceId: string, status: FakeStatus): string {
  return createHmac('sha256', secret).update(`${invoiceId}:${status}`).digest('hex')
}

const webhookBody = z.object({
  invoiceId: z.string().min(1).max(64),
  status: z.enum(['paid', 'failed']),
})

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Туршилтын QR — банкны апп уншихгүй, зөвхөн UI-д харагдах дүрс */
function fakeQr(invoiceId: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#fff"/><rect x="8" y="8" width="24" height="24" fill="#0f172a"/><rect x="64" y="8" width="24" height="24" fill="#0f172a"/><rect x="8" y="64" width="24" height="24" fill="#0f172a"/><rect x="44" y="44" width="12" height="12" fill="#0f172a"/></svg>`
  return { text: `way-fake-invoice:${invoiceId}`, image: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }
}

export interface FakeProviderOptions {
  secret: string
  /** Нэхэмжлэх үүсгэснээс хойш хэдэн ms-ийн дараа өөрөө "paid" webhook илгээх. 0 = илгээхгүй. */
  payAfterMs: number
  deliver: DeliverWebhook
  onDeliverError?: (err: unknown) => void
}

/**
 * Хөгжүүлэлтийн провайдер: бодит мөнгө хөдлөхгүй. Бодит провайдертой ижил асинхрон
 * урсгалыг (invoice → pending → webhook → paid) дуурайна. Production-д config хориглоно.
 */
export function createFakeProvider(opts: FakeProviderOptions): PaymentProvider {
  const timers = new Set<NodeJS.Timeout>()
  let closed = false

  function scheduleAutoPay(invoiceId: string) {
    if (opts.payAfterMs <= 0 || closed) return
    const t = setTimeout(() => {
      timers.delete(t)
      if (closed) return
      const status: FakeStatus = 'paid'
      opts
        .deliver({ invoiceId, status }, { [FAKE_SIGNATURE_HEADER]: signFakeWebhook(opts.secret, invoiceId, status) })
        .catch((err: unknown) => opts.onDeliverError?.(err))
    }, opts.payAfterMs)
    // Таймер процессыг амьд байлгах ёсгүй
    t.unref()
    timers.add(t)
  }

  return {
    name: 'fake',

    async createInvoice() {
      const invoiceId = randomUUID()
      scheduleAutoPay(invoiceId)
      return { invoiceId, qr: fakeQr(invoiceId) }
    },

    async verifyWebhook({ body, headers }) {
      const parsed = webhookBody.safeParse(body)
      const signature = headers[FAKE_SIGNATURE_HEADER]
      if (!parsed.success || typeof signature !== 'string') throw validation('Webhook буруу байна')

      const expected = signFakeWebhook(opts.secret, parsed.data.invoiceId, parsed.data.status)
      if (!safeEqual(signature, expected)) throw validation('Webhook-ийн гарын үсэг буруу байна')

      return { invoiceId: parsed.data.invoiceId, paid: parsed.data.status === 'paid' }
    },

    // Fake-д мөнгө зөвхөн гарын үсэгтэй webhook-оор орно — асуухад үргэлж "хүлээгдэж буй"
    async checkPayment() {
      return 'pending'
    },

    async cancelInvoice() {},

    close() {
      closed = true
      for (const t of timers) clearTimeout(t)
      timers.clear()
    },
  }
}
