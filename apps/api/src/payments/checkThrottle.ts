/** Polling үед нэг захиалгыг провайдероос хэр олон удаа асууж болох */
export const PAYMENT_CHECK_INTERVAL_MS = 3000
const MAX_ENTRIES = 10_000

export interface CheckThrottle {
  /** `force` бол интервалаас үл хамааран зөвшөөрнө. Зөвшөөрсөн бүрд цагийг бүртгэнэ. */
  shouldCheck(orderId: string, now?: number, force?: boolean): boolean
  lastCheckedAt(orderId: string): number | undefined
}

/**
 * Frontend секунд тутам poll хийдэг — QPay-г хэт олон дуудахаас сэргийлнэ.
 * Санах ойд, апп тус бүрд нэг. Хэмжээ хязгаартай: хамгийн хуучин бичлэг эхэлж хасагдана.
 */
export function createCheckThrottle(intervalMs = PAYMENT_CHECK_INTERVAL_MS, maxEntries = MAX_ENTRIES): CheckThrottle {
  const lastChecked = new Map<string, number>()
  return {
    shouldCheck(orderId, now = Date.now(), force = false) {
      const last = lastChecked.get(orderId)
      if (!force && last !== undefined && now - last < intervalMs) return false
      // delete + set нь түлхүүрийг Map-ийн төгсгөлд шилжүүлнэ (оруулсан дарааллаар хуучин нь эхэнд)
      lastChecked.delete(orderId)
      lastChecked.set(orderId, now)
      if (lastChecked.size > maxEntries) lastChecked.delete(lastChecked.keys().next().value!)
      return true
    },
    lastCheckedAt: (orderId) => lastChecked.get(orderId),
  }
}
