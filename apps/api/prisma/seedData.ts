/**
 * Seed-ийн эх өгөгдөл — `apps/web/src/api/mock/fixtures.ts`-ийн хуулбар.
 * ID-ууд (c1, l1, ...) нь frontend-ийн mock-той ижил тул сагс/явцын өгөгдөл зөрөхгүй.
 * Web тал HTTP API руу шилжиж mock устахад энэ файл цорын ганц эх сурвалж болно.
 */
import type { Level } from '@way/contract'

/** Blender Foundation-ийн нийтэд нээлттэй кинонууд — бодит бичлэг upload хийгдэх хүртэлх түр ID */
const DEMO = {
  bigBuckBunny: 'aqz-KE-bpKQ',
  sintel: 'eRsGyueVLvQ',
  tearsOfSteel: 'R6MlUcmOul8',
} as const

/**
 * Хичээлийн ID → YouTube ID. Бичлэгээ (unlisted) upload хийсний дараа зөвхөн энэ хүснэгтийг
 * сольж `npm run db:seed` ажиллуулна.
 */
export const YOUTUBE_IDS: Record<string, string> = {
  l1: DEMO.bigBuckBunny, l2: DEMO.sintel, l3: DEMO.tearsOfSteel,
  c2l1: DEMO.bigBuckBunny, c2l2: DEMO.sintel,
  c3l1: DEMO.bigBuckBunny, c3l2: DEMO.sintel, c3l3: DEMO.tearsOfSteel,
  c4l1: DEMO.bigBuckBunny, c4l2: DEMO.sintel,
  c5l1: DEMO.bigBuckBunny, c5l2: DEMO.sintel,
  c6l1: DEMO.bigBuckBunny, c6l2: DEMO.sintel,
  c7l1: DEMO.bigBuckBunny, c7l2: DEMO.sintel,
  c8l1: DEMO.bigBuckBunny, c8l2: DEMO.sintel,
}

export interface SeedInstructor {
  id: string
  name: string
}

export interface SeedLesson {
  id: string
  title: string
  durationSec: number
  isPreview?: boolean
}

export interface SeedCourse {
  id: string
  slug: string
  title: string
  price: number
  category: string
  level: Level
  description: string
  instructorId: string
  sections: { title: string; lessons: SeedLesson[] }[]
}

export const instructors: SeedInstructor[] = [
  { id: 'i1', name: 'Б. Тэмүүлэн' },
  { id: 'i2', name: 'Г. Сарнай' },
  { id: 'i3', name: 'Д. Анар' },
  { id: 'i4', name: 'Э. Билгүүн' },
  { id: 'i5', name: 'О. Номин' },
  { id: 'i6', name: 'Ж. Мөнхзул' },
]

