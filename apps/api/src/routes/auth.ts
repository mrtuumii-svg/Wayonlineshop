import type { AuthResult, User } from '@way/contract'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getDummyHash, hashPassword, verifyPassword } from '../auth/password.js'
import { requireAuth } from '../auth/requireAuth.js'
import { signToken } from '../auth/token.js'
import { unauthorized, validation } from '../errors.js'
import { Prisma } from '../generated/prisma/client.js'

/** Brute force-оос сэргийлж ердийн квотоос (100/мин) хамаагүй хатуу */
const AUTH_RATE_LIMIT = { max: 10, timeWindow: '1 minute' }

// Frontend-ийн `features/auth/validation.ts`-тай ижил дүрэм
const email = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^\S+@\S+\.\S+$/, 'Имэйл буруу байна')
  .max(254, 'Имэйл хэт урт байна')
// Дээд хязгаар нь hash тооцоолохыг хэт урт оролтоор ачаалуулахаас хамгаална
const password = z.string().min(6, 'Нууц үг хамгийн багадаа 6 тэмдэгт байна').max(256, 'Нууц үг хэт урт байна')

const registerBody = z.object({
  name: z.string().trim().min(1, 'Нэрээ оруулна уу').max(100, 'Нэр хэт урт байна'),
  email,
  password,
})

const loginBody = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Имэйлээ оруулна уу'),
  password: z.string().min(1, 'Нууц үгээ оруулна уу').max(256),
})

const INVALID_CREDENTIALS = 'Имэйл эсвэл нууц үг буруу байна'
const EMAIL_TAKEN = 'Энэ имэйл бүртгэлтэй байна'

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body)
  if (!r.success) throw validation(r.error.issues[0]?.message ?? 'Хүсэлтийн өгөгдөл буруу байна')
  return r.data
}

const publicUser = { id: true, name: true, email: true } as const

export const authRoutes: FastifyPluginAsync = async (app) => {
  const session = async (user: User): Promise<AuthResult> => ({
    user,
    token: await signToken(user.id, app.config.JWT_SECRET),
  })

  app.post('/auth/register', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (req, reply) => {
    const input = parse(registerBody, req.body)

    const exists = await app.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })
    if (exists) throw validation(EMAIL_TAKEN)

    let user: User
    try {
      user = await app.prisma.user.create({
        data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password) },
        select: publicUser,
      })
    } catch (err) {
      // Зэрэг ирсэн хоёр бүртгэлийн уралдаан — unique index барина
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw validation(EMAIL_TAKEN)
      throw err
    }

    return reply.status(201).send(await session(user))
  })

  app.post('/auth/login', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (req) => {
    const input = parse(loginBody, req.body)

    const found = await app.prisma.user.findUnique({ where: { email: input.email } })
    // Хэрэглэгч байхгүй ч hash шалгана — хариуны хугацаа ижил байна
    const ok = await verifyPassword(found?.passwordHash ?? (await getDummyHash()), input.password)
    if (!found || !ok) throw unauthorized(INVALID_CREDENTIALS)

    return session({ id: found.id, name: found.name, email: found.email })
  })

  app.get('/auth/me', { preHandler: requireAuth }, async (req) => req.user)
}
