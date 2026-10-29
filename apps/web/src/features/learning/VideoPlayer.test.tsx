import { render } from '@testing-library/react'
import { resetYouTubeApiForTests } from './youtubeApi'
import { VideoPlayer } from './VideoPlayer'

const API_SRC = 'https://www.youtube.com/iframe_api'
const ID = 'aqz-KE-bpKQ'

type PlayerOpts = { events: { onStateChange: (e: { data: number }) => void } }

/** YouTube IFrame API-ийн хуурамч хувилбар — гадаад script тестэд хэзээ ч татагдахгүй */
function installFakeYT() {
  const created: { el: HTMLElement; opts: PlayerOpts; destroy: ReturnType<typeof vi.fn> }[] = []
  const Player = vi.fn(function (this: unknown, el: HTMLElement, opts: PlayerOpts) {
    const destroy = vi.fn()
    created.push({ el, opts, destroy })
    return { destroy }
  })
  window.YT = { Player, PlayerState: { ENDED: 0 } } as unknown as typeof window.YT
  return created
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  resetYouTubeApiForTests()
  delete window.YT
  delete window.onYouTubeIframeAPIReady
  document.querySelectorAll(`script[src="${API_SRC}"]`).forEach((s) => s.remove())
})

test('youtube-nocookie iframe-ийг хичээлийн нэртэй рендерлэнэ', () => {
  render(<VideoPlayer youtubeId={ID} title="React гэж юу вэ?" />)

  const iframe = document.querySelector('iframe')!
  expect(iframe).toHaveAttribute('title', 'React гэж юу вэ?')
  expect(iframe).toHaveAttribute('aria-label', 'React гэж юу вэ?')
  const url = new URL(iframe.getAttribute('src')!)
  expect(url.origin + url.pathname).toBe(`https://www.youtube-nocookie.com/embed/${ID}`)
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    enablejsapi: '1',
    rel: '0',
    playsinline: '1',
    origin: window.location.origin,
  })
})

test.each(['', 'short', 'has space!!', '"><script>', 'x'.repeat(12)])('буруу youtubeId (%s) → тоглуулагч рендерлэгдэхгүй', (id) => {
  render(<VideoPlayer youtubeId={id} title="t" />)
  expect(document.querySelector('iframe')).toBeNull()
})

test('видео дуусахад (ENDED) onEnded дуудагдана, бусад төлөвт үгүй', async () => {
  const created = installFakeYT()
  const onEnded = vi.fn()
  render(<VideoPlayer youtubeId={ID} title="t" onEnded={onEnded} />)
  await flush()

  expect(created).toHaveLength(1)
  expect(created[0]!.el).toBe(document.querySelector('iframe'))
  created[0]!.opts.events.onStateChange({ data: 1 }) // PLAYING
  expect(onEnded).not.toHaveBeenCalled()
  created[0]!.opts.events.onStateChange({ data: 0 }) // ENDED
  expect(onEnded).toHaveBeenCalledTimes(1)
})

test('rerender-ээр солигдсон onEnded-ийг (хуучныг биш) дуудна', async () => {
  const created = installFakeYT()
  const first = vi.fn()
  const second = vi.fn()
  const { rerender } = render(<VideoPlayer youtubeId={ID} title="t" onEnded={first} />)
  await flush()
  rerender(<VideoPlayer youtubeId={ID} title="t" onEnded={second} />)

  created[0]!.opts.events.onStateChange({ data: 0 })
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledTimes(1)
})

test('API script-ийг хэдэн тоглуулагч байсан ч нэг л удаа ачаална', async () => {
  render(
    <>
      <VideoPlayer youtubeId={ID} title="a" onEnded={() => {}} />
      <VideoPlayer youtubeId="eRsGyueVLvQ" title="b" onEnded={() => {}} />
    </>,
  )
  expect(document.querySelectorAll(`script[src="${API_SRC}"]`)).toHaveLength(1)

  // Script ачаалагдсаныг дуурайна
  const created = installFakeYT()
  window.onYouTubeIframeAPIReady!()
  await flush()
  expect(created).toHaveLength(2)
})

test('өмнө нь тавигдсан onYouTubeIframeAPIReady-г дарж устгахгүй', async () => {
  const previous = vi.fn()
  window.onYouTubeIframeAPIReady = previous
  render(<VideoPlayer youtubeId={ID} title="a" onEnded={() => {}} />)

  installFakeYT()
  window.onYouTubeIframeAPIReady!()
  await flush()
  expect(previous).toHaveBeenCalledTimes(1)
})

test('unmount хийхэд player устгагдаж, дараа ирсэн ENDED юу ч хийхгүй', async () => {
  const created = installFakeYT()
  const onEnded = vi.fn()
  const { unmount } = render(<VideoPlayer youtubeId={ID} title="t" onEnded={onEnded} />)
  await flush()

  unmount()
  expect(created[0]!.destroy).toHaveBeenCalled()
  created[0]!.opts.events.onStateChange({ data: 0 })
  expect(onEnded).not.toHaveBeenCalled()
})

test('onEnded өгөөгүй бол API-г огт ачаалахгүй (урьдчилан үзэх)', () => {
  render(<VideoPlayer youtubeId={ID} title="t" />)
  expect(document.querySelector(`script[src="${API_SRC}"]`)).toBeNull()
})
