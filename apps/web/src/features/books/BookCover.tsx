import { useState } from 'react'
import type { BookSummary } from '@/api/types'
import { coverPalette, coverSrc, longestWord } from './cover'

/**
 * Номын нүүр (2:3). Доор нь гарчиг, зохиогчоор загварчилсан нүүр үргэлж байна —
 * жинхэнэ зураг ачаалагдтал (удаан сервер), эсвэл огт байхгүй/эвдэрсэн үед тэр харагдана.
 * Хоосон цагаан дөрвөлжин хэзээ ч гарахгүй. Хэмжээг aspect-ratio-оор урьдчилан нөөцөлдөг тул хуудас үсрэхгүй.
 */
export function BookCover({ book, size = 'card' }: { book: Pick<BookSummary, 'id' | 'title' | 'author' | 'category' | 'coverUrl'>; size?: 'card' | 'large' }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const src = book.coverUrl && !failed ? coverSrc(book.coverUrl, size) : null

  return (
    // container-type: дотоод үсгийн хэмжээ (cqw) картын өргөнтэй хамт өсөж буурна
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-slate-100 shadow-md ring-1 ring-black/5 [container-type:inline-size]">
      <GeneratedCover book={book} hidden={loaded} />
      {src && (
        <img
          src={src}
          alt={`${book.title} номын нүүр`}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          // contain: нүүрийн харьцаа 2:3-аас өөр байсан ч тайрахгүй, бүтнээр нь харуулна
          className={`absolute inset-0 h-full w-full bg-white object-contain transition-opacity duration-300 motion-reduce:transition-none ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  )
}

/** `hidden`: жинхэнэ нүүр ачаалагдсан — дэлгэц уншигчид нүүрийг 2 удаа уншуулахгүй */
function GeneratedCover({ book, hidden }: { book: Pick<BookSummary, 'id' | 'title' | 'author' | 'category'>; hidden: boolean }) {
  const { from, to } = coverPalette(book.category, book.id)
  return (
    <div
      {...(hidden ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `${book.title} номын нүүр` })}
      className="flex h-full w-full flex-col justify-between p-[8%] text-white"
      style={{ backgroundImage: `linear-gradient(160deg, ${from}, ${to})`, fontSize: '10cqw' }}
    >
      <span className="text-[0.6em] font-semibold tracking-widest uppercase opacity-80" aria-hidden="true">
        {book.category}
      </span>
      <div aria-hidden="true">
        <div className="mb-[6%] h-0.5 w-1/4 bg-white/70" />
        {/* "Entrepreneurship" шиг урт үгтэй гарчгийг жижиг бичнэ — үгийн дунд тасрахгүй */}
        <p
          className="line-clamp-5 leading-tight font-extrabold [overflow-wrap:anywhere] [text-wrap:balance]"
          style={{ fontSize: longestWord(book.title) > 12 ? '0.8em' : '1.05em' }}
        >
          {book.title}
        </p>
      </div>
      <p className="line-clamp-2 text-[0.7em] font-medium opacity-90" aria-hidden="true">
        {book.author}
      </p>
    </div>
  )
}
