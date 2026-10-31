# Бодит QPay провайдер (backend) — дизайн

**Огноо:** 2026-10-31 · **Branch:** `feat/qpay-provider` · **Төлөв:** батлагдсан дизайн

## Зорилго

`apps/api`-д fake-ийн оронд ажиллах бодит QPay v2 провайдер нэмж, `NODE_ENV=production`-оор ажиллуулах боломжтой болгох.

**Хязгаарлалт:**
- Бодит merchant credential одоогоор байхгүй. Хөгжүүлэлт ба тест sandbox (`TEST_MERCHANT`) дээр явна.
- Credential ирэхэд зөвхөн env солигдоно, код өөрчлөгдөхгүй.
- Frontend өөрчлөгдөхгүй. Http горимд `GET /orders/:id`-ийг аль хэдийн polling хийдэг.

**Амжилтын шалгуур:**
- `PAYMENT_PROVIDER=qpay` үед QPay-ийн жинхэнэ QR буцаана.
- Төлбөр орвол захиалга `paid` болж enrollment үүснэ.
- Хуурамч callback ирсэн ч эрх олгогдохгүй.
- Тестүүд QPay руу бодитоор хандахгүй.

## Үндсэн зарчим: callback бол зөвхөн дохио

QPay-ийн callback-д гарын үсэг байхгүй. Тиймээс түүний агуулгад итгэхгүй. Callback ирэхэд backend `/v2/payment/check`-ээр QPay-аас өөрөө дахин асууна. Мөн callback localhost-д хүрдэггүй, production-д ч алдагдаж болно. Иймээс `GET /orders/:id` нь pending захиалгыг провайдероос идэвхтэй шалгана.

**Татгалзсан хувилбар:** callback URL-д HMAC token хийж зөвхөн түүнд итгэх. Энэ нь callback-ийг жинхэнэ гэдгийг батлах ч мөнгө орсныг батлахгүй, бас localhost дээр ажиллахгүй.

## Бүрэлдэхүүн

### 1. `PaymentProvider` интерфейс (`payments/provider.ts`)

`checkPayment(invoiceId: string): Promise<'paid' | 'pending'>` нэмнэ.

- Fake: үргэлж `'pending'` буцаана. Түүний HMAC webhook урсгал хэвээр үлдэнэ.
- QPay-ийн `verifyWebhook` хэрэглэгдэхгүй. Дуудагдвал `validation` шиднэ, ингэснээр `/payments/webhook` нь QPay горимд эрх олгохгүй.

### 2. `payments/qpay.ts`

`apps/web/server/qpay.ts`-ийн логикийг зөөнө. `fetch`-ийг inject хийж болно (тестэд хэрэгтэй).

- **Token:** `POST /v2/auth/token`-ийг Basic auth-оор дуудна. Token-ийг дуусахаас 1 минутын өмнө хүртэл cache-лэнэ. `expires_in` нь unix секунд эсвэл үргэлжлэх хугацаа байж болох тул хоёуланг нь дэмжинэ. Хүсэлт 401 буцаавал token-ийг хаяж нэг удаа дахин оролдоно.
- **`createInvoice({ orderId, amount })`:** `POST /v2/invoice`. Payload:
  - `invoice_code`
  - `sender_invoice_no = orderId`
  - `invoice_receiver_code: 'terminal'`
  - `invoice_description: 'Way Academy'`
  - `amount`
  - `callback_url = {PUBLIC_API_URL}/payments/qpay/callback?order=<orderId>`

  `PUBLIC_API_URL` байхгүй бол (зөвхөн development) sandbox-ийн placeholder URL тавина. Үр дүн: `{ invoiceId: invoice_id, qr: { text: qr_text, image: 'data:image/png;base64,' + qr_image } }`.
- **`checkPayment(invoiceId)`:** `POST /v2/payment/check`, payload нь `{ object_type: 'INVOICE', object_id, offset: { page_number: 1, page_limit: 100 } }`. `rows`-д `payment_status === 'PAID'` мөр байвал `'paid'`, үгүй бол `'pending'`.
- **Хамгаалалт:** дуудлага бүр 10 секундын timeout-тэй (`AbortSignal.timeout(10_000)`). OK биш хариу эсвэл сүлжээний алдаа `QpayError` болно. Мессежид path ба status орно, secret ба token хэзээ ч орохгүй.

