import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getActividadesCiiu,
  getActividadesDeDocumentoTipo,
  setActividadesDocumentoTipo,
  type ActividadCiiuItem,
} from '@/lib/actions/documentos-actividades'

// ─── Queries ────────────────────────────────────────────────

/** Catálogo CIIU completo (estable: se cachea 30 min). */
export function useActividadesCiiu() {
  return useQuery<ActividadCiiuItem[]>({
    queryKey: ['actividades-ciiu'],
    queryFn: async () => {
      const result = await getActividadesCiiu()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 1000 * 60 * 30,
  })
}

/** Actividades asignadas a un tipo de documento (vacío = todas). */
export function useActividadesDeDocumentoTipo(docTipoId: string, enabled = true) {
  return useQuery<string[]>({
    queryKey: ['documento-tipo-actividades', docTipoId],
    queryFn: async () => {
      const result = await getActividadesDeDocumentoTipo(docTipoId)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useSetActividadesDocumentoTipo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      docTipoId,
      actividadIds,
    }: {
      docTipoId: string
      actividadIds: string[]
    }) => {
      const result = await setActividadesDocumentoTipo(docTipoId, actividadIds)
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['documento-tipo-actividades', variables.docTipoId],
      })
    },
  })
}
