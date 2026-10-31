import type { ReactNode } from 'react'
import { statusLabel } from './styles'

/** Админы хуудсуудын нийтлэг жижиг хэсгүүд */

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {action}
    </div>
  )
}

export function Field({ id, label, error, children }: { id: string; label: string; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  )
}

/** Хүснэгтийг утсан дээр хажуу тийш гүйлгэдэг хүрээ */
export function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

const statusColor = {
  pending: 'bg-amber-50 text-amber-800',
  paid: 'bg-emerald-50 text-emerald-800',
  failed: 'bg-slate-100 text-slate-600',
} as const

export function StatusBadge({ status }: { status: keyof typeof statusLabel }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[status]}`}>{statusLabel[status]}</span>
}
