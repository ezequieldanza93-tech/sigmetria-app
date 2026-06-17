import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getDocumentosTiposConfig,
  getTiposEstablecimiento,
  updateDocumentoTipoConfig,
  setAplicabilidadTiposEstablecimiento,
  getPreguntasRiesgo,
  getNormas,
  type UpdateDocumentoTipoConfigInput,
} from '@/lib/actions/documentos-catalogo'
import type { TipoEstablecimientoItem, PreguntaRiesgoItem, NormaItem } from '@/lib/types'

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

export function usePreguntasRiesgo() {
  return useQuery<PreguntaRiesgoItem[]>({
    queryKey: ['preguntas-riesgo'],
    queryFn: async () => {
      const result = await getPreguntasRiesgo()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 1000 * 60 * 30,
  })
}

export function useNormas() {
  return useQuery<NormaItem[]>({
    queryKey: ['normas-catalogo'],
    queryFn: async () => {
      const result = await getNormas()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 1000 * 60 * 30,
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
