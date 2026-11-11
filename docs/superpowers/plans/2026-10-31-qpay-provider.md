# Бодит QPay провайдер Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/api`-д `PAYMENT_PROVIDER=qpay` үед ажиллах QPay v2 провайдер нэмэх. Callback-д итгэхгүй, төлбөрийг QPay API-аас шалгана.

**Architecture:** `PaymentProvider`-д `checkPayment` нэмнэ. Захиалгыг `paid` болгох логикийг `settleOrder`-д нэгтгэнэ. Энэ функцийг fake webhook, шинэ QPay callback, `GET /orders/:id`-ийн polling гурвуулаа дуудна. QPay-ийн HTTP логик `apps/web/server/qpay.ts`-аас зөөгдөнө.

**Tech Stack:** Fastify 5, Prisma, Zod, Vitest (тестийн Postgres: `docker compose up -d`, порт 5433), Node `fetch`.

**Spec:** `docs/superpowers/specs/2026-10-31-qpay-provider-design.md`

## Global Constraints

- Тестүүд QPay руу бодитоор хандахгүй. `fetch`-ийг inject хийнэ, route тестүүд stub провайдер ашиглана.
- QPay-ийн дуудлага бүр 10 секундын timeout-тэй (`AbortSignal.timeout(10_000)`).
- Алдааны мессеж болон логт secret, token, env-ийн утга хэзээ ч орохгүй. Config-ийн алдаанд зөвхөн хувьсагчийн нэр орно.
- QPay-ийн алдааг хэрэглэгчид `unavailable('QPay-тэй холбогдож чадсангүй. Дахин оролдоно уу.')` (503) гэж харуулна.
- Sandbox: `https://merchant-sandbox.qpay.mn`, `TEST_MERCHANT` / `123456` / `TEST_INVOICE`. Бодит: `https://merchant.qpay.mn`.
- Polling-ийн throttle: нэг захиалгыг 3000 ms-д нэгээс олон удаа шалгахгүй. Нэхэмжлэхийн хугацаа `INVOICE_TTL_MS` (10 минут) хэвээр.
- Fake урсгалын `orders.test.ts`-ийн бүх хуучин тест өөрчлөлтгүй ногоон байх ёстой.
- Frontend (`apps/web`) хөндөгдөхгүй.
- Хамрах хүрээ: `npm run test:coverage -w @way/api` нь 80%+.
- Commit message-үүд монголоор, `Co-Authored-By` мөртэй.

## Review Focus

1. **Хоосон env мөр.** `QPAY_CLIENT_ID=` (`.env.example`) эсвэл compose-ийн `${QPAY_CLIENT_ID:-}` нь "байхгүй"-тэй адил байх ёстой. Тэгэхгүй бол "credential дутуу" гэж буруу унана. → Task 1-д тест.
2. **`PUBLIC_API_URL`-ийн төгсгөлийн `/`.** `https://api.mn/` нь callback-д `//payments` үүсгэх ёсгүй. → Task 2-т тест.
3. **QPay-ийн `expires_in`** unix секунд эсвэл үргэлжлэх секунд байж болно. Аль нь ч ирсэн token-ийг зөв cache-лэх ёстой. → Task 2-т тест.
4. **Хуучин fake захиалгын callback.** Provider солигдсоны дараа `provider: 'fake'` захиалгад callback/poll ирвэл QPay дуудагдахгүй. → Task 3-т тест.
5. **Callback ба poll зэрэг ирэх.** `settleOrder`-ийг зэрэг 2 удаа дуудахад enrollment нэг л удаа үүснэ. → Task 3-т тест.

---

### Task 1: Config — `qpay` провайдер ба QPay-ийн тохиргоо

**Files:**
- Modify: `apps/api/src/config.ts`
- Modify: `apps/api/src/test/testApp.ts` (`testConfig`)
- Test: `apps/api/src/config.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface QpayConfig { baseUrl: string; clientId: string; clientSecret: string; invoiceCode: string; sandbox: boolean }
  // Config-д нэмэгдэнэ:
  PAYMENT_PROVIDER: 'fake' | 'qpay'
  qpay: QpayConfig          // үргэлж шийдэгдсэн (sandbox эсвэл бодит)
  PUBLIC_API_URL?: string   // төгсгөлийн '/'-гүй
  ```
  `testConfig()`-д `qpay`-г sandbox утгаар тавина (`sandbox: true`).

