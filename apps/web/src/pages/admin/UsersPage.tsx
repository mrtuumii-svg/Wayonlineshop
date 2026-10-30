import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { isApiError } from '@/api/errors'
import type { Role } from '@/api/types'
import { ErrorState } from '@/components/states'
import { useAdminApi } from '@/features/admin/queries'
import { Alert, PageHeader, TableFrame } from '@/features/admin/ui'
import { td, th } from '@/features/admin/styles'
import { useAuthStore } from '@/features/auth/authStore'

export function UsersPage() {
  const admin = useAdminApi()
  const qc = useQueryClient()
  const myId = useAuthStore((s) => s.user?.id)
  const [error, setError] = useState<string | null>(null)
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['admin', 'users'], queryFn: () => admin.getUsers() })
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => admin.setUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
    onError: (err) => setError(isApiError(err) ? err.message : 'Өөрчилж чадсангүй'),
  })

  return (
    <section>
      <PageHeader title="Хэрэглэгчид" />
      {error && <Alert>{error}</Alert>}
      {isPending ? (
        <p className="text-slate-500">Ачаалж байна…</p>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <TableFrame>
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Нэр</th>
              <th className={th}>Имэйл</th>
              <th className={th}>Бүртгүүлсэн</th>
              <th className={th}>Эрх</th>
              <th className={`${th} text-right`}>Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {data.map((u) => {
              const isMe = u.id === myId
              const next: Role = u.role === 'admin' ? 'user' : 'admin'
              return (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className={td}>
                    {u.name}
                    {isMe && <span className="ml-2 text-xs text-slate-400">(та)</span>}
                  </td>
                  <td className={td}>{u.email}</td>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{u.createdAt.slice(0, 10)}</td>
                  <td className={td}>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        u.role === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {u.role === 'admin' ? 'Админ' : 'Хэрэглэгч'}
                    </span>
                  </td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {/* Өөрийгөө админаас хасахыг backend ч хориглодог (409) */}
                    {!isMe && (
                      <button
                        type="button"
                        disabled={setRole.isPending}
                        onClick={() => {
                          setError(null)
                          setRole.mutate({ id: u.id, role: next })
                        }}
                        className="rounded-lg px-2 py-1 text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                      >
                        {next === 'admin' ? 'Админ болгох' : 'Админаас хасах'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableFrame>
      )}
    </section>
  )
}
