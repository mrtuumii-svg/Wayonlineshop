import { DEMO_REVIEWS } from './demoReviewData'

const stars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating)

export function DemoReviews({ courseId }: { courseId: string }) {
  const reviews = DEMO_REVIEWS[courseId] ?? []
  if (reviews.length === 0) return null
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">Сэтгэгдэл</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Demo сэтгэгдэл</span>
        <span className="text-sm text-slate-600">
          <span className="text-amber-500" aria-hidden="true">★</span> {average.toFixed(1)} · {reviews.length} сэтгэгдэл
        </span>
      </div>
      <ul className="space-y-3">
        {reviews.map((r) => (
          <li key={r.author} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{r.author}</span>
              <span className="text-amber-500" aria-label={`${r.rating} од`}>{stars(r.rating)}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{r.text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
