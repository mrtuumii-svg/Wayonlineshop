import { z } from 'zod'

/** `.env.example`-ийн хоосон `NAME=` болон compose-ийн `${NAME:-}` нь "байхгүй"-тэй адил */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const optionalString = () => z.preprocess(blankToUndefined, z.string().trim().optional())

const QPAY_SANDBOX = {
  baseUrl: 'https://merchant-sandbox.qpay.mn',
  clientId: 'TEST_MERCHANT',
  clientSecret: '123456',
  invoiceCode: 'TEST_INVOICE',
} as const
const QPAY_PRODUCTION_URL = 'https://merchant.qpay.mn'

/**
 * Орчны хувьсагчдын схем. Сервер ЭХЛЭХЭЭС ӨМНӨ шалгагдана — буруу бол
 * хагас ажиллахын оронд шууд унана (fail fast).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .refine((v) => /^postgres(ql)?:\/\//.test(v), 'postgres:// эсвэл postgresql:// хаягаар эхлэх ёстой'),
  /** Токен хуурамчлахаас сэргийлэхийн тулд урт байх ёстой. */
  JWT_SECRET: z.string().min(32, 'дор хаяж 32 тэмдэгт байх ёстой'),
  /** Нэг юм уу хэдэн origin, таслалаар зааглана. */
  CORS_ORIGIN: z.string().min(1),
  /** `fake` (хөгжүүлэлт) эсвэл `qpay`. Endpoint-ийн код провайдераас хамаарахгүй. */
  PAYMENT_PROVIDER: z.enum(['fake', 'qpay']).default('fake'),
  /** QPay merchant мэдээлэл. Гурвуулаа байхгүй бол нийтийн sandbox (TEST_MERCHANT). */
  QPAY_BASE_URL: z.preprocess(blankToUndefined, z.url('URL байх ёстой').optional()),
  QPAY_CLIENT_ID: optionalString(),
  QPAY_CLIENT_SECRET: optionalString(),
  QPAY_INVOICE_CODE: optionalString(),
  /** Гаднаас хандах API-ийн хаяг — QPay төлбөрийн callback-ийг энд илгээнэ. */
  PUBLIC_API_URL: z.preprocess(
    blankToUndefined,
    z
      .url('URL байх ёстой')
      .transform((u) => u.replace(/\/+$/, ''))
      .optional(),
  ),
  /** Провайдерын webhook-ийн гарын үсгийг шалгах түлхүүр. */
  PAYMENT_WEBHOOK_SECRET: z.string().min(32, 'дор хаяж 32 тэмдэгт байх ёстой'),
  /** Fake провайдер нэхэмжлэх үүсгэснээс хойш хэдэн ms-ийн дараа өөрөө "төлөгдсөн" webhook илгээх. 0 = илгээхгүй. */
  FAKE_PAY_AFTER_MS: z.coerce.number().int().min(0).default(2000),
  /** AI туслахын key. Байхгүй бол сервер асна, харин `/chat` 503 буцаана. */
  // `.env.example`-ийн хоосон `LLM_API_KEY=` нь "байхгүй"-тэй адил
  LLM_API_KEY: optionalString(),
  /** OpenAI-тэй ижил хэлбэрийн API-ийн хаяг. Анхдагч нь Gemini. */
  LLM_BASE_URL: z.url('URL байх ёстой').default('https://generativelanguage.googleapis.com/v1beta/openai/'),
  LLM_MODEL: z.string().trim().min(1).default('gemini-3.5-flash-lite'),
  /** Sliding window: model-д илгээх өмнөх мессежийн тоо. Түүх бүхэлдээ санд үлдэнэ. 0 = түүхгүй. */
  CHAT_HISTORY_WINDOW: z.coerce.number().int().min(0).max(40).default(4),
})

export interface QpayConfig {
  baseUrl: string
  clientId: string
  clientSecret: string
  invoiceCode: string
  /** Нийтийн туршилтын merchant — QR-ийг банкны апп уншихгүй */
  sandbox: boolean
}