- [ ] **Step 1: Failing тестүүдийг бичих** (`config.test.ts`, одоогийн `valid` объект ашиглана):
  - `PAYMENT_PROVIDER defaults to fake and accepts qpay`: анхдагч нь `'fake'`; `qpay` → `'qpay'`; `'stripe'` → `ConfigError` (`/PAYMENT_PROVIDER/`).
  - `qpay without credentials resolves to the sandbox`: `toEqual({ baseUrl: 'https://merchant-sandbox.qpay.mn', clientId: 'TEST_MERCHANT', clientSecret: '123456', invoiceCode: 'TEST_INVOICE', sandbox: true })`.
  - `empty QPAY_* strings count as absent` (Review Focus 1): `QPAY_CLIENT_ID: '', QPAY_CLIENT_SECRET: '', QPAY_INVOICE_CODE: ''` → sandbox, алдаагүй.
  - `real credentials default to the production base url`: гурвуулаа өгвөл `baseUrl: 'https://merchant.qpay.mn', sandbox: false`. `QPAY_BASE_URL` өгвөл тэр нь ашиглагдана.
  - `partial QPay credentials are rejected by name`: зөвхөн `QPAY_CLIENT_ID` өгвөл мессежид `QPAY_CLIENT_SECRET` ба `QPAY_INVOICE_CODE` орно, утга нь (`'my-id'`) орохгүй.
  - `PUBLIC_API_URL is validated and its trailing slash removed`: `'https://api.way.mn/'` → `'https://api.way.mn'`; `'not a url'` → `ConfigError`; `''` → `undefined`.
  - `production rejects qpay sandbox`: `NODE_ENV: 'production', PAYMENT_PROVIDER: 'qpay'`, credential-гүй → `/sandbox/`.
  - `production qpay requires an https PUBLIC_API_URL`: бодит credential-тай. `PUBLIC_API_URL` байхгүй эсвэл `http://` бол → `/PUBLIC_API_URL/`; `https://` бол OK.
  - Fake-ийг production-д хориглодог хуучин тест хэвээр ногоон байх ёстой.

- [ ] **Step 2: Тест унаж байгааг шалгах**
  Run: `npm test -w @way/api -- src/config.test.ts`
  Expected: FAIL (`qpay` enum-д байхгүй, `c.qpay` undefined).

- [ ] **Step 3: `config.ts`-ийг хэрэгжүүлэх**
  - Хоосон мөрийг undefined болгодог `LLM_API_KEY`-ийн `preprocess`-ийг `optionalString` туслах болгож гаргана. Үүнийг `QPAY_*`, `PUBLIC_API_URL`-д ашиглана.
  - `PUBLIC_API_URL`: `z.url()`, дараа нь `replace(/\/+$/, '')`.
  - `loadConfig` дотор `qpay`-г шийднэ. Дутуу credential-ийн алдаа, production-ий дүрмүүдийг одоогийн `ConfigError('Орчны хувьсагчид буруу байна:\n  NAME: шалтгаан')` хэлбэрээр бичнэ.
  - `testConfig`-д `qpay` нэмнэ.

- [ ] **Step 4: Тест ногоон болж, typecheck давж байгааг шалгах**
  Run: `npm test -w @way/api -- src/config.test.ts && npm run typecheck -w @way/api`
  Expected: PASS, typecheck алдаагүй.

- [ ] **Step 5: Commit** — `feat(api): PAYMENT_PROVIDER=qpay ба QPay-ийн тохиргоо (sandbox анхдагч)`

---

### Task 2: `checkPayment` интерфейс + QPay провайдер

**Files:**
- Modify: `apps/api/src/payments/provider.ts`, `apps/api/src/payments/fake.ts`
- Create: `apps/api/src/payments/qpay.ts`
- Test: `apps/api/src/payments/qpay.test.ts`, `apps/api/src/payments/fake.test.ts` (байхгүй бол үүсгэнэ, `checkPayment`-ийн нэг тест)

**Interfaces:**
- Consumes: `QpayConfig` (Task 1).
- Produces:
  ```ts
  // provider.ts
  export type PaymentStatus = 'paid' | 'pending'
  interface PaymentProvider { ...; checkPayment(invoiceId: string): Promise<PaymentStatus> }
  // qpay.ts
  export const QPAY_CALLBACK_PATH = '/payments/qpay/callback'
  export class QpayError extends Error {}   // name = 'QpayError'
  export interface QpayProviderOptions extends Omit<QpayConfig, 'sandbox'> {
    callbackBaseUrl: string                 // төгсгөлийн '/'-гүй
    fetch?: typeof fetch                    // анхдагч globalThis.fetch
    timeoutMs?: number                      // анхдагч 10_000
  }
  export function createQpayProvider(opts: QpayProviderOptions): PaymentProvider   // name: 'qpay'
  ```

