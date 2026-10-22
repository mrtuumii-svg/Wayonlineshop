import type { FastifyInstance } from 'fastify'
import { SignJWT } from 'jose'
import { createTestPrisma, resetDb } from '../test/db.js'
import { buildTestApp, testConfig } from '../test/testApp.js'

const prisma = createTestPrisma()
let app: FastifyInstance

const alice = { name: 'Алиса', email: 'alice@example.com', password: 'secret123' }

beforeEach(async () => {
  await resetDb(prisma)
  app = await buildTestApp()
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

afterAll(async () => {
  await prisma.$disconnect()
})

const register = (body: object) => app.inject({ method: 'POST', url: '/auth/register', payload: body })
const login = (body: object) => app.inject({ method: 'POST', url: '/auth/login', payload: body })
const me = (token?: string) =>
  app.inject({ method: 'GET', url: '/auth/me', headers: token ? { authorization: `Bearer ${token}` } : {} })

/** Хариуны аль ч хэсэгт нууц үг / hash гоожоогүйг шалгана */
function expectNoSecrets(raw: string) {
  expect(raw).not.toContain(alice.password)
  expect(raw).not.toMatch(/passwordHash|password|\$argon2/i)
}

describe('POST /auth/register', () => {
  it('хэрэглэгч үүсгэж токен буцаана', async () => {
    const res = await register(alice)

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.user).toEqual({ id: expect.any(String), name: 'Алиса', email: 'alice@example.com' })
    expect(typeof body.token).toBe('string')
    expectNoSecrets(res.body)
  })

  it('имэйлийг trim + жижиг үсэг болгож, нэрийг trim хийж хадгална', async () => {
    const res = await register({ ...alice, name: '  Алиса ', email: '  Alice@Example.COM ' })

    expect(res.statusCode).toBe(201)
    expect(res.json().user).toMatchObject({ name: 'Алиса', email: 'alice@example.com' })
  })

  it('нууц үгийг argon2id hash-аар хадгална, plaintext биш', async () => {
    await register(alice)

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: alice.email } })
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/)
    expect(stored.passwordHash).not.toContain(alice.password)
  })

  it('давхар имэйл (регистр өөр ч) → 400 VALIDATION', async () => {
    await register(alice)
    const res = await register({ ...alice, email: 'ALICE@example.com' })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ code: 'VALIDATION', message: 'Энэ имэйл бүртгэлтэй байна' })
  })

  it.each([
    ['богино нууц үг', { ...alice, password: '12345' }],
    ['буруу имэйл', { ...alice, email: 'not-an-email' }],
    ['хоосон нэр', { ...alice, name: '   ' }],
    ['талбар дутуу', { email: alice.email, password: alice.password }],
    ['хэт урт нууц үг', { ...alice, password: 'x'.repeat(257) }],
  ])('%s → 400 VALIDATION', async (_label, body) => {
    const res = await register(body)

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('VALIDATION')
    expect(await prisma.user.count()).toBe(0)
  })
})

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await register(alice)
  })

  it('зөв нууц үгээр токен буцаана (имэйлийн регистр хамаагүй)', async () => {
    const res = await login({ email: ' ALICE@example.com', password: alice.password })

    expect(res.statusCode).toBe(200)
    expect(res.json().user).toMatchObject({ email: 'alice@example.com', name: 'Алиса' })
    expect(typeof res.json().token).toBe('string')
    expectNoSecrets(res.body)
  })

  it('буруу нууц үг ба байхгүй имэйл → ижил 401 хариу (имэйл байгаа эсэхийг таниулахгүй)', async () => {
    const wrongPassword = await login({ email: alice.email, password: 'wrong-password' })
    const unknownEmail = await login({ email: 'nobody@example.com', password: alice.password })

    expect(wrongPassword.statusCode).toBe(401)
    expect(unknownEmail.statusCode).toBe(401)
    expect(wrongPassword.json()).toEqual({ code: 'UNAUTHORIZED', message: 'Имэйл эсвэл нууц үг буруу байна' })
    expect(unknownEmail.json()).toEqual(wrongPassword.json())
  })

  it('хоосон бие → 400 VALIDATION', async () => {
    const res = await login({})
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('VALIDATION')
  })
})

describe('GET /auth/me', () => {
  it('хүчинтэй токеноор хэрэглэгчийг буцаана', async () => {
    const { token, user } = (await register(alice)).json()
    const res = await me(token)

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(user)
    expectNoSecrets(res.body)
  })

  it('токенгүй → 401 UNAUTHORIZED', async () => {
    const res = await me()
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('UNAUTHORIZED')
  })

  it.each([
    ['хог утга', 'not-a-jwt'],
    ['өөр түлхүүрээр гарын үсэг зурсан', 'other-secret-that-is-long-enough-32!!'],
  ])('хүчингүй токен (%s) → 401', async (_label, variant) => {
    const { user } = (await register(alice)).json()
    const token =
      variant === 'not-a-jwt'
        ? variant
        : await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setExpirationTime('1h')
            .sign(new TextEncoder().encode(variant))

    const res = await me(token)
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('UNAUTHORIZED')
  })

  it('хугацаа дууссан токен → 401', async () => {
    const { user } = (await register(alice)).json()
    const past = Math.floor(Date.now() / 1000) - 60
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt(past - 3600)
      .setExpirationTime(past)
      .sign(new TextEncoder().encode(testConfig().JWT_SECRET))

    const res = await me(token)
    expect(res.statusCode).toBe(401)
  })

  it('"none" алгоритмтай (гарын үсэггүй) токен → 401', async () => {
    const { user } = (await register(alice)).json()
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const token = `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ sub: user.id, exp: 9999999999 })}.`

    const res = await me(token)
    expect(res.statusCode).toBe(401)
  })

  it('устгагдсан хэрэглэгчийн токен → 401', async () => {
    const { token, user } = (await register(alice)).json()
    await prisma.user.delete({ where: { id: user.id } })

    const res = await me(token)
    expect(res.statusCode).toBe(401)
  })
})

describe('rate limit', () => {
  it('/auth/login нь ердийн квотоос хатуу хязгаарлагдана', async () => {
    let limitedAt = 0
    for (let i = 1; i <= 30; i++) {
      const res = await login({ email: 'nobody@example.com', password: 'whatever1' })
      if (res.statusCode === 429) {
        limitedAt = i
        expect(res.json().code).toBe('RATE_LIMITED')
        break
      }
    }
    expect(limitedAt).toBeGreaterThan(0)
    expect(limitedAt).toBeLessThanOrEqual(11)
  })
})
