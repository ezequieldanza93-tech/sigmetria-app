import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { TipoOrganizacion, SubcontratistaRubro } from '@/lib/types'

export { useLocalidades, useEstablecimientoTipos } from './establecimiento-form'

export function useOrganizacionTipos(enabled = true) {
  return useQuery({
    queryKey: ['organizaciones-tipos'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('organizaciones_tipos')
        .select('*')
        .order('nombre')
      return (data ?? []) as unknown as TipoOrganizacion[]
    },
    staleTime: 1000 * 60 * 5,
    enabled,
  })
}

export function useSubcontratistaRubros(enabled = true) {
  return useQuery({
    queryKey: ['subcontratistas-rubros'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('subcontratistas_rubros')
        .select('*')
        .eq('is_active', true)
        .order('nombre')
      return (data ?? []) as unknown as SubcontratistaRubro[]
    },
    staleTime: 1000 * 60 * 30,
    enabled,
  })
}

export function useArtOrgs(enabled = true) {
  return useQuery({
    queryKey: ['art-orgs'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('organizaciones_externas')
        .select('id, nombre, organizaciones_tipos!inner(nombre)')
        .eq('organizaciones_tipos.nombre', 'ART')
        .eq('is_active', true)
        .eq('scope', 'global')
        .order('nombre')
      return (data ?? []) as unknown as { id: string; nombre: string }[]
    },
    staleTime: 1000 * 30,
    enabled,
  })
}