- [ ] **Step 1: Failing тестүүдийг бичих** (`qpay.test.ts`). Fetch stub нь `(url, init)` дуудлагуудыг бүртгэж, URL-аар хариу буцаана.
  - `createInvoice нь QPay-ийн invoice-ийг үүсгэж QR буцаана`: auth нь `POST {baseUrl}/v2/auth/token`, header нь `Authorization: Basic base64('TEST_MERCHANT:123456')`. Invoice-ийн бие `toEqual({ invoice_code: 'TEST_INVOICE', sender_invoice_no: 'ord_1', invoice_receiver_code: 'terminal', invoice_description: 'Way Academy', amount: 49000, callback_url: 'https://api.way.mn/payments/qpay/callback?order=ord_1' })`, header нь `Authorization: Bearer tok`. Үр дүн `{ invoiceId: 'inv_1', qr: { text: 'qrtext', image: 'data:image/png;base64,AAAA' } }`.
  - `callbackBaseUrl-ийн төгсгөлийн "/"-г давхардуулахгүй` (Review Focus 2): `'https://api.way.mn/'` өгвөл `callback_url` нь `'https://api.way.mn/payments/qpay/callback?order=ord_1'`.
  - `orderId-г URL-д encode хийнэ`: `'a&b'` → `?order=a%26b`.
  - `token-ийг cache-лэнэ`: 2 `createInvoice` дуудалт → auth 1 удаа.
  - `expires_in-ийн хоёр хэлбэрийг дэмжинэ` (Review Focus 3): `expires_in: 3600` (үргэлжлэх) болон `expires_in: Math.floor(Date.now()/1000) + 3600` (unix) хоёулаа 2 дуудалтад auth 1 удаа. `expires_in: 30` бол (1 минутын зайнаас бага) 2 дахь дуудалт auth-ийг дахин дуудна.
  - `401 ирвэл token шинэчлээд нэг удаа дахин оролдоно`: invoice эхлээд 401, дараа 200 → auth 2 удаа, амжилттай. Хоёр дахь удаа ч 401 бол `QpayError`.
  - `checkPayment: PAID мөр байвал paid`: `/v2/payment/check`-ийн бие `toEqual({ object_type: 'INVOICE', object_id: 'inv_1', offset: { page_number: 1, page_limit: 100 } })`. `rows: [{ payment_status: 'PAID' }]` → `'paid'`; `rows: []` эсвэл `[{ payment_status: 'NEW' }]` → `'pending'`.
  - `OK биш хариу нь QpayError, мессежид secret байхгүй`: invoice 500 → `rejects.toBeInstanceOf(QpayError)`, мессежид `'/v2/invoice'` ба `'500'` орно, `'123456'` болон token орохгүй.
  - `timeout нь QpayError`: `timeoutMs: 20`, fetch нь `init.signal`-ийн abort хүртэл хүлээнэ → `QpayError`.
  - `verifyWebhook нь үргэлж VALIDATION шиднэ`: `rejects.toMatchObject({ code: 'VALIDATION' })`.
  - (`fake.test.ts`) `fake-ийн checkPayment үргэлж pending`.

- [ ] **Step 2: Тест унаж байгааг шалгах**
  Run: `npm test -w @way/api -- src/payments`
  Expected: FAIL (`./qpay.js` олдохгүй).

- [ ] **Step 3: Хэрэгжүүлэх**
  - `provider.ts`: `PaymentStatus`, `checkPayment`. `verifyWebhook`-ийн JSDoc-д "QPay горимд хэрэглэгдэхгүй" гэж нэмнэ.
  - `fake.ts`: `async checkPayment() { return 'pending' }`. Fake-д мөнгө зөвхөн гарын үсэгтэй webhook-оор орно.
  - `qpay.ts`: `apps/web/server/qpay.ts`-ийн `getToken`/`call`-ийг үндэс болгоно.
    - `expires_in > 1e9` бол unix секунд гэж үзнэ.
    - Fetch бүрд `signal: AbortSignal.timeout(timeoutMs)`.
    - Fetch-ийн exception болон OK биш хариуг `QpayError(\`QPay ${path} ${status|'сүлжээ'}\`)` болгоно. Хариуны биеийг мессежид оруулахгүй.
    - `close()` хоосон.

