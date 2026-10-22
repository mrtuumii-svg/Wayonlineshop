/**
 * Төлбөрийн провайдерын абстракци. Endpoint-ийн код зөвхөн үүгээр харилцана —
 * `fake`-ийг `qpay`-ээр солиход routes/orders.ts өөрчлөгдөхгүй.
 */
export interface Invoice {
  invoiceId: string
  qr: { text: string; image: string }
}

export interface WebhookResult {
  invoiceId: string
  paid: boolean
}

export interface WebhookRequest {
  body: unknown
  headers: Record<string, string | string[] | undefined>
}

export interface PaymentProvider {
  /** `Order.provider`-т хадгалагдана */
  readonly name: string
  createInvoice(o: { orderId: string; amount: number }): Promise<Invoice>
  /**
   * Webhook жинхэнэ эсэхийг шалгана (гарын үсэг, эсвэл провайдерын API-аас дахин асуух).
   * Хуурамч бол `AppError('VALIDATION')` шиднэ — захиалгын статус хөдлөхгүй.
   */
  verifyWebhook(req: WebhookRequest): Promise<WebhookResult>
  /** Апп хаагдахад хүлээгдэж буй ажлыг (таймер г.м.) цуцална */
  close(): void
}

/** Провайдер өөрөө webhook илгээх шаардлагатай үед (fake) апп руу хүргэх функц */
export type DeliverWebhook = (payload: unknown, headers: Record<string, string>) => Promise<void>
