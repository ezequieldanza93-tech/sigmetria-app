import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'

export function useCanWrite(establecimientoId: string | undefined) {
  return useQuery({
    queryKey: ['can-write', establecimientoId],
    queryFn: async () => {
      if (!establecimientoId) return false
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const [{ data: membership }, { data: profile }] = await Promise.all([
        supabase.from('consultoras_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
        supabase.from('profiles').select('system_role').eq('id', user.id).single(),
      ])

      if (profile?.system_role === 'developer') return true
      const role = membership?.role as UserRole | undefined
      return role === 'full_access_main' || role === 'full_access_branch'
    },
    enabled: !!establecimientoId,
    staleTime: 1000 * 30,
  })
}

export function useGestionesEstablecimiento(establecimientoId: string | undefined, year: number) {
  return useQuery({
    queryKey: ['gestiones-establecimiento', establecimientoId, year],
    queryFn: async () => {
      if (!establecimientoId) return []
      const supabase = createClient()
      const yearStart = `${year}-01-01`
      const yearEnd = `${year + 1}-01-01`

      const { data } = await supabase
        .from('gestiones_establecimientos')
        .select('id, mostrar_lt, gestiones!inner(id, nombre, gestiones_categorias(nombre, gestiones_grupos(nombre)))')
        .eq('establecimiento_id', establecimientoId)
        .gte('created_at', yearStart)
        .lt('created_at', yearEnd)
        .order('created_at', { ascending: true })

      return (data ?? []) as {
        id: string
        mostrar_lt: boolean
        gestiones: {
          id: string
          nombre: string
          gestiones_categorias: { nombre: string; gestiones_grupos: { nombre: string } | null } | null
        }
      }[]
    },
    enabled: !!establecimientoId,
    staleTime: 1000 * 30,
  })
}

export function useRegistrosGestion(geIds: string[] | undefined, year: number) {
  return useQuery({
    queryKey: ['registros-gestion', geIds, year],
    queryFn: async () => {
      if (!geIds || geIds.length === 0) return [] as never[]
      const supabase = createClient()
      const yearStart = `${year}-01-01`
      const yearEnd = `${year + 1}-01-01`

      const registrosRes = await supabase
        .from('gestiones_registros')
        .select('id, gestion_establecimiento_id, fecha_planificada, fecha_ejecutada, responsable_id, index, evidencia_url, created_at, responsable:personas_directorio!responsable_id(nombre, apellido), aprobado_por:personas_directorio!aprobado_por_id(nombre, apellido)')
        .in('gestion_establecimiento_id', geIds)
        .gte('fecha_planificada', yearStart)
        .lt('fecha_planificada', yearEnd)
        .order('fecha_planificada', { ascending: false })

      return (registrosRes.data ?? []) as never[]
    },
    enabled: !!geIds && geIds.length > 0,
    staleTime: 1000 * 30,
  })
}

export function useCatalogo() {
  return useQuery({
    queryKey: ['catalogo-gestiones'],
    queryFn: async () => {
      const supabase = createClient()
      const [gesRes, gruRes, catRes] = await Promise.all([
        supabase.from('gestiones').select('id, nombre, categoria_id, aplica_por_iso, gestiones_categorias(id, nombre, gestiones_grupos(nombre))').order('nombre'),
        supabase.from('gestiones_grupos').select('id, nombre').order('nombre'),
        supabase.from('gestiones_categorias').select('id, nombre, grupo_id').order('nombre'),
      ])
      return {
        gestiones: gesRes.data ?? [],
        grupos: gruRes.data ?? [],
        categorias: catRes.data ?? [],
      }
    },
    staleTime: 1000 * 60 * 30,
  })
}