- [ ] **Step 4: Тест ногоон болж байгааг шалгах**
  Run: `npm test -w @way/api -- src/payments && npm run typecheck -w @way/api`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(api): QPay v2 провайдер (invoice, payment check, token cache)`

---

### Task 3: `settleOrder` + QPay callback route + провайдерыг холбох

**Files:**
- Create: `apps/api/src/payments/settle.ts`
- Create: `apps/api/src/test/stubProvider.ts`
- Modify: `apps/api/src/app.ts` (провайдер сонгох, `deps.payments`)
- Modify: `apps/api/src/routes/orders.ts` (webhook нь `settleOrder` ашиглана, callback route нэмнэ)
- Test: `apps/api/src/routes/orders.test.ts` (шинэ `describe('QPay callback')`), `apps/api/src/app.test.ts` (байхгүй бол үүсгэнэ)

**Interfaces:**
- Consumes: `createQpayProvider`, `QPAY_CALLBACK_PATH`, `PaymentStatus` (Task 2); `config.qpay`, `config.PUBLIC_API_URL` (Task 1).
- Produces:
  ```ts
  // settle.ts — транзакцаар order → paid + enrollment.createMany({ skipDuplicates: true })
  export function settleOrder(prisma: PrismaClient, order: { id: string; userId: string; items: { courseId: string }[] }): Promise<void>
  // stubProvider.ts
  export interface StubProvider extends PaymentProvider {
    status: PaymentStatus            // checkPayment-ийн буцаах утга, анхдагч 'pending'
    checkError: Error | null         // тавибал checkPayment шиднэ
    invoiceError: Error | null       // тавибал createInvoice шиднэ
    checks: string[]                 // checkPayment-д ирсэн invoiceId-ууд
  }
  export function createStubProvider(name?: string): StubProvider   // анхдагч name 'qpay'
  // app.ts
  buildApp(config, deps: { prisma?; llm?; payments?: PaymentProvider })
  ```
  `buildApp`: `deps.payments` өгвөл түүнийг ашиглана. Үгүй бол `PAYMENT_PROVIDER === 'qpay'` үед `createQpayProvider({ ...config.qpay, callbackBaseUrl: config.PUBLIC_API_URL ?? 'https://example.com' })`, бусад үед одоогийн fake.

- [ ] **Step 1: Failing тестүүдийг бичих.** Шинэ `describe` нь `buildTestApp({ PAYMENT_PROVIDER: 'qpay' }, { payments: stub })` ашиглана. `callback = (q: string, method = 'GET') => app.inject({ method, url: '/payments/qpay/callback' + q })`.
  - `QPay төлсөн гэвэл захиалга paid болж эрх үүснэ`: `stub.status = 'paid'`; `callback('?order=' + orderId)` → 200 `{ ok: true }`. `stub.checks` нь `[invoiceIdOf(orderId)]`, захиалга `paid`, enrollment 1.
  - `POST callback ч ажиллана`: дээрхтэй адил, `method: 'POST'`, бие нь `{ payment_id: 'x' }`.
  - `QPay pending гэвэл юу ч өөрчлөгдөхгүй`: 200, захиалга `pending`, enrollment 0.
  - `callback-ийн биед итгэхгүй`: `stub.status = 'pending'`, бие нь `{ payment_status: 'PAID', invoice_id: ... }` → захиалга `pending`.
  - `order байхгүй, буруу эсвэл танихгүй → 404`: `''`, `'?order='`, `'?order=' + 'x'.repeat(65)`, `'?order=nope'` → 404. `stub.checks` хоосон.
  - `аль хэдийн paid захиалгад QPay дуудагдахгүй`: 2 дахь callback-ийн дараа `stub.checks.length === 1`.
  - `өөр провайдерын (fake) захиалгад QPay дуудагдахгүй` (Review Focus 4): захиалгыг DB дээр `provider: 'fake'` болгоод callback → 200, `stub.checks` хоосон, `pending`.
  - `QPay алдаа өгвөл 503, захиалга хөдлөхгүй`: `stub.checkError = new Error('down')` → 503 `{ code: 'UNAVAILABLE' }`, `pending`.
  - `давхар callback эрхийг давхардуулахгүй`: 2 callback → enrollment 1.
  - `settleOrder-ийг зэрэг дуудахад эрх нэг л байна` (Review Focus 5): `Promise.all` дотор 2 callback → enrollment 1, хоёулаа 200.
  - (`app.test.ts`, DB шаардахгүй) `PAYMENT_PROVIDER=qpay үед app.payments.name === 'qpay'`, анхдагч нь `'fake'`.

- [ ] **Step 2: Тест унаж байгааг шалгах**
  Run: `npm test -w @way/api -- src/routes/orders.test.ts src/app.test.ts`
  Expected: шинэ тестүүд FAIL (callback route 404, `payments` dep-ийг үл тоодог). Хуучин тестүүд PASS.

- [ ] **Step 3: Хэрэгжүүлэх**
  - `settle.ts`: webhook доторх `$transaction`-ийг яг хэвээр нь зөөнө. `/payments/webhook` нь `settleOrder` дуудна.
  - Callback route: `app.route({ method: ['GET', 'POST'], url: QPAY_CALLBACK_PATH, ... })`. `order`-ийг `z.string().min(1).max(64)`-оор шалгана (буруу бол `notFound('Нэхэмжлэх олдсонгүй')`).
  - `checkPayment`-ийн алдааг `req.log.error({ err }, ...)`-оор логлоод `unavailable(...)` шиднэ.

- [ ] **Step 4: Бүх api тест ногоон болж байгааг шалгах**
  Run: `npm test -w @way/api && npm run typecheck -w @way/api`
  Expected: PASS. Fake-ийн хуучин webhook тестүүд ногоон.

- [ ] **Step 5: Commit** — `feat(api): QPay callback (дохио, төлбөрийг API-аас шалгана) ба settleOrder`

---

### Task 4: `GET /orders/:id` polling + `POST /orders`-ийн QPay алдаа

**Files:**
- Create: `apps/api/src/payments/checkThrottle.ts`
- Modify: `apps/api/src/routes/orders.ts`
- Test: `apps/api/src/payments/checkThrottle.test.ts`, `apps/api/src/routes/orders.test.ts` (`describe('GET /orders/:id — провайдероос шалгах')`, `POST /orders`)

**Interfaces:**
- Consumes: `settleOrder`, `createStubProvider` (Task 3).
- Produces:
  ```ts
  export const PAYMENT_CHECK_INTERVAL_MS = 3000
  export interface CheckThrottle { shouldCheck(orderId: string, now?: number): boolean }
  export function createCheckThrottle(intervalMs?: number, maxEntries?: number): CheckThrottle  // анхдагч 3000, 10_000
  ```
  Throttle-ийг `orderRoutes`-ийн closure дотор нэг удаа үүсгэнэ (апп тус бүрд).

- [ ] **Step 1: Failing тестүүдийг бичих**
  - `checkThrottle.test.ts`:
    - эхний удаа `true`;
    - `now + 2999` → `false`, `now + 3000` → `true`;
    - өөр захиалга бие даасан;
    - `maxEntries: 2` үед 3 дахь захиалга нэмэгдэхэд хамгийн хуучин нь хасагдана (дахин `true` буцаана).
  - `orders.test.ts` (qpay stub):
    - `QPay төлсөн бол poll paid буцааж эрх үүсгэнэ`: `stub.status = 'paid'` → `getOrder` нь `status: 'paid'`, enrollment 1.
    - `3 секундын дотор дахин poll хийхэд QPay дуудагдахгүй`: 2 `getOrder` → `stub.checks.length === 1`.
    - `poll үед QPay алдаа → pending, 200`: `stub.checkError` тавина.
    - `хугацаа дуусахад сүүлийн шалгалт хийнэ`: `createdAt`-ийг 11 минутын өмнө болгоно (одоогийн тестийн арга). Эхний poll-оор throttle-ийг "ашигласны" дараа ч шалгалт хийгдэх ёстой. `'paid'` бол `paid`, `'pending'` бол `failed`.
    - `хугацаа дууссан ба QPay алдаа → failed болохгүй`: `pending` буцаана, DB-д `pending`.
    - `өөр провайдерын захиалгыг poll хийхэд QPay дуудагдахгүй`.
  - `POST /orders` (qpay stub):
    - `createInvoice алдаа → 503, захиалга failed`: `stub.invoiceError = new Error('down')` → 503 `{ code: 'UNAVAILABLE', message: 'QPay-тэй холбогдож чадсангүй. Дахин оролдоно уу.' }`, хэрэглэгчийн сүүлийн захиалга `failed`.

- [ ] **Step 2: Тест унаж байгааг шалгах**
  Run: `npm test -w @way/api -- src/payments/checkThrottle.test.ts src/routes/orders.test.ts`
  Expected: шинэ тестүүд FAIL.

- [ ] **Step 3: Хэрэгжүүлэх**
  - `checkThrottle.ts`: `Map` ашиглана. Эхлээд `delete`, дараа нь `set` хийж оруулах дарааллыг шинэчилнэ. Хэмжээ хэтэрвэл эхний түлхүүрийг хасна.
  - `GET /orders/:id`-ийн шинэ урсгал:
    ```
    pending бөгөөд order.provider === payments.name бол:
      expired = expiresAt(createdAt) <= now
      if (expired || throttle.shouldCheck(id)):
        try   { if (await payments.checkPayment(invoiceId) === 'paid') { settleOrder; status = 'paid' } }
        catch { log; checkFailed = true }
      if (status === 'pending' && expired && !checkFailed) → одоогийн updateMany(... 'failed') логик
    ```
    Fake нь `'pending'` буцаадаг тул fake-ийн хугацаа дуусалтын хуучин тест өөрчлөгдөхгүй.
  - `POST /orders`: `createInvoice`-ийн catch дотор `failed` болгосны дараа `AppError` биш алдааг логлоод `unavailable(...)` шиднэ.

- [ ] **Step 4: Бүх api тест ногоон болж байгааг шалгах**
  Run: `npm test -w @way/api && npm run typecheck -w @way/api`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(api): захиалгын polling-д провайдероос шалгах (throttle, хугацаа дуусахын өмнөх шалгалт)`

