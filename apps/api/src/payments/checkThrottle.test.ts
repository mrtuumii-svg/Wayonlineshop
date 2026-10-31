import { createCheckThrottle } from './checkThrottle.js'

test('эхний шалгалтыг зөвшөөрнө, 3 секундын дотор давтахыг хориглоно', () => {
  const t = createCheckThrottle()
  expect(t.shouldCheck('o1', 1000)).toBe(true)
  expect(t.shouldCheck('o1', 1000 + 2999)).toBe(false)
  expect(t.shouldCheck('o1', 1000 + 3000)).toBe(true)
})

test('захиалга бүр бие даасан', () => {
  const t = createCheckThrottle()
  expect(t.shouldCheck('o1', 0)).toBe(true)
  expect(t.shouldCheck('o2', 0)).toBe(true)
})

test('хэмжээ хэтэрвэл хамгийн хуучныг хасна', () => {
  const t = createCheckThrottle(3000, 2)
  t.shouldCheck('o1', 0)
  t.shouldCheck('o2', 0)
  t.shouldCheck('o3', 0)
  expect(t.shouldCheck('o1', 1)).toBe(true)
  expect(t.shouldCheck('o3', 1)).toBe(false)
})
