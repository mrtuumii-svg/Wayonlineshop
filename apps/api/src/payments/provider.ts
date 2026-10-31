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

export type PaymentStatus = 'paid' | 'pending'

export interface PaymentProvider {
  /** `Order.provider`-т хадгалагдана */
  readonly name: string
  createInvoice(o: { orderId: string; amount: number }): Promise<Invoice>
  /**
   * Гарын үсэгтэй webhook жинхэнэ эсэхийг шалгана. Хуурамч бол `AppError('VALIDATION')`
   * шиднэ — захиалгын статус хөдлөхгүй. QPay горимд хэрэглэгдэхгүй (callback нь гарын үсэггүй).
   */
  verifyWebhook(req: WebhookRequest): Promise<WebhookResult>
  /**
   * Нэхэмжлэх төлөгдсөн эсэхийг провайдерын API-аас асууна. Callback ба polling нь
   * зөвхөн үүнд итгэнэ. Провайдер хүрэхгүй бол шиднэ.
   */
  checkPayment(invoiceId: string): Promise<PaymentStatus>
  /**
   * Нэхэмжлэхийг провайдер дээр цуцална — үүний дараа түүгээр төлөх боломжгүй.
   * Аль хэдийн цуцлагдсан бол амжилттай. Цуцалж чадаагүй (төлөгдсөн, сүлжээ г.м.) бол шиднэ.
   */
  cancelInvoice(invoiceId: string): Promise<void>
  /** Апп хаагдахад хүлээгдэж буй ажлыг (таймер г.м.) цуцална */
  close(): void
}

/** Провайдер өөрөө webhook илгээх шаардлагатай үед (fake) апп руу хүргэх функц */
export type DeliverWebhook = (payload: unknown, headers: Record<string, string>) => Promise<void>
