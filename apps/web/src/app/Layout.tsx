import { Outlet } from 'react-router'
import { Header } from '@/components/Header'
import { Logo } from '@/components/Logo'
import { ChatWidget } from '@/features/chat/ChatWidget'

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="mt-12 bg-brand-950 text-brand-100">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div className="space-y-3">
            <div className="inline-block rounded-xl bg-white px-3 py-2">
              <Logo alwaysShowName />
            </div>
            <p className="text-sm text-brand-200">Ур чадвараа өөрийн хэмнэлээр хөгжүүл.</p>
          </div>
          <div className="space-y-2 text-sm">
            <h2 className="font-semibold text-white">Яагаад Way Academy</h2>
            <p>Туршлагатай багш нар</p>
            <p>Хүссэн цагтаа үзэх видео хичээл</p>
            <p>QPay-ээр хялбар төлбөр</p>
          </div>
          <div className="space-y-2 text-sm">
            <h2 className="font-semibold text-white">Холбоо барих</h2>
            <a href="tel:88777988" className="block hover:text-white">
              88777988
            </a>
            <a href="mailto:mr.tuumii@gmail.com" className="block hover:text-white">
              mr.tuumii@gmail.com
            </a>
          </div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs text-brand-300">
          © {new Date().getFullYear()} Way Academy
        </p>
      </footer>
      <ChatWidget />
    </div>
  )
}
