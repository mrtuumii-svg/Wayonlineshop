import type { User } from '@way/contract'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { unauthorized } from '../errors.js'
import { verifyToken } from './token.js'

declare module 'fastify' {
  interface FastifyRequest {
    /** `requireAuth`-ийн дараа л тавигдана */
    user: User | null
  }
}

const BEARER = /^Bearer (\S+)$/

/**
 * `Authorization: Bearer <token>`-ийг шалгаж `req.user`-ийг тавина.
 * Хэрэглэгч устгагдсан бол токен хүчинтэй байсан ч 401.
 */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = BEARER.exec(req.headers.authorization ?? '')?.[1]
  if (!token) throw unauthorized()

  const userId = await verifyToken(token, req.server.config.JWT_SECRET)
  if (!userId) throw unauthorized('Нэвтрэх хугацаа дууссан. Дахин нэвтэрнэ үү')

  const user = await req.server.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  })
  if (!user) throw unauthorized('Нэвтрэх хугацаа дууссан. Дахин нэвтэрнэ үү')

  req.user = user
}
