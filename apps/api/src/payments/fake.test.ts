import { createFakeProvider } from './fake.js'

test('fake-ийн checkPayment үргэлж pending — мөнгө зөвхөн гарын үсэгтэй webhook-оор орно', async () => {
  const p = createFakeProvider({ secret: 's'.repeat(32), payAfterMs: 0, deliver: async () => {} })
  const { invoiceId } = await p.createInvoice({ orderId: 'o1', amount: 1 })

  expect(await p.checkPayment(invoiceId)).toBe('pending')
})
