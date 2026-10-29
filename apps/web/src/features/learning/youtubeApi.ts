/**
 * YouTube IFrame Player API-г нэг л удаа ачаалагч. Бидэнд зөвхөн "видео дууссан" event хэрэгтэй тул
 * хэрэглэдэг хэсгийн л төрлийг тодорхойлов (@types/youtube нэмэхгүй).
 */
export interface YTPlayer {
  destroy(): void
}

export interface YTNamespace {
  Player: new (
    el: HTMLIFrameElement,
    opts: { events: { onStateChange: (e: { data: number }) => void } },
  ) => YTPlayer
  PlayerState: { ENDED: number }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const API_SRC = 'https://www.youtube.com/iframe_api'

let pending: Promise<YTNamespace> | null = null

/** Script-ийг хуудас хооронд дахин татахгүй — бүх тоглуулагч нэг Promise-ийг хуваалцана */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  pending ??= new Promise<YTNamespace>((resolve, reject) => {
    // Өөр код (жишээ нь analytics) тавьсан callback-ийг дарж устгахгүй, гинжлэнэ
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = API_SRC
    script.async = true
    script.onerror = () => {
      // Дараагийн оролдлогод дахин ачаалах боломж үлдээнэ (сүлжээ түр тасарсан г.м.)
      pending = null
      script.remove()
      reject(new Error('YouTube API ачаалж чадсангүй'))
    }
    document.head.appendChild(script)
  })
  return pending
}

/** Зөвхөн тестэд: модулийн төлөвийг цэвэрлэнэ */
export function resetYouTubeApiForTests(): void {
  pending = null
}
