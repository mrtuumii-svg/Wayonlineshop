# Wayonlineshop

Way Academy — видео хичээл зарах онлайн дэлгүүр. npm workspaces monorepo:

- `apps/web` — frontend (Vite + React + TypeScript). Анхдагчаар `localStorage` mock API дээр, `VITE_API_MODE=http` үед бодит backend-тэй ажиллана.
- `apps/api` — backend (Fastify + Prisma + PostgreSQL).
- `packages/contract` — frontend ба backend-ийн хуваалцсан type-ууд.

## Ажиллуулах

```bash
npm install
npm run dev      # хөгжүүлэлтийн сервер
npm test         # unit тест (Vitest)
npm run test:coverage -w @way/web   # хамрах хүрээ (босго 80%; api-д ч мөн адил)
npm run e2e      # E2E тест (Playwright)
npm run build    # production build
```

### Backend өгөгдлийн сан (`apps/api`)

API-ийн тестүүд PostgreSQL шаарддаг (Docker Desktop хэрэгтэй):

```bash
docker compose up -d                 # dev (5432) ба тест (5433) сан
cp apps/api/.env.example apps/api/.env
npm run db:deploy -w @way/api        # migration хэрэгжүүлэх
npm run db:seed -w @way/api          # 8 хичээл, 6 багш оруулах
npm run db:migrate -w @way/api       # schema.prisma өөрчилсний дараа шинэ migration
```

Өөр тестийн сан ашиглах бол `TEST_DATABASE_URL`-ээр заана.

### API-г Docker-оор ажиллуулах

```bash
cp .env.example .env      # JWT_SECRET, PAYMENT_WEBHOOK_SECRET-ийг бөглөнө
docker compose --profile app up -d --build
```

`migrate` контейнер migration + seed хийгээд гарна, дараа нь `api` нь `localhost:3000` дээр асна.
Profile-гүй `docker compose up -d` нь өмнөх шигээ зөвхөн сангуудыг асаана.

Image-ийг дангаар нь: `docker build -f apps/api/Dockerfile -t way-api .` (build context нь root).

> Төлбөр одоогоор зөвхөн `fake` провайдер. Энэ нь production-д хориотой (`NODE_ENV=production` үед сервер эхлэхгүй),
> тиймээс compose дээр `NODE_ENV=development`. Бодит QPay провайдер нэмэгдсэний дараа production болгоно.

### API-ийн орчны хувьсагчид

| Хувьсагч | Заавал | Анхдагч | Тайлбар |
|---|---|---|---|
| `DATABASE_URL` | ✓ | — | `postgresql://...` холболтын хаяг |
| `JWT_SECRET` | ✓ | — | Токены гарын үсгийн түлхүүр, дор хаяж 32 тэмдэгт |
| `PAYMENT_WEBHOOK_SECRET` | ✓ | — | Төлбөрийн webhook-ийн гарын үсэг, дор хаяж 32 тэмдэгт, `JWT_SECRET`-ээс өөр |
| `CORS_ORIGIN` | ✓ | — | Frontend-ийн origin, олон бол таслалаар |
| `NODE_ENV` | | `development` | `development` / `test` / `production` |
| `HOST` | | `0.0.0.0` | Сонсох хаяг |
| `PORT` | | `3000` | Сонсох порт |
| `PAYMENT_PROVIDER` | | `fake` | Одоогоор зөвхөн `fake` (production-д хориотой) |
| `FAKE_PAY_AFTER_MS` | | `2000` | Fake провайдер хэдэн ms-ийн дараа автоматаар "төлөгдөх". `0` = гараар |
| `TEST_DATABASE_URL` | | `...localhost:5433/way_test` | Зөвхөн тестэд |

Буруу эсвэл дутуу бол сервер эхлэхдээ аль хувьсагч буруу болохыг (утгыг нь биш) хэлээд унана.
Санамсаргүй түлхүүр: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

### Frontend-ийн орчны хувьсагчид

| Хувьсагч | Анхдагч | Тайлбар |
|---|---|---|
| `VITE_API_MODE` | `mock` | `http` бол бодит backend |
| `VITE_API_URL` | хоосон | http горимд backend-ийн хаяг; хоосон бол dev proxy-ийн `/api` |
| `API_PROXY_TARGET` | `http://localhost:3000` | Dev proxy-ийн чиглэл (зөвхөн dev сервер) |
| `VITE_PAYMENT_MODE` | `qpay` | `mock` бол QPay руу хандахгүй |
| `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE` | хоосон (sandbox) | Dev серверийн QPay middleware; браузерт очихгүй |

### Frontend-ийг backend-тэй ажиллуулах

```bash
npm run dev -w @way/api                          # API (localhost:3000)
VITE_API_MODE=http npm run dev -w @way/web       # /api → localhost:3000 (dev proxy)
npm run e2e:http -w @way/web                     # E2E: бодит API + тестийн сан (5433)
```

`VITE_API_MODE` байхгүй бол frontend mock (localStorage) дээр ажиллана — unit тест болон GitHub Pages үүгээр явна.

## Бүтэц

- `apps/web/src/api/` — `ApiClient` интерфейс, mock ба HTTP хэрэгжилт (`VITE_API_MODE`-оор сонгоно)
- `apps/web/src/features/` — auth, cart, catalog, course, learning
- `apps/web/src/pages/` — нүүр, каталог, хичээлийн дэлгэрэнгүй, сагс/төлбөр (QPay), нэвтрэх/бүртгүүлэх, миний хичээлүүд, видео үзэх
- `apps/api/src/routes/` — auth, courses, orders, me (+ integration тест)
- `apps/api/prisma/` — schema, migration, seed
- `docs/superpowers/` — дизайны spec болон хэрэгжүүлэх төлөвлөгөө
