import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { DirectorioPersona, Organizacion } from '@/lib/types'

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

export function useStakeholderPersonas(establecimientoId?: string) {
  return useQuery({
    queryKey: ['stakeholder-personas', establecimientoId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('personas_establecimientos')
        .select('personas_directorio(id, nombre, apellido, dni, fecha_nacimiento, fecha_ingreso, legajo, telefono, email, tipo_id, personas_tipos(nombre), organizacion_id, notas, is_active)')
        .eq('establecimiento_id', establecimientoId)
      return ((data ?? []) as unknown as { personas_directorio: DirectorioPersona }[])
        .map(r => r.personas_directorio)
        .filter(Boolean) as DirectorioPersona[]
    },
    enabled: !!establecimientoId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useStakeholderOrganizaciones(establecimientoId?: string) {
  return useQuery({
    queryKey: ['stakeholder-organizaciones', establecimientoId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('organizaciones_establecimientos')
        .select('organizaciones(id, nombre, email, telefono, notas, is_active, organizaciones_tipos(nombre))')
        .eq('establecimiento_id', establecimientoId)
      const list = ((data ?? []) as unknown as { organizaciones: Organizacion }[])
        .map(r => r.organizaciones)
        .filter(o => o?.is_active)
      return list as Organizacion[]
    },
    enabled: !!establecimientoId,
    staleTime: 1000 * 60 * 5,
  })
}
