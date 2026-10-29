import type { Course, Lesson, Level, Section } from '../types'

/**
 * Blender Foundation-ийн нийтэд нээлттэй кинонууд — backend-ийн seed (`apps/api/prisma/seedData.ts`)-тэй
 * ижлээр хичээлийн дарааллаар оноогдоно.
 */
export const DEMO_YOUTUBE_IDS = ['aqz-KE-bpKQ', 'eRsGyueVLvQ', 'R6MlUcmOul8'] as const

export const categories: string[] = ['Програмчлал', 'Дизайн', 'Маркетинг', 'Англи хэл']

function lesson(id: string, title: string, durationSec: number, isPreview = false): Lesson {
  return { id, title, durationSec, isPreview }
}

function course(
  id: string,
  slug: string,
  title: string,
  price: number,
  category: string,
  level: Level,
  description: string,
  instructor: string,
  sections: Section[],
): Course {
  return {
    id,
    slug,
    title,
    description,
    price,
    category,
    level,
    thumbnail: `https://picsum.photos/seed/${slug}/640/360`,
    instructor: {
      name: instructor,
      avatar: `https://i.pravatar.cc/96?u=${encodeURIComponent(instructor)}`,
      bio: `${instructor} нь энэ чиглэлээр олон жил ажилласан туршлагатай багш.`,
    },
    sections: withDemoVideos(sections),
  }
}

function withDemoVideos(sections: Section[]): Section[] {
  let i = 0
  return sections.map((s) => ({
    ...s,
    lessons: s.lessons.map((l) => ({ ...l, youtubeId: DEMO_YOUTUBE_IDS[i++ % DEMO_YOUTUBE_IDS.length] })),
  }))
}

export const courses: Course[] = [
  course('c1', 'react-ekhlel', 'React эхлэл', 49000, 'Програмчлал', 'beginner',
    'React сангийн үндсэн ойлголтууд: компонент, props, state, hook-уудыг практик жишээгээр сурна.',
    'Б. Тэмүүлэн', [
      { id: 's1', title: 'Танилцуулга', lessons: [lesson('l1', 'React гэж юу вэ?', 307, true), lesson('l2', 'Орчин бэлтгэх', 420)] },
      { id: 's2', title: 'Компонент', lessons: [lesson('l3', 'Анхны компонент', 615)] },
    ]),
  course('c2', 'figma-undsen', 'Figma үндэс', 39000, 'Дизайн', 'beginner',
    'Figma дээр вэб болон аппын дэлгэцийн загвар зурж, прототип бэлтгэх анхан шатны хичээл.',
    'Г. Сарнай', [
      { id: 's1', title: 'Эхлэл', lessons: [lesson('c2l1', 'Интерфейстэй танилцах', 360), lesson('c2l2', 'Frame ба layer', 480)] },
    ]),
  course('c3', 'typescript-gunzgii', 'TypeScript гүнзгий', 89000, 'Програмчлал', 'intermediate',
    'Төрлийн систем, generic, utility type-уудыг ашиглан найдвартай код бичиж сурна.',
    'Д. Анар', [
      { id: 's1', title: 'Төрлүүд', lessons: [lesson('c3l1', 'Яагаад TypeScript вэ?', 300, true), lesson('c3l2', 'Generic', 720)] },
      { id: 's2', title: 'Практик', lessons: [lesson('c3l3', 'API-ийн төрөл бичих', 840)] },
    ]),
  course('c4', 'node-backend', 'Node.js backend архитектур', 129000, 'Програмчлал', 'advanced',
    'Томоохон Node.js системийн бүтэц, тест, гүйцэтгэлийн оновчлолыг судална.',
    'Э. Билгүүн', [
      { id: 's1', title: 'Архитектур', lessons: [lesson('c4l1', 'Давхаргат бүтэц', 900), lesson('c4l2', 'Алдааны удирдлага', 780)] },
    ]),
  course('c5', 'ux-sudalgaa', 'UX судалгаа', 59000, 'Дизайн', 'intermediate',
    'Хэрэглэгчийн ярилцлага, туршилт, persona боловсруулах аргачлал.',
    'Г. Сарнай', [
      { id: 's1', title: 'Судалгааны арга', lessons: [lesson('c5l1', 'Ярилцлага хийх', 540, true), lesson('c5l2', 'Usability тест', 660)] },
    ]),
  course('c6', 'digital-marketing', 'Дижитал маркетинг', 69000, 'Маркетинг', 'beginner',
    'Facebook, Instagram, Google зар сурталчилгааг үр дүнтэй ажиллуулах арга.',
    'О. Номин', [
      { id: 's1', title: 'Суурь', lessons: [lesson('c6l1', 'Зорилтот хэрэглэгч', 480, true), lesson('c6l2', 'Зарын төсөв', 510)] },
    ]),
  course('c7', 'content-marketing', 'Контент маркетинг', 45000, 'Маркетинг', 'intermediate',
    'Брэндийн түүх ярих, контент төлөвлөгөө гаргах, үр дүнг хэмжих.',
    'О. Номин', [
      { id: 's1', title: 'Контент', lessons: [lesson('c7l1', 'Контент төлөвлөгөө', 600), lesson('c7l2', 'Хэмжүүр', 450)] },
    ]),
  course('c8', 'angli-yariltsah', 'Англи хэлээр ярилцах', 35000, 'Англи хэл', 'beginner',
    'Өдөр тутмын харилцан ярианд хэрэгтэй үг хэллэг, дуудлагыг дасгалаар эзэмшинэ.',
    'Ж. Мөнхзул', [
      { id: 's1', title: 'Танилцах', lessons: [lesson('c8l1', 'Өөрийгөө танилцуулах', 330, true), lesson('c8l2', 'Асуулт асуух', 390)] },
    ]),
]
