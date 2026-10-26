# Way Academy API — multi-stage image.
# Build context нь monorepo-ийн root (npm workspaces + package-lock.json тэнд байдаг):
#   docker build -f apps/api/Dockerfile -t way-api .

FROM node:22-bookworm-slim AS base
WORKDIR /app
# Prisma-ийн schema engine (migrate) openssl шаарддаг
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Workspace-ийн манифестууд — npm ci lockfile-ийг бүх workspace-тэй тулгадаг тул web-ийнх ч хэрэгтэй
FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contract/package.json packages/contract/

# ── build: бүх dependency (dev орно), Prisma client үүсгэж TypeScript-ийг хөрвүүлнэ.
# Migration болон seed-ийг ч энэ stage-ээр ажиллуулна (prisma CLI, tsx нь devDependency).
FROM manifests AS build
# postinstall дээр `prisma generate` ажилладаг тул schema түрүүлж хэрэгтэй
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN npm ci -w @way/api
COPY packages/contract packages/contract
COPY apps/api apps/api
RUN npm run build -w @way/api
WORKDIR /app/apps/api

# ── runtime: зөвхөн production dependency + хөрвүүлсэн код
FROM manifests AS runtime
ENV NODE_ENV=production
# --ignore-scripts: prisma generate (devDependency) хэрэггүй — client нь dist/generated-д бэлэн.
# argon2 нь prebuilt binary-гаа ажиллах үедээ ачаална.
RUN npm ci -w @way/api --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server.js"]
