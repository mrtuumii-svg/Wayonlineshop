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
]
