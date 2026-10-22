import { execFileSync } from 'node:child_process'
import { testDatabaseUrl } from './db.js'

/**
 * Тестийн сан дээр migration-ийг нэг удаа хэрэгжүүлнэ.
 * Сан: `docker compose up -d db-test` (5433). Өөр сан бол TEST_DATABASE_URL-ээр заана.
 */
export default function setup(): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}
