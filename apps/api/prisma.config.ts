import { defineConfig } from 'prisma/config'

// Prisma 7 нь .env-ийг өөрөө уншдаггүй. Файл байхгүй бол (CI, production) орчны хувьсагчийг шууд ашиглана.
try {
  process.loadEnvFile('.env')
} catch {
  // .env байхгүй — зүгээр
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // `prisma generate` DB шаарддаггүй тул DATABASE_URL байхгүй байж болно (жишээ нь CI build)
  datasource: { url: process.env.DATABASE_URL },
})
