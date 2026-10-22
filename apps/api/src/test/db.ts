import { createPrisma, type PrismaClient } from '../db.js'

/** docker-compose.yml-ийн `db-test` (5433). Өөр сан ашиглах бол TEST_DATABASE_URL-ээр солино. */
export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://way:way_dev_only@localhost:5433/way_test'

export const createTestPrisma = (): PrismaClient => createPrisma(testDatabaseUrl)

/**
 * Тест хооронд бүх хүснэгтийг хоосолно. Хүснэгтийн жагсаалтыг каталогоос уншдаг тул
 * шинэ model нэмэхэд энд өөрчлөх шаардлагагүй. `_prisma_migrations`-ийг үлдээнэ.
 */
export async function resetDb(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (rows.length === 0) return
  const tables = rows.map((r) => `"public"."${r.tablename.replaceAll('"', '""')}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`)
}
