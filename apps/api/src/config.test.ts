import { ConfigError, loadConfig } from './config.js'

const valid = {
  DATABASE_URL: 'postgresql://way:way@localhost:5432/way_dev',
  JWT_SECRET: 'a'.repeat(32),
  CORS_ORIGIN: 'http://localhost:5173',
  PAYMENT_WEBHOOK_SECRET: 'w'.repeat(32),
}

test('loads a valid env and applies defaults', () => {
  const c = loadConfig(valid)
  expect(c).toMatchObject({ NODE_ENV: 'development', HOST: '0.0.0.0', PORT: 3000 })
  expect(c.corsOrigins).toEqual(['http://localhost:5173'])
})

test('PORT is coerced from string and validated', () => {
  expect(loadConfig({ ...valid, PORT: '8080' }).PORT).toBe(8080)
  expect(() => loadConfig({ ...valid, PORT: 'abc' })).toThrow(ConfigError)
  expect(() => loadConfig({ ...valid, PORT: '0' })).toThrow(ConfigError)
  expect(() => loadConfig({ ...valid, PORT: '70000' })).toThrow(ConfigError)
})

test('CORS_ORIGIN accepts a comma separated list and trims it', () => {
  const c = loadConfig({ ...valid, CORS_ORIGIN: 'http://a.mn , https://b.mn ,' })
  expect(c.corsOrigins).toEqual(['http://a.mn', 'https://b.mn'])
})

test('a CORS_ORIGIN of only separators is rejected', () => {
  expect(() => loadConfig({ ...valid, CORS_ORIGIN: ' , , ' })).toThrow(/CORS_ORIGIN/)
})

test('missing variables are all reported by name', () => {
  try {
    loadConfig({})
    throw new Error('унах ёстой байсан')
  } catch (err) {
    expect(err).toBeInstanceOf(ConfigError)
    const msg = (err as ConfigError).message
    expect(msg).toContain('DATABASE_URL')
    expect(msg).toContain('JWT_SECRET')
    expect(msg).toContain('CORS_ORIGIN')
  }
})

test('a short JWT_SECRET is rejected', () => {
  expect(() => loadConfig({ ...valid, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/)
})

test('a non-postgres DATABASE_URL is rejected', () => {
  expect(() => loadConfig({ ...valid, DATABASE_URL: 'mysql://localhost/x' })).toThrow(/DATABASE_URL/)
  expect(loadConfig({ ...valid, DATABASE_URL: 'postgres://localhost/x' }).DATABASE_URL).toBeTruthy()
})

test('the error message never leaks the secret values', () => {
  const secret = 'super-secret-password-value'
  try {
    loadConfig({ ...valid, JWT_SECRET: secret, PORT: 'nope' })
    throw new Error('унах ёстой байсан')
  } catch (err) {
    expect((err as Error).message).not.toContain(secret)
  }
})

test('NODE_ENV only accepts the known environments', () => {
  expect(loadConfig({ ...valid, NODE_ENV: 'test' }).NODE_ENV).toBe('test')
  // production-ийг схем хүлээн авна (унавал fake провайдерын улмаас, NODE_ENV-ийн биш)
  expect(() => loadConfig({ ...valid, NODE_ENV: 'production' })).not.toThrow(/NODE_ENV/)
  expect(() => loadConfig({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/)
})

test('payment: fake provider by default, auto-pays after 2s', () => {
  expect(loadConfig(valid)).toMatchObject({ PAYMENT_PROVIDER: 'fake', FAKE_PAY_AFTER_MS: 2000 })
  expect(loadConfig({ ...valid, FAKE_PAY_AFTER_MS: '0' }).FAKE_PAY_AFTER_MS).toBe(0)
  expect(() => loadConfig({ ...valid, FAKE_PAY_AFTER_MS: '-1' })).toThrow(/FAKE_PAY_AFTER_MS/)
})

test('a missing or short PAYMENT_WEBHOOK_SECRET is rejected', () => {
  const { PAYMENT_WEBHOOK_SECRET: _omit, ...rest } = valid
  expect(() => loadConfig(rest)).toThrow(/PAYMENT_WEBHOOK_SECRET/)
  expect(() => loadConfig({ ...valid, PAYMENT_WEBHOOK_SECRET: 'short' })).toThrow(/PAYMENT_WEBHOOK_SECRET/)
})

test('an unknown PAYMENT_PROVIDER is rejected', () => {
  expect(() => loadConfig({ ...valid, PAYMENT_PROVIDER: 'paypal' })).toThrow(/PAYMENT_PROVIDER/)
})

test('the fake provider is refused in production — it would hand out courses for free', () => {
  expect(() => loadConfig({ ...valid, NODE_ENV: 'production' })).toThrow(/PAYMENT_PROVIDER/)
})

test('LLM: key заавал биш, хоосон утга нь байхгүйтэй адил, анхдагч нь Gemini', () => {
  const c = loadConfig({ ...valid, LLM_API_KEY: '  ' })
  expect(c.LLM_API_KEY).toBeUndefined()
  expect(c.LLM_BASE_URL).toContain('generativelanguage.googleapis.com')
  expect(c.LLM_MODEL).toBe('gemini-3.5-flash-lite')
  expect(loadConfig({ ...valid, LLM_API_KEY: 'k' }).LLM_API_KEY).toBe('k')
  expect(() => loadConfig({ ...valid, LLM_BASE_URL: 'not a url' })).toThrow(/LLM_BASE_URL/)
})
