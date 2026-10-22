/**
 * Анхны өгөгдөл: `npm run db:seed` (эсвэл `prisma migrate reset`-ийн дараа автоматаар).
 * Idempotent — ID-аар upsert хийдэг тул хэдэн ч удаа ажиллуулж болно, утга нь шинэчлэгдэнэ.
 * Өгөгдлөөс хасагдсан хичээлийг зориуд устгахгүй: устгавал хэрэглэгчдийн явц cascade-аар алга болно.
 */
import { pathToFileURL } from 'node:url'
import { createPrisma, type PrismaClient } from '../src/db.js'
import { courses, instructors, YOUTUBE_IDS } from './seedData.js'

const avatarUrl = (name: string) => `https://i.pravatar.cc/96?u=${encodeURIComponent(name)}`
const thumbnailUrl = (slug: string) => `https://picsum.photos/seed/${slug}/640/360`

function youtubeIdFor(lessonId: string): string {
  const id = YOUTUBE_IDS[lessonId]
  if (!id) throw new Error(`YOUTUBE_IDS-д "${lessonId}" хичээлийн видео алга`)
  return id
}

export async function seed(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const i of instructors) {
      const data = {
        name: i.name,
        avatar: avatarUrl(i.name),
        bio: `${i.name} нь энэ чиглэлээр олон жил ажилласан туршлагатай багш.`,
      }
      await tx.instructor.upsert({ where: { id: i.id }, create: { id: i.id, ...data }, update: data })
    }

    for (const { sections, ...c } of courses) {
      const data = { ...c, thumbnail: thumbnailUrl(c.slug) }
      await tx.course.upsert({ where: { id: c.id }, create: data, update: data })

      for (const [si, s] of sections.entries()) {
        // Fixtures-ийн section ID нь хичээл хооронд давхцдаг (s1) тул курсийн ID-тай нийлүүлнэ
        const sectionId = `${c.id}-s${si + 1}`
        const sectionData = { courseId: c.id, order: si + 1, title: s.title }
        await tx.section.upsert({ where: { id: sectionId }, create: { id: sectionId, ...sectionData }, update: sectionData })

        for (const [li, l] of s.lessons.entries()) {
          const lessonData = {
            sectionId,
            order: li + 1,
            title: l.title,
            durationSec: l.durationSec,
            isPreview: l.isPreview ?? false,
            youtubeId: youtubeIdFor(l.id),
          }
          await tx.lesson.upsert({ where: { id: l.id }, create: { id: l.id, ...lessonData }, update: lessonData })
        }
      }
    }
  }, { timeout: 30_000 })
}

// `tsx prisma/seed.ts`-ээр шууд ажиллуулсан үед л (тестээс import хийхэд биш)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL
  if (!url) {
    process.stderr.write('DATABASE_URL тохируулаагүй байна\n')
    process.exit(1)
  }
  const prisma = createPrisma(url)
  try {
    await seed(prisma)
    process.stdout.write(`Seed дууслаа: ${courses.length} хичээл, ${instructors.length} багш\n`)
  } finally {
    await prisma.$disconnect()
  }
}
