import { NavLink, Outlet } from 'react-router'
import { useApi } from '@/api/ApiProvider'
import { EmptyState } from '@/components/states'

const links = [
  { to: '/admin', label: 'Самбар', end: true },
  { to: '/admin/courses', label: 'Хичээлүүд' },
  { to: '/admin/orders', label: 'Захиалгууд' },
  { to: '/admin/users', label: 'Хэрэглэгчид' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

/** Админ хэсгийн хүрээ: зүүн талд цэс (утсан дээр дээд талд), баруун талд хуудас */
export function AdminLayout() {
  const api = useApi()

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <aside className="md:w-48 md:shrink-0">
        <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Удирдлага</p>
        <nav aria-label="Админ цэс" className="flex gap-1 overflow-x-auto md:flex-col">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        {api.admin ? (
          <Outlet />
        ) : (
          <EmptyState message="Админ хэсэг зөвхөн бодит backend-тэй (VITE_API_MODE=http) ажиллана" />
        )}
      </div>
    </div>
  )
}