---

### Task 5: Docs, compose, эцсийн шалгалт

**Files:**
- Modify: `README.md` (API-ийн env хүснэгт, QPay-ийн тэмдэглэл)
- Modify: `apps/api/.env.example`, `.env.example`, `docker-compose.yml` (`api` service)

- [ ] **Step 1: Env болон docs-ийг шинэчлэх**
  - README-ийн хүснэгт:
    - `PAYMENT_PROVIDER` нь `fake` \| `qpay`;
    - `QPAY_BASE_URL`, `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE` (хоосон бол sandbox);
    - `PUBLIC_API_URL` (production qpay-д заавал https).
  - README-ийн "Төлбөр одоогоор зөвхөн `fake`" гэсэн тэмдэглэлийг шинэчилнэ: qpay байгаа; production-д бодит credential + https `PUBLIC_API_URL` хэрэгтэй; sandbox-ийн QR-ийг банкны апп уншихгүй.
  - `.env.example` файлуудад хоосон `QPAY_*=` болон `PUBLIC_API_URL=`-ийг тайлбартай нэмнэ.
  - Compose: `PAYMENT_PROVIDER: ${PAYMENT_PROVIDER:-fake}`, `QPAY_CLIENT_ID: ${QPAY_CLIENT_ID:-}` гэх мэт, `PUBLIC_API_URL: ${PUBLIC_API_URL:-}`. `NODE_ENV: development` хэвээр, тайлбарыг шинэчилнэ.

- [ ] **Step 2: Compose-ийн тохиргоо зөв эсэхийг шалгах**
  Run: `docker compose --profile app config --quiet`
  Expected: алдаагүй.

- [ ] **Step 3: Бүрэн шалгалт**
  Run: `npm run test:coverage -w @way/api && npm run typecheck -w @way/api && npm run build -w @way/api && npm test -w @way/web`
  Expected: бүгд PASS, api-ийн хамрах хүрээ 80%+.

- [ ] **Step 4: Sandbox-ийг гараар шалгах** (сүлжээ шаардана, заавал биш):
  1. `PAYMENT_PROVIDER=qpay npm run dev -w @way/api`
  2. Бүртгүүлээд `POST /orders` → 201, `qr.image` нь `data:image/png;base64,`-ээр эхэлнэ.
  3. `GET /orders/:id` → `pending`.

  Сүлжээ байхгүй бол алгасаад тайланд тэмдэглэнэ.

- [ ] **Step 5: Commit** — `docs: QPay провайдерын env, compose, README`
