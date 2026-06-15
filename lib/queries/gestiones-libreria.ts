import { useQuery } from '@tanstack/react-query'
import { getLibreriaGestiones } from '@/lib/actions/gestiones-libreria'

export const libreriaGestionesKey = ['libreria-gestiones'] as const

export function useLibreriaGestiones() {
  return useQuery({
    queryKey: libreriaGestionesKey,
    queryFn: async () => {
      const res = await getLibreriaGestiones()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}
