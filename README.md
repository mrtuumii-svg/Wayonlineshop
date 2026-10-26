# Wayonlineshop

Way Academy — видео хичээл зарах онлайн дэлгүүрийн frontend (Vite + React + TypeScript).
Backend хараахан байхгүй тул `localStorage` дээр ажилладаг mock API ашиглана.

## Ажиллуулах

```bash
npm install
npm run dev      # хөгжүүлэлтийн сервер
npm test         # unit тест (Vitest)
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

### Frontend-ийг backend-тэй ажиллуулах

```bash
npm run dev -w @way/api                          # API (localhost:3000)
VITE_API_MODE=http npm run dev -w @way/web       # /api → localhost:3000 (dev proxy)
npm run e2e:http -w @way/web                     # E2E: бодит API + тестийн сан (5433)
```

`VITE_API_MODE` байхгүй бол frontend mock (localStorage) дээр ажиллана — unit тест болон GitHub Pages үүгээр явна.

## Бүтэц

- `src/api/` — `ApiClient` интерфейс ба mock хэрэгжилт (`VITE_API_MODE`-оор дараа нь солигдоно)
- `src/features/` — auth, cart, catalog, course, learning
- `src/pages/` — нүүр, каталог, хичээлийн дэлгэрэнгүй, сагс/төлбөр (mock QPay), нэвтрэх/бүртгүүлэх, миний хичээлүүд, видео үзэх
- `docs/superpowers/` — дизайны spec болон хэрэгжүүлэх төлөвлөгөө
