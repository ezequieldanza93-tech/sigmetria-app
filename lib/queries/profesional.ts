import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { PerfilProfesional, MatriculaProfesional, Provincia } from '@/lib/types'

export function usePerfil(userId: string | undefined) {
  return useQuery({
    queryKey: ['perfil', userId],
    queryFn: async () => {
      if (!userId) return null
      const supabase = createClient()
      const { data } = await supabase
        .from('perfiles_profesionales')
        .select('id, user_id, telefono, fecha_nacimiento, provincia_residencia_id, provincia_matricula_id, tipo_identidad_impositiva, cuit, canal_captacion')
        .eq('user_id', userId)
        .maybeSingle()
      return data as PerfilProfesional | null
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useProvincias() {
  return useQuery({
    queryKey: ['provincias'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('provincias')
        .select('id, nombre')
        .order('nombre')
      return (data ?? []) as Provincia[]
    },
    staleTime: 1000 * 60 * 30,
  })
}

export function useMatriculas(perfilId: string | null | undefined) {
  return useQuery({
    queryKey: ['matriculas', perfilId],
    queryFn: async () => {
      if (!perfilId) return []
      const supabase = createClient()
      const { data } = await supabase
        .from('matriculas_profesionales')
        .select('id, perfil_id, activa, emisor, numero, fecha_emision, fecha_vencimiento, foto_frente_url, foto_dorso_url')
        .eq('perfil_id', perfilId)
        .order('created_at', { ascending: false })
      return (data ?? []) as MatriculaProfesional[]
    },
    enabled: !!perfilId,
    staleTime: 1000 * 60 * 5,
  })
}
