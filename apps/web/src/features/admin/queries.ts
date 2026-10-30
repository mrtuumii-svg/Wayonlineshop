import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/api/ApiProvider'
import type { AdminApi } from '@/api/client'

/** AdminLayout нь `api.admin` байгаа үед л хуудсуудыг харуулдаг тул энд заавал байна */
export function useAdminApi(): AdminApi {
  const admin = useApi().admin
  if (!admin) throw new Error('Админ API алга (mock горим)')
  return admin
}

export function useSalesReport() {
  const admin = useAdminApi()
  return useQuery({ queryKey: ['admin', 'sales'], queryFn: () => admin.getSalesReport() })
}

/** Хичээл нэмэх, засах, устгасны дараа каталог ба тайлангийн cache-ийг хуучирсан гэж тэмдэглэнэ */
export function useInvalidateCatalog() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['courses'] }),
      qc.invalidateQueries({ queryKey: ['course'] }),
      qc.invalidateQueries({ queryKey: ['categories'] }),
      qc.invalidateQueries({ queryKey: ['admin'] }),
    ])
}

export function useDeleteCourse() {
  const admin = useAdminApi()
  const invalidate = useInvalidateCatalog()
  return useMutation({ mutationFn: (id: string) => admin.deleteCourse(id), onSuccess: invalidate })
}
