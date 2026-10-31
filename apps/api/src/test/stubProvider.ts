import { randomUUID } from 'node:crypto'
import { validation } from '../errors.js'
import type { PaymentProvider, PaymentStatus } from '../payments/provider.js'

/** Тест удирддаг провайдер — QPay руу хандахгүйгээр callback/polling-ийн урсгалыг шалгана. */
export interface StubProvider extends PaymentProvider {
  /** `checkPayment`-ийн буцаах утга */
  status: PaymentStatus
  /** Тавибал `checkPayment` шиднэ */
  checkError: Error | null
  /** Тавибал `createInvoice` шиднэ */
  invoiceError: Error | null
  /** `checkPayment`-д ирсэн invoiceId-ууд */
  checks: string[]
  /** Тавибал `cancelInvoice` шиднэ */
  cancelError: Error | null
  /** `cancelInvoice`-д ирсэн invoiceId-ууд */
  cancels: string[]
  /** Дуудлагын дараалал: 'cancel' | 'check' */
  events: string[]
}

export function createStubProvider(name = 'qpay'): StubProvider {
  const stub: StubProvider = {
    name,
    status: 'pending',
    checkError: null,
    invoiceError: null,
    checks: [],
    cancelError: null,
    cancels: [],
    events: [],
    async createInvoice() {
      if (stub.invoiceError) throw stub.invoiceError
      const invoiceId = `stub_${randomUUID()}`
      return { invoiceId, qr: { text: invoiceId, image: 'data:image/png;base64,AAAA' } }
    },
    async verifyWebhook() {
      throw validation('stub')
    },
    async checkPayment(invoiceId) {
      stub.checks.push(invoiceId)
      stub.events.push('check')
      if (stub.checkError) throw stub.checkError
      return stub.status
    },
    async cancelInvoice(invoiceId) {
      stub.cancels.push(invoiceId)
      stub.events.push('cancel')
      if (stub.cancelError) throw stub.cancelError
    },
    close() {},
  }
  return stub
}