### 3. `settleOrder()` (orders-ийн нийтлэг туслах)

Одоогийн webhook дотор байгаа логикийг тусад нь функц болгож гаргана. Транзакц дотор захиалгыг `paid` болгоод `enrollment.createMany({ skipDuplicates: true })` хийнэ. Idempotent тул давхар дуудагдсан ч enrollment давхардахгүй. Дуудах газрууд:

| Хаана | Хэзээ |
|---|---|
| `POST /payments/webhook` | fake, гарын үсэг зөв бөгөөд `paid` |
| `GET\|POST /payments/qpay/callback?order=<id>` | захиалга олдсон, `checkPayment` нь `'paid'` |
| `GET /orders/:id` | захиалга `pending`, провайдер таарч байна, `checkPayment` нь `'paid'` |

### 4. Шинэ route: `/payments/qpay/callback`

- Auth шаардахгүй (QPay дуудна). `GET` ба `POST` хоёуланг хүлээн авна.
- Callback-ийн бие болон query-ийн `order`-оос өөр юманд итгэхгүй.
- `order` байхгүй, буруу хэлбэртэй, эсвэл ийм захиалга алга бол 404.
- Захиалга `paid` эсвэл провайдер нь таарахгүй бол QPay-г дуудалгүй 200 `{ ok: true }` буцаана.
- Бусад үед `checkPayment(providerInvoiceId)` дуудна: `'paid'` бол `settleOrder`, `'pending'` бол юу ч хийхгүй. Аль ч тохиолдолд 200 `{ ok: true }` буцаана.
- Callback хэзээ ч захиалгыг `failed` болгохгүй.
- QPay алдаа өгвөл 503 `UNAVAILABLE` буцаана, QPay дахин оролдоно.
- Хуурамч callback ирэхэд хамгийн муу тохиолдолд нэг нэмэлт шалгалт л болно.

### 5. `GET /orders/:id` дээрх polling

Захиалга `pending` бөгөөд `order.provider === payments.name` бол:

1. **Throttle:** нэг захиалгыг санах ойн `Map<orderId, lastCheckedAt>`-аар 3 секундэд нэгээс олон удаа шалгахгүй. Map-ийн хэмжээг хязгаарлаж, хуучин бичлэгийг цэвэрлэнэ.
2. `checkPayment` → `'paid'` бол `settleOrder` хийгээд `paid` буцаана.
3. QPay алдаа өгвөл логлоод `pending` буцаана, polling унахгүй.
4. **Хугацаа дуусалт** (10 минут): `failed` болгохоос өмнө throttle-оос үл хамааран нэг удаа заавал `checkPayment` хийнэ. Сүүлийн секундэд төлсөн хүний мөнгө алдагдахгүй. Шалгалт алдаа өгвөл `failed` болгохгүй, `pending` хэвээр үлдэнэ (дараагийн poll дахин оролдоно).

Fake провайдер `'pending'` буцаадаг тул fake-ийн зан төлөв өөрчлөгдөхгүй.

### 6. `POST /orders`

`createInvoice` QPay-ийн алдаа шидвэл захиалга `failed` болно. Хэрэглэгчид 503 `UNAVAILABLE` "QPay-тэй холбогдож чадсангүй. Дахин оролдоно уу." (`unavailable()`) харагдана, дэлгэрэнгүй нь зөвхөн лог руу явна. `ApiErrorCode`-д 502-ийн код байхгүй, шинэ код нэмбэл contract болон frontend өөрчлөгдөх тул одоо байгаа 503-ыг ашиглана.

## Config (`config.ts`)

