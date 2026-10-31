import { ErrorState } from '@/components/states'
import { useSalesReport } from '@/features/admin/queries'
import { formatPrice } from '@/lib/format'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
    </div>
  )
}

export function DashboardPage() {
  const { data, isPending, isError, refetch } = useSalesReport()

  return (
    <section>
      <h1 className="mb-4 text-2xl font-extrabold">Самбар</h1>
      {isPending ? (
        <p aria-busy="true" className="text-slate-500">
          Ачаалж байна…
        </p>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Нийт орлого" value={formatPrice(data.revenue)} />
            <Stat label="Төлөгдсөн захиалга" value={String(data.orders.paid ?? 0)} />
            <Stat label="Хүлээгдэж буй" value={String(data.orders.pending ?? 0)} />
            <Stat label="Амжилтгүй" value={String(data.orders.failed ?? 0)} />
          </div>

          <h2 className="mt-8 mb-3 text-lg font-bold">Хамгийн их борлуулалттай хичээлүүд</h2>
          {data.topCourses.length === 0 ? (
            <p className="text-slate-500">Борлуулалт хараахан алга</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Хичээл</th>
                    <th className="px-4 py-3 text-right font-medium">Зарагдсан</th>
                    <th className="px-4 py-3 text-right font-medium">Орлого</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCourses.map((c) => (
                    <tr key={c.courseId} className="border-t border-slate-100">
                      <td className="px-4 py-3">{c.title}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.sold}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPrice(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
