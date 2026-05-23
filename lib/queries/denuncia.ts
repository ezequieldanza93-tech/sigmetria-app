import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Denuncia, DenunciaFoto } from '@/lib/types'
import {
  updateEstadoDenuncia,
  subirFotosDenuncia,
  eliminarFotoDenuncia,
} from '@/lib/actions/denuncia'

export function useDenuncias() {
  return useQuery({
    queryKey: ['denuncias'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('denuncias')
        .select('*, empresas!inner(razon_social), establecimientos(nombre), profiles_responsable!responsable_asignado_id(full_name)')
        .order('created_at', { ascending: false })
      return (data ?? []) as unknown as Denuncia[]
    },
    staleTime: 1000 * 30,
  })
}

export function useDenuncia(id: string | undefined) {
  return useQuery({
    queryKey: ['denuncia', id],
    queryFn: async () => {
      if (!id) return null
      const supabase = createClient()
      const { data } = await supabase
        .from('denuncias')
        .select('*, empresas(razon_social), establecimientos(nombre), profiles_responsable!responsable_asignado_id(full_name), denuncias_fotos(*)')
        .eq('id', id)
        .single()
      return (data ?? null) as unknown as Denuncia | null
    },
    enabled: !!id,
    staleTime: 1000 * 30,
  })
}

export function useFotosDenuncia(denunciaId: string | undefined) {
  return useQuery({
    queryKey: ['denuncia-fotos', denunciaId],
    queryFn: async () => {
      if (!denunciaId) return []
      const supabase = createClient()
      const { data } = await supabase
        .from('denuncias_fotos')
        .select('*')
        .eq('denuncia_id', denunciaId)
        .order('created_at', { ascending: false })
      return (data ?? []) as unknown as DenunciaFoto[]
    },
    enabled: !!denunciaId,
    staleTime: 1000 * 30,
  })
}

export function useUpdateEstadoDenuncia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ denunciaId, formData }: { denunciaId: string; formData: FormData }) => {
      const result = await updateEstadoDenuncia(denunciaId, null, formData)
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['denuncias'] })
      queryClient.invalidateQueries({ queryKey: ['denuncia'] })
    },
  })
}

export function useSubirFotosDenuncia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ denunciaId, formData }: { denunciaId: string; formData: FormData }) => {
      const result = await subirFotosDenuncia(denunciaId, formData)
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['denuncia-fotos', variables.denunciaId] })
      queryClient.invalidateQueries({ queryKey: ['denuncia', variables.denunciaId] })
    },
  })
}

export function useEliminarFotoDenuncia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fotoId: string) => {
      const result = await eliminarFotoDenuncia(fotoId, null, new FormData())
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['denuncia-fotos'] })
      queryClient.invalidateQueries({ queryKey: ['denuncia'] })
    },
  })
}