export const courses: SeedCourse[] = [
  {
    id: 'c1', slug: 'react-ekhlel', title: 'React эхлэл', price: 49000, category: 'Програмчлал', level: 'beginner',
    description: 'React сангийн үндсэн ойлголтууд: компонент, props, state, hook-уудыг практик жишээгээр сурна.',
    instructorId: 'i1',
    sections: [
      { title: 'Танилцуулга', lessons: [
        { id: 'l1', title: 'React гэж юу вэ?', durationSec: 307, isPreview: true },
        { id: 'l2', title: 'Орчин бэлтгэх', durationSec: 420 },
      ] },
      { title: 'Компонент', lessons: [{ id: 'l3', title: 'Анхны компонент', durationSec: 615 }] },
    ],
  },
  {
    id: 'c2', slug: 'figma-undsen', title: 'Figma үндэс', price: 39000, category: 'Дизайн', level: 'beginner',
    description: 'Figma дээр вэб болон аппын дэлгэцийн загвар зурж, прототип бэлтгэх анхан шатны хичээл.',
    instructorId: 'i2',
    sections: [
      { title: 'Эхлэл', lessons: [
        { id: 'c2l1', title: 'Интерфейстэй танилцах', durationSec: 360 },
        { id: 'c2l2', title: 'Frame ба layer', durationSec: 480 },
      ] },
    ],
  },
  {
    id: 'c3', slug: 'typescript-gunzgii', title: 'TypeScript гүнзгий', price: 89000, category: 'Програмчлал', level: 'intermediate',
    description: 'Төрлийн систем, generic, utility type-уудыг ашиглан найдвартай код бичиж сурна.',
    instructorId: 'i3',
    sections: [
      { title: 'Төрлүүд', lessons: [
        { id: 'c3l1', title: 'Яагаад TypeScript вэ?', durationSec: 300, isPreview: true },
        { id: 'c3l2', title: 'Generic', durationSec: 720 },
      ] },
      { title: 'Практик', lessons: [{ id: 'c3l3', title: 'API-ийн төрөл бичих', durationSec: 840 }] },
    ],
  },
  {
    id: 'c4', slug: 'node-backend', title: 'Node.js backend архитектур', price: 129000, category: 'Програмчлал', level: 'advanced',
    description: 'Томоохон Node.js системийн бүтэц, тест, гүйцэтгэлийн оновчлолыг судална.',
    instructorId: 'i4',
    sections: [
      { title: 'Архитектур', lessons: [
        { id: 'c4l1', title: 'Давхаргат бүтэц', durationSec: 900 },
        { id: 'c4l2', title: 'Алдааны удирдлага', durationSec: 780 },
      ] },
    ],
  },
  {
    id: 'c5', slug: 'ux-sudalgaa', title: 'UX судалгаа', price: 59000, category: 'Дизайн', level: 'intermediate',
    description: 'Хэрэглэгчийн ярилцлага, туршилт, persona боловсруулах аргачлал.',
    instructorId: 'i2',
    sections: [
      { title: 'Судалгааны арга', lessons: [
        { id: 'c5l1', title: 'Ярилцлага хийх', durationSec: 540, isPreview: true },
        { id: 'c5l2', title: 'Usability тест', durationSec: 660 },
      ] },
    ],
  },
  {
    id: 'c6', slug: 'digital-marketing', title: 'Дижитал маркетинг', price: 69000, category: 'Маркетинг', level: 'beginner',
    description: 'Facebook, Instagram, Google зар сурталчилгааг үр дүнтэй ажиллуулах арга.',
    instructorId: 'i5',
    sections: [
      { title: 'Суурь', lessons: [
        { id: 'c6l1', title: 'Зорилтот хэрэглэгч', durationSec: 480, isPreview: true },
        { id: 'c6l2', title: 'Зарын төсөв', durationSec: 510 },
      ] },
    ],
  },
  {
    id: 'c7', slug: 'content-marketing', title: 'Контент маркетинг', price: 45000, category: 'Маркетинг', level: 'intermediate',
    description: 'Брэндийн түүх ярих, контент төлөвлөгөө гаргах, үр дүнг хэмжих.',
    instructorId: 'i5',
    sections: [
      { title: 'Контент', lessons: [
        { id: 'c7l1', title: 'Контент төлөвлөгөө', durationSec: 600 },
        { id: 'c7l2', title: 'Хэмжүүр', durationSec: 450 },
      ] },
    ],
  },
  {
    id: 'c8', slug: 'angli-yariltsah', title: 'Англи хэлээр ярилцах', price: 35000, category: 'Англи хэл', level: 'beginner',
    description: 'Өдөр тутмын харилцан ярианд хэрэгтэй үг хэллэг, дуудлагыг дасгалаар эзэмшинэ.',
    instructorId: 'i6',
    sections: [
      { title: 'Танилцах', lessons: [
        { id: 'c8l1', title: 'Өөрийгөө танилцуулах', durationSec: 330, isPreview: true },
        { id: 'c8l2', title: 'Асуулт асуух', durationSec: 390 },
      ] },
    ],
  },
  {
    id: 'c9', slug: 'python-ekhlel', title: 'Python эхлэл', price: 45000, category: 'Програмчлал', level: 'beginner',
    description: 'Python хэлний суурь: хувьсагч, нөхцөл, давталт, функцийг жижиг төслүүдээр сурна.',
    instructorId: 'i1',
    sections: [
      { title: 'Эхлэл', lessons: [
        { id: 'c9l1', title: 'Python суулгах', durationSec: 300, isPreview: true },
        { id: 'c9l2', title: 'Анхны програм', durationSec: 420 },
      ] },
      { title: 'Суурь', lessons: [
        { id: 'c9l3', title: 'Нөхцөл ба давталт', durationSec: 600 },
        { id: 'c9l4', title: 'Функц', durationSec: 540 },
      ] },
    ],
  },
  {
    id: 'c10', slug: 'javascript-suuri', title: 'JavaScript суурь', price: 45000, category: 'Програмчлал', level: 'beginner',
    description: 'Вэбийн хэл JavaScript-ийн үндэс: төрөл, функц, массив, DOM-той ажиллах.',
    instructorId: 'i3',
    sections: [
      { title: 'Хэлний үндэс', lessons: [
        { id: 'c10l1', title: 'JavaScript гэж юу вэ?', durationSec: 280, isPreview: true },
        { id: 'c10l2', title: 'Хувьсагч ба төрөл', durationSec: 480 },
      ] },
      { title: 'Вэб хуудас', lessons: [
        { id: 'c10l3', title: 'DOM өөрчлөх', durationSec: 660 },
      ] },
    ],
  },
  {
    id: 'c11', slug: 'sql-ugugdliin-san', title: 'SQL ба өгөгдлийн сан', price: 55000, category: 'Програмчлал', level: 'beginner',
    description: 'SELECT, JOIN, GROUP BY-ээс эхлээд индекс хүртэл — өгөгдлийн сантай ажиллаж сурна.',
    instructorId: 'i4',
    sections: [
      { title: 'Query', lessons: [
        { id: 'c11l1', title: 'Хүснэгт ба мөр', durationSec: 320, isPreview: true },
        { id: 'c11l2', title: 'SELECT ба WHERE', durationSec: 540 },
      ] },
      { title: 'Холбоо', lessons: [
        { id: 'c11l3', title: 'JOIN', durationSec: 720 },
        { id: 'c11l4', title: 'Индекс', durationSec: 600 },
      ] },
    ],
  },
  {
    id: 'c12', slug: 'git-github', title: 'Git ба GitHub', price: 29000, category: 'Програмчлал', level: 'beginner',
    description: 'Commit, branch, merge, pull request — багаар код бичих үндсэн хэрэгсэл.',
    instructorId: 'i1',
    sections: [
      { title: 'Git', lessons: [
        { id: 'c12l1', title: 'Яагаад Git?', durationSec: 240, isPreview: true },
        { id: 'c12l2', title: 'Commit ба branch', durationSec: 540 },
      ] },
      { title: 'GitHub', lessons: [
        { id: 'c12l3', title: 'Pull request', durationSec: 600 },
      ] },
    ],
  },
  {
    id: 'c13', slug: 'ugugdliin-shinjilgee', title: 'Өгөгдлийн шинжилгээ Python-оор', price: 79000, category: 'Програмчлал', level: 'intermediate',
    description: 'pandas, NumPy, Matplotlib ашиглан бодит өгөгдлийг цэвэрлэж, шинжилж, график зурна.',
    instructorId: 'i3',
    sections: [
      { title: 'pandas', lessons: [
        { id: 'c13l1', title: 'DataFrame', durationSec: 420, isPreview: true },
        { id: 'c13l2', title: 'Цэвэрлэх ба нэгтгэх', durationSec: 720 },
      ] },
      { title: 'Дүрслэл', lessons: [
        { id: 'c13l3', title: 'График зурах', durationSec: 600 },
      ] },
    ],
  },
  {
    id: 'c14', slug: 'mashin-surgalt', title: 'Машин сургалтын үндэс', price: 119000, category: 'Програмчлал', level: 'advanced',
    description: 'Регресс, ангилал, нейрон сүлжээ — машин сургалтын гол аргуудыг Python-оор хэрэгжүүлнэ.',
    instructorId: 'i4',
    sections: [
      { title: 'Үндэс', lessons: [
        { id: 'c14l1', title: 'Машин сургалт гэж юу вэ?', durationSec: 360, isPreview: true },
        { id: 'c14l2', title: 'Регресс', durationSec: 780 },
      ] },
      { title: 'Гүн сургалт', lessons: [
        { id: 'c14l3', title: 'Нейрон сүлжээ', durationSec: 900 },
      ] },
    ],
  },
  {
    id: 'c15', slug: 'linux-komand', title: 'Linux командын мөр', price: 35000, category: 'Програмчлал', level: 'beginner',
    description: 'Терминал, файл систем, эрх, shell script — серверийн ажлын суурь ур чадвар.',
    instructorId: 'i1',
    sections: [
      { title: 'Терминал', lessons: [
        { id: 'c15l1', title: 'Анхны командууд', durationSec: 300, isPreview: true },
        { id: 'c15l2', title: 'Файл ба хавтас', durationSec: 480 },
      ] },
      { title: 'Script', lessons: [
        { id: 'c15l3', title: 'Shell script бичих', durationSec: 660 },
      ] },
    ],
  },
  {
    id: 'c16', slug: 'docker-devops', title: 'Docker ба DevOps', price: 99000, category: 'Програмчлал', level: 'intermediate',
    description: 'Container, image, docker compose, CI/CD — аппаа хаана ч ижилхэн ажиллуулж сурна.',
    instructorId: 'i4',
    sections: [
      { title: 'Docker', lessons: [
        { id: 'c16l1', title: 'Container гэж юу вэ?', durationSec: 330, isPreview: true },
        { id: 'c16l2', title: 'Dockerfile бичих', durationSec: 720 },
      ] },
      { title: 'DevOps', lessons: [
        { id: 'c16l3', title: 'CI/CD', durationSec: 780 },
      ] },
    ],
  },
  {
    id: 'c17', slug: 'brend-logo-dizain', title: 'Брэнд ба логоны дизайн', price: 59000, category: 'Дизайн', level: 'beginner',
    description: 'Брэндийн өнгө, лого, хэв маягийг бүтээж, брэндбүк бэлтгэх үндэс.',
    instructorId: 'i2',
    sections: [
      { title: 'Брэнд', lessons: [
        { id: 'c17l1', title: 'Брэнд гэж юу вэ?', durationSec: 300, isPreview: true },
        { id: 'c17l2', title: 'Лого бүтээх', durationSec: 660 },
      ] },
      { title: 'Брэндбүк', lessons: [
        { id: 'c17l3', title: 'Өнгө ба хэв', durationSec: 540 },
      ] },
    ],
  },
  {
    id: 'c18', slug: 'ungu-typography', title: 'Өнгө ба типографи', price: 49000, category: 'Дизайн', level: 'intermediate',
    description: 'Өнгөний онол, үсгийн хэв, зохиомжоор дизайнаа мэргэжлийн түвшинд хүргэнэ.',
    instructorId: 'i5',
    sections: [
      { title: 'Өнгө', lessons: [
        { id: 'c18l1', title: 'Өнгөний онол', durationSec: 360, isPreview: true },
        { id: 'c18l2', title: 'Палитр сонгох', durationSec: 480 },
      ] },
      { title: 'Типографи', lessons: [
        { id: 'c18l3', title: 'Үсгийн хэв хослуулах', durationSec: 600 },
      ] },
    ],
  },
  {
    id: 'c19', slug: 'social-media-marketing', title: 'Сошиал медиа маркетинг', price: 39000, category: 'Маркетинг', level: 'beginner',
    description: 'Facebook, Instagram, TikTok дээр контент төлөвлөж, сурталчилгаа явуулж, үр дүнг хэмжинэ.',
    instructorId: 'i5',
    sections: [
      { title: 'Стратеги', lessons: [
        { id: 'c19l1', title: 'Сошиал медиагийн үндэс', durationSec: 300, isPreview: true },
        { id: 'c19l2', title: 'Контент төлөвлөгөө', durationSec: 540 },
      ] },
      { title: 'Сурталчилгаа', lessons: [
        { id: 'c19l3', title: 'Төлбөртэй сурталчилгаа', durationSec: 600 },
      ] },
    ],
  },
  {
    id: 'c20', slug: 'ielts-beltgel', title: 'IELTS бэлтгэл', price: 89000, category: 'Англи хэл', level: 'intermediate',
    description: 'IELTS-ийн сонсох, унших, бичих, ярих 4 хэсгийн стратеги ба дасгал.',
    instructorId: 'i6',
    sections: [
      { title: 'Унших ба сонсох', lessons: [
        { id: 'c20l1', title: 'Шалгалтын бүтэц', durationSec: 300, isPreview: true },
        { id: 'c20l2', title: 'Унших стратеги', durationSec: 600 },
      ] },
      { title: 'Бичих ба ярих', lessons: [
        { id: 'c20l3', title: 'Эссэ бичих', durationSec: 720 },
        { id: 'c20l4', title: 'Ярианы хэсэг', durationSec: 540 },
      ] },
    ],
  },
]

// Шинэ хичээлүүдийн видеог (YOUTUBE_IDS-д заагаагүй) demo киногоор ээлжлэн бөглөнө
const DEMO_CYCLE = Object.values(DEMO)
let demoIndex = 0
for (const c of courses) {
  for (const s of c.sections) {
    for (const l of s.lessons) YOUTUBE_IDS[l.id] ??= DEMO_CYCLE[demoIndex++ % DEMO_CYCLE.length]!
  }
}
