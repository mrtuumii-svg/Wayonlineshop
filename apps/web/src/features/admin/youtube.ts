/** YouTube-ийн бүтэн хаягийг ч, 11 тэмдэгтийн ID-г ч хүлээж авна */
export function youtubeIdFrom(input: string): string | null {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/.exec(s)
  return m?.[1] ?? null
}
