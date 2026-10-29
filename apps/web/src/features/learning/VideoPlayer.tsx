import { useEffect, useRef } from 'react'
import { loadYouTubeApi } from './youtubeApi'

/** YouTube-ийн видео ID нь яг 11 тэмдэгт. Бусад утгаар URL угсрахгүй. */
const YOUTUBE_ID = /^[\w-]{11}$/

function embedUrl(youtubeId: string): string {
  const params = new URLSearchParams({
    // IFrame API-аар "дууссан" event авах
    enablejsapi: '1',
    // Төгсгөлд зөвхөн тэр каналын видеог санал болгоно
    rel: '0',
    // iOS дээр бүтэн дэлгэц рүү албадан шилжихгүй
    playsinline: '1',
    origin: window.location.origin,
  })
  // nocookie домэйн — тоглуулахаас өмнө tracking cookie тавихгүй
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`
}

/**
 * Видео тоглуулагчийг энд тусгаарлав — өөр провайдер (Bunny, R2 г.м.) руу шилжихэд зөвхөн энэ файл өөрчлөгдөнө.
 * `onEnded` өгвөл YouTube IFrame API-г ачаалж видео дуусахыг барина; өгөөгүй бол (урьдчилан үзэх) ачаалахгүй.
 */
export function VideoPlayer({ youtubeId, title, onEnded }: { youtubeId: string; title: string; onEnded?: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Хамгийн сүүлийн callback-ийг дуудна — rerender бүрт player-ийг дахин үүсгэхгүй
  const onEndedRef = useRef(onEnded)
  useEffect(() => {
    onEndedRef.current = onEnded
  })
  const wantsEnded = onEnded !== undefined
  const valid = YOUTUBE_ID.test(youtubeId)

  useEffect(() => {
    if (!valid || !wantsEnded) return
    let player: { destroy(): void } | null = null
    let cancelled = false

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !iframeRef.current) return
        player = new YT.Player(iframeRef.current, {
          events: {
            onStateChange: (e) => {
              if (!cancelled && e.data === YT.PlayerState.ENDED) onEndedRef.current?.()
            },
          },
        })
      })
      // API ачаалагдахгүй бол видео тоглосоор байна, зөвхөн автомат тэмдэглэгээ ажиллахгүй —
      // "Дууссан гэж тэмдэглэх" товч хэвээр бий
      .catch(() => {})

    return () => {
      cancelled = true
      player?.destroy()
    }
  }, [youtubeId, valid, wantsEnded])

  if (!valid) return null

  return (
    <iframe
      key={youtubeId}
      ref={iframeRef}
      src={embedUrl(youtubeId)}
      title={title}
      aria-label={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      className="aspect-video w-full rounded-xl bg-black"
    />
  )
}
