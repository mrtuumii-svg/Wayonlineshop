/**
 * Хичээлийн нүүр зураг (slug → URL). Unsplash-ийн үнэгүй лицензтэй гэрэл зургууд —
 * сэдэв бүрт тааруулж сонгосон, линк бүрийг 2026-10-30-нд шалгасан.
 * Unsplash нь зургаа өөрийн CDN-ээс шууд ашиглахыг (hotlink) зөвшөөрдөг.
 */
const unsplash = (id: string) => `https://images.unsplash.com/${id}?w=640&h=360&fit=crop&auto=format&q=80`

export const COURSE_IMAGES: Record<string, string> = {
  'react-ekhlel': unsplash('photo-1633356122544-f134324a6cee'),
  'figma-undsen': unsplash('photo-1558655146-9f40138edfeb'),
  'typescript-gunzgii': unsplash('photo-1461749280684-dccba630e2f6'),
  'node-backend': unsplash('photo-1587620962725-abab7fe55159'),
  'ux-sudalgaa': unsplash('photo-1586717791821-3f44a563fa4c'),
  'digital-marketing': unsplash('photo-1460925895917-afdab827c52f'),
  'content-marketing': unsplash('photo-1432888498266-38ffec3eaf0a'),
  'angli-yariltsah': unsplash('photo-1546410531-bb4caa6b424d'),
  'python-ekhlel': unsplash('photo-1526379095098-d400fd0bf935'),
  'javascript-suuri': unsplash('photo-1555066931-4365d14bab8c'),
  'sql-ugugdliin-san': unsplash('photo-1544383835-bda2bc66a55d'),
  'git-github': unsplash('photo-1556075798-4825dfaaf498'),
  'ugugdliin-shinjilgee': unsplash('photo-1551288049-bebda4e38f71'),
  'mashin-surgalt': unsplash('photo-1677442136019-21780ecad995'),
  'linux-komand': unsplash('photo-1629654297299-c8506221ca97'),
  'docker-devops': unsplash('photo-1605745341112-85968b19335b'),
  'brend-logo-dizain': unsplash('photo-1626785774573-4b799315345d'),
  'ungu-typography': unsplash('photo-1561070791-2526d30994b5'),
  'social-media-marketing': unsplash('photo-1516321318423-f06f85e504b3'),
  'ielts-beltgel': unsplash('photo-1434030216411-0b793f4b4173'),
}

/** Зураг тодорхойлоогүй хичээлд (жишээ нь админ шинээр нэмсэн) — slug-аас тогтмол санамсаргүй зураг */
export const courseImage = (slug: string): string => COURSE_IMAGES[slug] ?? `https://picsum.photos/seed/${slug}/640/360`
