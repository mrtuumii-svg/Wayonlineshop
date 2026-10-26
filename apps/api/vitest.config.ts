import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'prisma/**/*.test.ts'],
    globalSetup: ['src/test/globalSetup.ts'],
    // Тестүүд нэг санг хуваалцаж, хооронд нь truncate хийдэг тул файлуудыг дараалан ажиллуулна
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'prisma/**/*.ts'],
      // server.ts нь зөвхөн процесс эхлүүлэгч; generated нь Prisma-ийн үүсгэсэн код
      exclude: ['src/generated/**', 'src/test/**', 'src/server.ts', '**/*.test.ts'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
})
