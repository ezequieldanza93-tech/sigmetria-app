import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getDocumentosTiposConfig,
  getTiposEstablecimiento,
  updateDocumentoTipoConfig,
  setAplicabilidadTiposEstablecimiento,
  type UpdateDocumentoTipoConfigInput,
} from '@/lib/actions/documentos-catalogo'
import type { TipoEstablecimientoItem } from '@/lib/types'

// ─── Queries ────────────────────────────────────────────────

export function useDocumentosTiposConfig() {
  return useQuery({
    queryKey: ['documentos-tipos-config'],
    queryFn: async () => {
      const result = await getDocumentosTiposConfig()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useTiposEstablecimiento() {
  return useQuery<TipoEstablecimientoItem[]>({
    queryKey: ['tipos-establecimiento'],
    queryFn: async () => {
      const result = await getTiposEstablecimiento()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 1000 * 60 * 30, // catálogo muy estable
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useUpdateDocumentoTipoConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: UpdateDocumentoTipoConfigInput
    }) => {
      const result = await updateDocumentoTipoConfig(id, updates)
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos-tipos-config'] })
    },
  })
}

export function useSetAplicabilidadTiposEstablecimiento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      documentoTipoId,
      tipoIds,
    }: {
      documentoTipoId: string
      tipoIds: string[]
    }) => {
      const result = await setAplicabilidadTiposEstablecimiento(documentoTipoId, tipoIds)
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos-tipos-config'] })
    },
  })
}
