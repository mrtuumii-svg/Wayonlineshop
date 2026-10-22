import type { PrismaClient } from '../db.js'

/** LIKE-ийн тусгай тэмдэгтүүдийг шууд утгаар нь хайхаар escape хийнэ (анхдагч escape нь `\`) */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`)

/**
 * Гарчиг, тайлбар, категори, багшийн нэрээр том-жижиг үсэг ялгахгүй хайж тохирсон курсийн ID-г буцаана.
 *
 * `lower(... COLLATE "und-x-icu")` — ICU-г тодорхой заасан тул DB-ийн locale-оос үл хамааран
 * кирилл/монгол үсэг (Ү, Ө) зөв жижиг болно. Илэрхийлэл нь migration-ийн
 * `*_trgm_idx` GIN индексүүдтэй яг ижил байх ёстой — өөрчилбөл индекс ашиглагдахаа болино.
 */
export async function searchCourseIds(prisma: PrismaClient, q: string): Promise<string[]> {
  const pattern = `%${escapeLike(q)}%`
  // Салбар бүр өөрийн GIN индексийг ашиглана. OR-оор (ялангуяа JOIN-той) нийлүүлбэл seq scan болно.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Course" WHERE lower(title COLLATE "und-x-icu") LIKE lower(${pattern} COLLATE "und-x-icu")
    UNION
    SELECT id FROM "Course" WHERE lower(description COLLATE "und-x-icu") LIKE lower(${pattern} COLLATE "und-x-icu")
    UNION
    SELECT id FROM "Course" WHERE lower(category COLLATE "und-x-icu") LIKE lower(${pattern} COLLATE "und-x-icu")
    UNION
    SELECT c.id FROM "Course" c JOIN "Instructor" i ON i.id = c."instructorId"
    WHERE lower(i.name COLLATE "und-x-icu") LIKE lower(${pattern} COLLATE "und-x-icu")`
  return rows.map((r) => r.id)
}
