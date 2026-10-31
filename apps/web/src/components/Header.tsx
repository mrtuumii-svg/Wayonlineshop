import { Link, NavLink, useNavigate } from 'react-router'
import { useAuthStore } from '@/features/auth/authStore'
import { useCartStore } from '@/features/cart/cartStore'
import { Logo } from './Logo'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

export function Header() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const clear = useAuthStore((s) => s.clear)
  const cartCount = useCartStore((s) => s.courseIds.length)
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-4">
        <Link to="/" aria-label="Way Academy" className="mr-1 shrink-0 sm:mr-2">
          <Logo />
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          <NavLink to="/courses" className={(s) => `${navClass(s)} whitespace-nowrap`}>
            Хичээлүүд
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={(s) => `${navClass(s)} whitespace-nowrap`}>
              Удирдлага
            </NavLink>
          )}
          {user && (
            <NavLink to="/my-courses" className={(s) => `${navClass(s)} whitespace-nowrap`}>
              Миний хичээлүүд
            </NavLink>
          )}
        </nav>
        <Link
          to="/cart"
          aria-label="Сагс"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="20" r="1.3" />
            <circle cx="17" cy="20" r="1.3" />
          </svg>
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-bold ${
              cartCount > 0 ? 'bg-accent-400 text-brand-950' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {cartCount}
          </span>
        </Link>
        {user ? (
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            onClick={() => {
              clear()
              navigate('/')
            }}
          >
            Гарах
          </button>
        ) : (
          <Link
            to="/login"
            className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Нэвтрэх
          </Link>
        )}
      </div>
    </header>
  )
}
