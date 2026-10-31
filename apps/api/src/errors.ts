import type { ApiErrorCode } from '@way/contract'

/**
 * Бизнес логикийн алдаа. Кодыг HTTP status болгож хөрвүүлнэ, мессежийг
 * хэрэглэгчид шууд харуулна — тиймээс дотоод дэлгэрэнгүй бичихгүй.
 */
export class AppError extends Error {
  code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

export const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UNKNOWN: 500,
  UNAVAILABLE: 503,
}

/** Хариуны биеийн цорын ганц хэлбэр. Клиент үүнийг ApiError болгон хөрвүүлнэ. */
export interface ErrorBody {
  code: ApiErrorCode
  message: string
}

export const errorBody = (code: ApiErrorCode, message: string): ErrorBody => ({ code, message })

// Байнга хэрэглэгддэг алдаанууд — мессежийг нэг дор байлгаж давхардлыг арилгана
export const validation = (message: string) => new AppError('VALIDATION', message)
export const unauthorized = (message = 'Нэвтэрнэ үү') => new AppError('UNAUTHORIZED', message)
export const forbidden = (message = 'Танд хандах эрх байхгүй') => new AppError('FORBIDDEN', message)
export const notFound = (message = 'Олдсонгүй') => new AppError('NOT_FOUND', message)
export const conflict = (message: string) => new AppError('CONFLICT', message)
export const unavailable = (message: string) => new AppError('UNAVAILABLE', message)
