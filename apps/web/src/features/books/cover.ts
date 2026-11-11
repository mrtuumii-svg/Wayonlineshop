/** Номын нүүрний туслах функцууд (компонент биш тул тусдаа файлд — Fast Refresh) */

/**
 * Хэмжээнд тохирсон зураг: Open Library нь -S/-M/-L хэмжээтэй. Картанд дунд хэмжээ хангалттай —
 * том зургийг жижиг газарт татахгүй (ачаалал багасна).
 */
export function coverSrc(url: string, size: 'card' | 'large'): string {
  if (url.includes('covers.openlibrary.org')) return url.replace(/-[SML]\.jpg/, size === 'card' ? '-M.jpg' : '-L.jpg')
  return url
}

/** Гарчгийн хамгийн урт үгийн тэмдэгтийн тоо — загварчилсан нүүрийн үсгийн хэмжээг тохируулахад */
export const longestWord = (title: string): number => Math.max(0, ...title.split(/\s+/).map((w) => w.length))

const PALETTES: Record<string, [string, string][]> = {
  Програмчлал: [
    ['#1e3a8a', '#0f172a'],
    ['#0f766e', '#134e4a'],
    ['#4338ca', '#1e1b4b'],
  ],
  Дизайн: [
    ['#be185d', '#500724'],
    ['#7c3aed', '#2e1065'],
  ],
  Маркетинг: [
    ['#c2410c', '#431407'],
    ['#b45309', '#451a03'],
  ],
  'Англи хэл': [
    ['#047857', '#022c22'],
    ['#0369a1', '#082f49'],
  ],
}
const DEFAULT: [string, string][] = [['#334155', '#0f172a']]

/** Ангилал бүр өөрийн өнгөтэй; нэг ангилал дотор id-аас хамааран ээлжилнэ (тогтмол — refresh-д өөрчлөгдөхгүй) */
export function coverPalette(category: string, id: string): { from: string; to: string } {
  const list = PALETTES[category] ?? DEFAULT
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const [from, to] = list[hash % list.length]!
  return { from, to }
}