| Хувьсагч | Тайлбар |
|---|---|
| `PAYMENT_PROVIDER` | `fake` \| `qpay` (анхдагч `fake`) |
| `QPAY_BASE_URL` | Анхдагч `https://merchant-sandbox.qpay.mn`. Credential тавивал анхдагч нь `https://merchant.qpay.mn` болно |
| `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE` | Гурвуулаа байхгүй бол sandbox (`TEST_MERCHANT` / `123456` / `TEST_INVOICE`). Нэг нь байгаа бол бүгд заавал байх ёстой |
| `PUBLIC_API_URL` | QPay callback-ийн суурь хаяг. Development-д заавал биш |

**Production-ий дүрэм:**
- fake хориотой (хуучин дүрэм хэвээр);
- `qpay` бол sandbox хориотой, бодит credential заавал байх ёстой;
- `PUBLIC_API_URL` заавал `https://`-ээр эхэлсэн байх ёстой.

`PAYMENT_WEBHOOK_SECRET` шаардлагатай хэвээр үлдэнэ. Fake-д хэрэгтэй бөгөөд хуучин тохиргоог эвдэхгүй.

Алдааны мессежид хувьсагчийн нэр л орно, утга нь хэзээ ч орохгүй (одоогийн журам).

## Sandbox

`TEST_MERCHANT`-ийн QR-ийг банкны апп уншихгүй. Sandbox дээр гараар туршихад invoice/QR үүсч, polling ажиллаж байгааг л харна. "Төлөгдсөн" урсгалыг автомат тест болон fake провайдер шалгана.

Backend-д simulate endpoint нэмэхгүй (YAGNI). `apps/web/server/qpay.ts` хөндөгдөхгүй, нэгтгэх ажлыг дараа хийнэ.

## Тест (TDD, хамрах хүрээ 80%+)

**`payments/qpay.test.ts`** (fetch-ийг stub хийнэ):
- token cache;
- 401 ирэхэд token шинэчлээд нэг удаа дахин оролдох;
- invoice-ийн payload (`sender_invoice_no`, `callback_url`, `amount`);
- QR-ийн хөрвүүлэлт;
- `PAID` эсвэл бусад статус → `'paid'`/`'pending'`;
- OK биш хариу ба timeout → `QpayError`, мессежид secret байхгүй;
- `verifyWebhook` нь `validation` шиднэ.

**`routes/orders.test.ts`** (удирддаг stub провайдер):
- callback + `'paid'` → захиалга `paid` болж enrollment үүснэ;
- callback + `'pending'` → юу ч өөрчлөгдөхгүй;
- мэдэгдэхгүй эсвэл буруу `order` → 404;
- аль хэдийн `paid` захиалга → QPay дуудагдахгүй;
- давхар callback → enrollment давхардахгүй;
- polling-оор `paid` болно;
- 3 секундын дотор дахин poll хийхэд QPay дуудагдахгүй;
- хугацаа дуусахад сүүлийн шалгалт `'paid'` бол `paid`, `'pending'` бол `failed` болно;
- polling үед QPay алдаа → `pending`;
- `createInvoice` алдаа → 503, захиалга `failed`;
- fake урсгалын бүх хуучин тест ногоон хэвээр.

**`config.test.ts`:** провайдерын enum, sandbox-ийн анхдагч утгууд, дутуу credential, production-д sandbox/fake хориотой, `PUBLIC_API_URL`-ийн https шаардлага.

## Docs

- README-ийн "API-ийн орчны хувьсагчид" хүснэгт ба QPay-ийн тэмдэглэлийг шинэчилнэ.
- `apps/api/.env.example` ба root `.env.example`-ийг шинэчилнэ.
- `docker-compose.yml`-ийн `api` service-д `PAYMENT_PROVIDER` болон `QPAY_*`, `PUBLIC_API_URL` хувьсагчдыг дамжуулна.

## Хамрахгүй

- Буцаалт/цуцлалт (`refunded`).
- Банкны deeplink-ууд (`urls`): contract-д талбар байхгүй, дараа нэмнэ.
- `apps/web/server/qpay.ts`-ийг backend-тэй нэгтгэх.
- Олон instance-тэй үед throttle-ийг хуваалцах. Одоогоор нэг instance тул санах ойн throttle хангалттай.
