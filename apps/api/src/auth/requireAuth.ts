import type { User } from '@way/contract'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { forbidden, unauthorized } from '../errors.js'
import { verifyToken } from './token.js'

declare module 'fastify' {
  interface FastifyRequest {
    /** `requireAuth`-ийн дараа л тавигдана */
    user: User | null
  }
}

const BEARER = /^Bearer (\S+)$/
const EXPIRED = 'Нэвтрэх хугацаа дууссан. Дахин нэвтэрнэ үү'

type TokenResult = { status: 'none' } | { status: 'invalid' } | { status: 'ok'; user: User }

async function readToken(req: FastifyRequest): Promise<TokenResult> {
  const token = BEARER.exec(req.headers.authorization ?? '')?.[1]
  if (!token) return { status: 'none' }

  const userId = await verifyToken(token, req.server.config.JWT_SECRET)
  if (!userId) return { status: 'invalid' }

  const user = await req.server.prisma.user.findUnique({
    where: { id: userId },
    // role-ийг токеноос биш DB-ээс уншина — эрхийг нь хассан бол хуучин токенд ч шууд үйлчилнэ
    select: { id: true, name: true, email: true, role: true },
  })
  // Хэрэглэгч устгагдсан бол токен хүчинтэй байсан ч хүчингүй
  return user ? { status: 'ok', user } : { status: 'invalid' }
}

/** `Authorization: Bearer <token>`-ийг шалгаж `req.user`-ийг тавина. Үгүй бол 401. */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const r = await readToken(req)
  if (r.status === 'none') throw unauthorized()
  if (r.status === 'invalid') throw unauthorized(EXPIRED)
  req.user = r.user
}

/**
 * Зөвхөн админ: нэвтрээгүй → 401, энгийн хэрэглэгч → 403.
 * Сайт админ биш хүнд цэсийг нуудаг ч жинхэнэ хамгаалалт нь энэ.
 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(req, reply)
  if (req.user?.role !== 'admin') throw forbidden('Зөвхөн админ хандах боломжтой')
}

/**
 * Нийтийн хуудсанд: токен хүчинтэй бол `req.user`-ийг тавина, үгүй бол нэвтрээгүй мэт үргэлжилнэ.
 * Хугацаа нь дууссан токентой хэрэглэгч каталогоо үзэх боломжгүй болох ёсгүй.
 */
export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const r = await readToken(req)
  req.user = r.status === 'ok' ? r.user : null
}
