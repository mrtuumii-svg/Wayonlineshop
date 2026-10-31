/** Админы хуудсуудын нийтлэг загвар, шошго (компонент биш тул тусдаа файлд — Fast Refresh) */

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none aria-[invalid=true]:border-red-400'

export const th = 'px-4 py-3 text-left font-medium whitespace-nowrap text-slate-500'

export const td = 'px-4 py-3 align-middle'

export const statusLabel = { pending: 'Хүлээгдэж буй', paid: 'Төлөгдсөн', failed: 'Амжилтгүй' } as const
