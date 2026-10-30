import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { OrderStatus } from '@/api/types'
import { ErrorState } from '@/components/states'
import { useAdminApi } from '@/features/admin/queries'
import { PageHeader, StatusBadge, TableFrame } from '@/features/admin/ui'
import { statusLabel, td, th } from '@/features/admin/styles'
import { formatPrice } from '@/lib/format'

const filters: { value: OrderStatus | undefined; label: string }[] = [
  { value: undefined, label: 'Бүгд' },
  ...(Object.keys(statusLabel) as OrderStatus[]).map((s) => ({ value: s, label: statusLabel[s] })),
]

export function OrdersPage() {
  const admin = useAdminApi()
  const [status, setStatus] = useState<OrderStatus | undefined>()
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', status],
    queryFn: () => admin.getOrders(status),
  })

  return (
    <section>
      <PageHeader title="Захиалгууд" />
      <div role="group" aria-label="Төлөвөөр шүүх" className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              status === f.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isPending ? (
        <p className="text-slate-500">Ачаалж байна…</p>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <p className="text-slate-500">Захиалга алга</p>
      ) : (
        <TableFrame>
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Огноо</th>
              <th className={th}>Хэрэглэгч</th>
              <th className={th}>Хичээлүүд</th>
              <th className={th}>Төлөв</th>
              <th className={`${th} text-right`}>Дүн</th>
            </tr>
          </thead>
          <tbody>
            {data.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className={`${td} whitespace-nowrap tabular-nums`}>{o.createdAt.slice(0, 16).replace('T', ' ')}</td>
                <td className={td}>
                  {o.user.name}
                  <p className="text-xs text-slate-500">{o.user.email}</p>
                </td>
                <td className={td}>
                  {o.items.map((i) => (
                    <p key={i.title}>
                      {i.title} <span className="text-slate-400">· {formatPrice(i.price)}</span>
                    </p>
                  ))}
                </td>
                <td className={td}>
                  <StatusBadge status={o.status} />
                </td>
                <td className={`${td} text-right whitespace-nowrap tabular-nums`}>{formatPrice(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
    </section>
  )
}
