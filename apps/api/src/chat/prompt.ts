import { readFile } from 'node:fs/promises'
import type { PrismaClient } from '../db.js'

const LEVEL_LABEL = { beginner: 'Анхан шат', intermediate: 'Дунд шат', advanced: 'Ахисан шат' } as const

/** Сайт дээрхтэй ижил хэлбэр: 49,000₮ */
const formatPrice = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}₮`

// Хүсэлт бүрт файлаас уншина — prompt-ыг засаад серверийг дахин асаах шаардлагагүй
const readText = (name: string) => readFile(new URL(name, import.meta.url), 'utf8')

/**
 * Хичээл бүр нэг мөрөнд, ижил дараалалтай. Зөвхөн ботод хэрэгтэй талбарууд —
 * зураг, дотоод id зэргийг өгөхгүй (token нэмж, model-ийг будлиулна).
 */
export async function coursesAsText(prisma: PrismaClient): Promise<string> {
  const rows = await prisma.course.findMany({
    select: { title: true, price: true, level: true, category: true, instructor: { select: { name: true } } },
    orderBy: [{ category: 'asc' }, { title: 'asc' }],
  })
  if (rows.length === 0) return 'Одоогоор хичээл байхгүй.'
  return rows
    .map((c) => `- ${c.title} | ${formatPrice(c.price)} | ${LEVEL_LABEL[c.level]} | ${c.category} | багш: ${c.instructor.name}`)
    .join('\n')
}

/**
 * system-prompt.md-ийн `{{POLICY}}`, `{{COURSES}}`-ийг бөглөнө (grounding).
 * Хичээлийг сангаас хүсэлт бүрт уншдаг тул үнэ өөрчлөгдмөгц бот шинэ үнийг хэлнэ.
 */
export async function buildSystemPrompt(prisma: PrismaClient): Promise<string> {
  const [template, policy, courses] = await Promise.all([
    readText('./system-prompt.md'),
    readText('./policy.md'),
    coursesAsText(prisma),
  ])
  // Функцээр солино — `$&` гэх мэт тусгай тэмдэгт текст дотор байсан ч зөв орно
  return template.replace('{{POLICY}}', () => policy.trim()).replace('{{COURSES}}', () => courses)
}
