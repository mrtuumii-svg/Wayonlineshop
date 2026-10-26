import { jwtVerify, SignJWT } from 'jose'

const ALG = 'HS256'
const TTL = '7d'

const key = (secret: string) => new TextEncoder().encode(secret)

export function signToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(key(secret))
}

/** Хүчинтэй бол userId, үгүй бол (гарын үсэг, хугацаа, алгоритм буруу) null. */
export async function verifyToken(token: string, secret: string): Promise<string | null> {
  try {
    // algorithms-ийг заавал зааж "none" болон өөр алгоритмаар хуурамчлахаас сэргийлнэ
    const { payload } = await jwtVerify(token, key(secret), { algorithms: [ALG] })
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null
  } catch {
    return null
  }
}
