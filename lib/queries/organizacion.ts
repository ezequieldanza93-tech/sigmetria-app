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

      // Librería híbrida: ART base de Sigmetría (consultora_id IS NULL) +
      // ART propias de la consultora del usuario actual (consultora_id = X).
      const { data: { user } } = await supabase.auth.getUser()
      let consultoraId: string | null = null
      if (user) {
        const { data: membership } = await supabase
          .from('consultoras_members')
          .select('consultora_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()
        consultoraId = (membership?.consultora_id as string | undefined) ?? null
      }

      const { data } = await supabase
        .from('organizaciones_externas')
        .select('id, nombre, organizaciones_tipos!inner(nombre)')
        .eq('organizaciones_tipos.nombre', 'ART')
        .eq('is_active', true)
        .or(consultoraId ? `consultora_id.is.null,consultora_id.eq.${consultoraId}` : 'consultora_id.is.null')
        .order('nombre')
      return (data ?? []) as unknown as { id: string; nombre: string }[]
    },
    staleTime: 1000 * 30,
    enabled,
  })
}
