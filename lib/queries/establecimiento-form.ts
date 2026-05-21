import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Localidad, TiposEstablecimiento } from '@/lib/types'

export function useLocalidades(enabled = true) {
  return useQuery({
    queryKey: ['localidades'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('localidades')
        .select('id, nombre, provincia, is_active, created_at')
        .eq('is_active', true)
        .order('nombre')
      return (data ?? []) as unknown as Localidad[]
    },
    staleTime: 1000 * 60 * 5,
    enabled,
  })
}

export function useEstablecimientoTipos(enabled = true) {
  return useQuery({
    queryKey: ['establecimientos-tipos'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('establecimientos_tipos')
        .select('id, codigo, nombre, created_at')
        .order('nombre')
      return (data ?? []) as unknown as TiposEstablecimiento[]
    },
    staleTime: 1000 * 60 * 30,
    enabled,
  })
}
