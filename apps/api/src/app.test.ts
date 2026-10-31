import { buildTestApp } from './test/testApp.js'

test('анхдагч провайдер нь fake', async () => {
  const app = await buildTestApp()
  expect(app.payments.name).toBe('fake')
  await app.close()
})

test('PAYMENT_PROVIDER=qpay үед QPay провайдер сонгогдоно', async () => {
  const app = await buildTestApp({ PAYMENT_PROVIDER: 'qpay' })
  expect(app.payments.name).toBe('qpay')
  await app.close()
})