export interface Config {
  NODE_ENV: 'development' | 'test' | 'production'
  HOST: string
  PORT: number
  DATABASE_URL: string
  JWT_SECRET: string
  corsOrigins: string[]
  PAYMENT_PROVIDER: 'fake' | 'qpay'
  /** Үргэлж шийдэгдсэн (sandbox эсвэл бодит), `PAYMENT_PROVIDER=qpay` үед ашиглагдана */
  qpay: QpayConfig
  /** Төгсгөлийн '/'-гүй */
  PUBLIC_API_URL?: string
  PAYMENT_WEBHOOK_SECRET: string
  FAKE_PAY_AFTER_MS: number
  LLM_API_KEY?: string
  LLM_BASE_URL: string
  LLM_MODEL: string
  CHAT_HISTORY_WINDOW: number
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/**
 * Орчноос тохиргоо уншина. Алдааны мессежид хувьсагчийн НЭР ба шалтгаан
 * л орно — утга нь хэзээ ч орохгүй (нууц үг/токен лог руу гоожихоос сэргийлнэ).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
    throw new ConfigError(`Орчны хувьсагчид буруу байна:\n${issues}`)
  }

  const { CORS_ORIGIN, QPAY_BASE_URL, QPAY_CLIENT_ID, QPAY_CLIENT_SECRET, QPAY_INVOICE_CODE, ...rest } = parsed.data
  const corsOrigins = CORS_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (corsOrigins.length === 0) {
    throw new ConfigError('Орчны хувьсагчид буруу байна:\n  CORS_ORIGIN: дор хаяж нэг origin байх ёстой')
  }

  // Fake провайдер төлбөргүйгээр "төлөгдсөн" гэж хэлдэг — production-д ажиллавал хичээлүүд үнэгүй болно
  if (rest.NODE_ENV === 'production' && rest.PAYMENT_PROVIDER === 'fake') {
    throw new ConfigError(
      'Орчны хувьсагчид буруу байна:\n  PAYMENT_PROVIDER: production-д fake провайдер хориотой (бодит провайдер тохируулна уу)',
    )
  }

  const credentials = { QPAY_CLIENT_ID, QPAY_CLIENT_SECRET, QPAY_INVOICE_CODE }
  const missing = Object.entries(credentials)
    .filter(([, v]) => v === undefined)
    .map(([k]) => k)
  if (missing.length > 0 && missing.length < 3) {
    const issues = missing.map((k) => `  ${k}: QPay-ийн бусад мэдээлэлтэй хамт заавал байх ёстой`).join('\n')
    throw new ConfigError(`Орчны хувьсагчид буруу байна:\n${issues}`)
  }
  const qpay: QpayConfig =
    missing.length === 3
      ? { ...QPAY_SANDBOX, baseUrl: QPAY_BASE_URL ?? QPAY_SANDBOX.baseUrl, sandbox: true }
      : {
          baseUrl: QPAY_BASE_URL ?? QPAY_PRODUCTION_URL,
          clientId: QPAY_CLIENT_ID!,
          clientSecret: QPAY_CLIENT_SECRET!,
          invoiceCode: QPAY_INVOICE_CODE!,
          sandbox: false,
        }

  if (rest.NODE_ENV === 'production' && rest.PAYMENT_PROVIDER === 'qpay') {
    // Sandbox-ийн QR-ийг хэн ч төлж чадахгүй — production-д худалдан авалт бүхэлдээ зогсоно
    if (qpay.sandbox) {
      throw new ConfigError(
        'Орчны хувьсагчид буруу байна:\n  QPAY_CLIENT_ID: production-д QPay sandbox хориотой (бодит merchant мэдээлэл тавина уу)',
      )
    }
    if (!rest.PUBLIC_API_URL?.startsWith('https://')) {
      throw new ConfigError(
        'Орчны хувьсагчид буруу байна:\n  PUBLIC_API_URL: production-д QPay callback-д https:// хаяг заавал байх ёстой',
      )
    }
  }

  return { ...rest, corsOrigins, qpay }
}
