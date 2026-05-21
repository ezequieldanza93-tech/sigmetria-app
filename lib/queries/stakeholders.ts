import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function usePersonasTipos() {
  return useQuery({
    queryKey: ['personas-tipos'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('personas_tipos').select('id, nombre').order('nombre')
      return (data ?? []) as { id: string; nombre: string }[]
    },
    staleTime: 1000 * 60 * 30,
  })
}

export function useOrganizacionesTipos() {
  return useQuery({
    queryKey: ['organizaciones-tipos'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('organizaciones_tipos').select('id, nombre').order('nombre')
      return (data ?? []) as { id: string; nombre: string }[]
    },
    staleTime: 1000 * 60 * 30,
  })
}
