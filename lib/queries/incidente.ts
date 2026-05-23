import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Incidente, IncidenteFoto } from '@/lib/types'
import {
  updateEstadoIncidente,
  subirFotosIncidente,
  eliminarFotoIncidente,
} from '@/lib/actions/incidente'

export function useIncidentes() {
  return useQuery({
    queryKey: ['incidentes'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('incidentes')
        .select('*, empresas!inner(razon_social), establecimientos(nombre), profiles_responsable!responsable_asignado_id(full_name)')
        .order('created_at', { ascending: false })
      return (data ?? []) as unknown as Incidente[]
    },
    staleTime: 1000 * 30,
  })
}

export function useIncidente(id: string | undefined) {
  return useQuery({
    queryKey: ['incidente', id],
    queryFn: async () => {
      if (!id) return null
      const supabase = createClient()
      const { data } = await supabase
        .from('incidentes')
        .select('*, empresas(razon_social), establecimientos(nombre), profiles_responsable!responsable_asignado_id(full_name), incidentes_fotos(*)')
        .eq('id', id)
        .single()
      return (data ?? null) as unknown as Incidente | null
    },
    enabled: !!id,
    staleTime: 1000 * 30,
  })
}

export function useFotosIncidente(incidenteId: string | undefined) {
  return useQuery({
    queryKey: ['incidente-fotos', incidenteId],
    queryFn: async () => {
      if (!incidenteId) return []
      const supabase = createClient()
      const { data } = await supabase
        .from('incidentes_fotos')
        .select('*')
        .eq('incidente_id', incidenteId)
        .order('created_at', { ascending: false })
      return (data ?? []) as unknown as IncidenteFoto[]
    },
    enabled: !!incidenteId,
    staleTime: 1000 * 30,
  })
}

export function useUpdateEstadoIncidente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ incidenteId, formData }: { incidenteId: string; formData: FormData }) => {
      const result = await updateEstadoIncidente(incidenteId, null, formData)
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidentes'] })
      queryClient.invalidateQueries({ queryKey: ['incidente'] })
    },
  })
}

export function useSubirFotosIncidente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ incidenteId, formData }: { incidenteId: string; formData: FormData }) => {
      const result = await subirFotosIncidente(incidenteId, formData)
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidente-fotos', variables.incidenteId] })
      queryClient.invalidateQueries({ queryKey: ['incidente', variables.incidenteId] })
    },
  })
}

export function useEliminarFotoIncidente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fotoId: string) => {
      const result = await eliminarFotoIncidente(fotoId, null, new FormData())
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidente-fotos'] })
      queryClient.invalidateQueries({ queryKey: ['incidente'] })
    },
  })
}
