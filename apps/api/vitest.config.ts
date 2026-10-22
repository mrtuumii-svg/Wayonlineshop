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
  },
})
