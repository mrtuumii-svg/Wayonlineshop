import { z } from 'zod'

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
  /** Одоогоор зөвхөн `fake`. QPay нэмэгдэхэд `qpay` гэж сонгоно — endpoint-ийн код өөрчлөгдөхгүй. */
  PAYMENT_PROVIDER: z.enum(['fake']).default('fake'),
  /** Провайдерын webhook-ийн гарын үсгийг шалгах түлхүүр. */
  PAYMENT_WEBHOOK_SECRET: z.string().min(32, 'дор хаяж 32 тэмдэгт байх ёстой'),
  /** Fake провайдер нэхэмжлэх үүсгэснээс хойш хэдэн ms-ийн дараа өөрөө "төлөгдсөн" webhook илгээх. 0 = илгээхгүй. */
  FAKE_PAY_AFTER_MS: z.coerce.number().int().min(0).default(2000),
  /** AI туслахын key. Байхгүй бол сервер асна, харин `/chat` 503 буцаана. */
  // `.env.example`-ийн хоосон `LLM_API_KEY=` нь "байхгүй"-тэй адил
  LLM_API_KEY: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().optional()),
  /** OpenAI-тэй ижил хэлбэрийн API-ийн хаяг. Анхдагч нь Gemini. */
  LLM_BASE_URL: z.url('URL байх ёстой').default('https://generativelanguage.googleapis.com/v1beta/openai/'),
  LLM_MODEL: z.string().trim().min(1).default('gemini-3.5-flash-lite'),
})

export interface Config {
  NODE_ENV: 'development' | 'test' | 'production'
  HOST: string
  PORT: number
  DATABASE_URL: string
  JWT_SECRET: string
  corsOrigins: string[]
  PAYMENT_PROVIDER: 'fake'
  PAYMENT_WEBHOOK_SECRET: string
  FAKE_PAY_AFTER_MS: number
  LLM_API_KEY?: string
  LLM_BASE_URL: string
  LLM_MODEL: string
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

  const { CORS_ORIGIN, ...rest } = parsed.data
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

  return { ...rest, corsOrigins }
}
