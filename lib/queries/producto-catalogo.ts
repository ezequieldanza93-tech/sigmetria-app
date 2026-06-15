import { useQuery } from '@tanstack/react-query'
import { getCatalogoArbol } from '@/lib/actions/producto-catalogo'

// Árbol del catálogo de protecciones: clase → categoría → componente.
// Sirve para los filtros en cascada (elegís clase → se filtran categorías → componentes).
export const catalogoArbolKey = ['catalogo-arbol'] as const

export function useCatalogoArbol() {
  return useQuery({
    queryKey: catalogoArbolKey,
    queryFn: async () => {
      const res = await getCatalogoArbol()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}
