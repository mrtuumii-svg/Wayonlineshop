/**
 * Хэрэглэгчийг админ болгоно: `npm run make-admin -w @way/api -- bat@example.com`
 *
 * API-аар биш скриптээр: сервер рүү хандаж чадах хэн ч өөрийгөө админ болгож чадахгүй,
 * зөвхөн DB-д хандах эрхтэй хүн л хийнэ. Хэрэглэгч эхлээд сайтаар бүртгүүлсэн байх ёстой.
 */
import { createPrisma } from '../src/db.js'

const email = process.argv[2]?.trim().toLowerCase()
const url = process.env.DATABASE_URL
if (!email || !url) {
  process.stderr.write('Хэрэглээ: npm run make-admin -w @way/api -- <имэйл>   (DATABASE_URL тохируулсан байх ёстой)\n')
  process.exit(1)
}

const prisma = createPrisma(url)
try {
  const { count } = await prisma.user.updateMany({ where: { email }, data: { role: 'admin' } })
  process.stdout.write(count ? `${email} одоо админ боллоо\n` : `${email} гэсэн хэрэглэгч олдсонгүй\n`)
  if (!count) process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
