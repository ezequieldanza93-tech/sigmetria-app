import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Firma, FirmaEntidadTipo } from '@/lib/types'
import { firmarGestion } from '@/lib/actions/firmar-gestion'
import { firmarRegistroTrabajador, type FirmarTrabajadorInput } from '@/lib/actions/firmar-registro-trabajador'

export function useFirmasEntidad(
  entidadTipo: FirmaEntidadTipo | undefined,
  entidadId: string | undefined
) {
  return useQuery({
    queryKey: ['firmas', entidadTipo, entidadId],
    queryFn: async () => {
      if (!entidadTipo || !entidadId) return []
      const supabase = createClient()
      const { data } = await supabase
        .from('firmas')
        .select('*, profiles!firmante_usuario_id(full_name), asistentes:profiles!asistente_id(full_name), personas_directorio(nombre, apellido)')
        .eq('entidad_tipo', entidadTipo)
        .eq('entidad_id', entidadId)
        .order('created_at', { ascending: true })

      return (data ?? []) as unknown as Firma[]
    },
    enabled: !!entidadTipo && !!entidadId,
    staleTime: 1000 * 30,
  })
}

export function useFirmarGestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (gestionEstablecimientoId: string) => {
      const result = await firmarGestion(gestionEstablecimientoId)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firmas'] })
      queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento'] })
      queryClient.invalidateQueries({ queryKey: ['registros-gestion'] })
    },
  })
}

export function useFirmarRegistroTrabajador() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: FirmarTrabajadorInput) => {
      const result = await firmarRegistroTrabajador(input)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firmas'] })
    },
  })
}

export function useEntidadesPendientesFirma(establecimientoId: string | undefined) {
  return useQuery({
    queryKey: ['entidades-pendientes-firma', establecimientoId],
    queryFn: async () => {
      if (!establecimientoId) return { gestiones: [] as { id: string; nombre: string }[] }
      const supabase = createClient()

      // Gestiones del establecimiento que NO están firmadas
      const { data: ges } = await supabase
        .from('gestiones_establecimientos')
        .select('id, gestiones!inner(nombre)')
        .eq('establecimiento_id', establecimientoId)
        .eq('firmada', false)

      const gestiones = ((ges ?? []) as unknown as { id: string; gestiones: { nombre: string } }[])
        .map(g => ({ id: g.id, nombre: g.gestiones.nombre }))

      // Capacitaciones del establecimiento que NO están firmadas
      const { data: caps } = await supabase
        .from('capacitaciones')
        .select('id, titulo')
        .eq('establecimiento_id', establecimientoId)
        .eq('firmada', false)

      const capacitaciones = ((caps ?? []) as { id: string; titulo: string }[])
        .map(c => ({ id: c.id, nombre: c.titulo }))

      return { gestiones, capacitaciones }
    },
    enabled: !!establecimientoId,
    staleTime: 1000 * 30,
  })
}

export function useEntidadFirmada(
  entidadTipo: FirmaEntidadTipo | undefined,
  entidadId: string | undefined
) {
  return useQuery({
    queryKey: ['entidad-firmada', entidadTipo, entidadId],
    queryFn: async () => {
      if (!entidadTipo || !entidadId) return false
      if (entidadTipo === 'gestion') {
        const supabase = createClient()
        const { data } = await supabase
          .from('gestiones_establecimientos')
          .select('firmada')
          .eq('id', entidadId)
          .maybeSingle()
        return (data as { firmada: boolean } | null)?.firmada ?? false
      }
      if (entidadTipo === 'capacitacion') {
        const supabase = createClient()
        const { data } = await supabase
          .from('capacitaciones')
          .select('firmada')
          .eq('id', entidadId)
          .maybeSingle()
        return (data as { firmada: boolean } | null)?.firmada ?? false
      }
      return false
    },
    enabled: !!entidadTipo && !!entidadId,
    staleTime: 1000 * 30,
  })
}
