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
}

export function createStubProvider(name = 'qpay'): StubProvider {
  const stub: StubProvider = {
    name,
    status: 'pending',
    checkError: null,
    invoiceError: null,
    checks: [],
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
      if (stub.checkError) throw stub.checkError
      return stub.status
    },
    close() {},
  }
  return stub
}
