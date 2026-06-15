import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
        supabase.from('profiles').select('system_role, is_super_admin').eq('id', user.id).single(),
      ])

      if (profile?.system_role === 'developer' || profile?.is_super_admin === true) return true
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
        .select('id, firmada, gestiones!inner(id, nombre, tiene_entregable, tipo_ejecucion, gestiones_categorias(nombre, gestiones_grupos(nombre)))')
        .eq('establecimiento_id', establecimientoId)
        .gte('created_at', yearStart)
        .lt('created_at', yearEnd)
        .order('created_at', { ascending: true })

      return (data ?? []) as unknown as {
        id: string
        firmada: boolean
        gestiones: {
          id: string
          nombre: string
          tipo_ejecucion: string
          gestiones_categorias: { nombre: string; gestiones_grupos: { nombre: string } | null } | null
        }
      }[]
    },
    enabled: !!establecimientoId,
    staleTime: 1000 * 30,
    meta: { persist: true },
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
        .select('id, gestion_establecimiento_id, fecha_planificada, fecha_ejecutada, ejecutado_at, fecha_vencimiento, responsable_id, index, evidencia_url, mostrar_lt, secuencia, created_at, responsable:personas_directorio!responsable_id(nombre, apellido), aprobado_por:personas_directorio!aprobado_por_id(nombre, apellido)')
        .in('gestion_establecimiento_id', geIds)
        .gte('fecha_planificada', yearStart)
        .lt('fecha_planificada', yearEnd)
        .order('fecha_planificada', { ascending: false })

      return (registrosRes.data ?? []) as never[]
    },
    enabled: !!geIds && geIds.length > 0,
    staleTime: 1000 * 30,
    meta: { persist: true },
  })
}

export function usePersonasEstablecimiento(establecimientoId: string | undefined) {
  return useQuery({
    queryKey: ['personas-establecimiento', establecimientoId],
    queryFn: async () => {
      if (!establecimientoId) return []
      const supabase = createClient()
      const { data } = await supabase
        .from('personas_establecimientos')
        .select('personas_directorio!persona_id(id, nombre, apellido)')
        .eq('establecimiento_id', establecimientoId)
      return ((data ?? []) as unknown as { personas_directorio: { id: string; nombre: string; apellido: string } | null }[])
        .map(pe => pe.personas_directorio)
        .filter(Boolean)
        .sort((a, b) => a!.apellido.localeCompare(b!.apellido)) as { id: string; nombre: string; apellido: string }[]
    },
    enabled: !!establecimientoId,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Devuelve las personas del directorio que son usuarios ejecutores de la consultora
 * del establecimiento dado (rol: colaborador | full_access_branch | full_access_main).
 * Se usa exclusivamente en selectores de RESPONSABLE de gestión.
 */
export function useUsuariosEjecutores(establecimientoId: string | undefined) {
  return useQuery({
    queryKey: ['usuarios-ejecutores', establecimientoId],
    queryFn: async () => {
      if (!establecimientoId) return []
      const supabase = createClient()

      // 1. Obtener consultora_id del establecimiento
      const { data: estab } = await supabase
        .from('establecimientos')
        .select('empresa_id, empresas!inner(consultora_id)')
        .eq('id', establecimientoId)
        .maybeSingle()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const consultoraId = (estab as any)?.empresas?.consultora_id as string | undefined
      if (!consultoraId) return []

      // 2. Traer miembros activos con rol ejecutor
      const ROLES_EJECUTORES = ['colaborador', 'full_access_branch', 'full_access_main']
      const { data: members } = await supabase
        .from('consultoras_members')
        .select('user_id, role')
        .eq('consultora_id', consultoraId)
        .eq('is_active', true)
        .in('role', ROLES_EJECUTORES)

      if (!members || members.length === 0) return []

      const userIds = members.map(m => m.user_id)

      // 3. Buscar persona_id en profiles para esos users
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, persona_id')
        .in('id', userIds)
        .not('persona_id', 'is', null)

      if (!profs || profs.length === 0) return []

      const personaIds = profs.map(p => p.persona_id as string)

      // 4. Traer los datos de personas_directorio
      const { data: personas } = await supabase
        .from('personas_directorio')
        .select('id, nombre, apellido, dni')
        .in('id', personaIds)
        .eq('is_active', true)
        .order('apellido')

      return (personas ?? []) as { id: string; nombre: string; apellido: string; dni: string | null }[]
    },
    enabled: !!establecimientoId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useObservacionesClasificaciones() {
  return useQuery({
    queryKey: ['observaciones-clasificaciones'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('observaciones_clasificaciones')
        .select('id, nombre')
        .eq('is_active', true)
        .order('nombre')
      return (data ?? []) as { id: string; nombre: string }[]
    },
    staleTime: 1000 * 60 * 30,
    meta: { persist: true },
  })
}

export function useFormulariosSecciones(geIds: string[]) {
  return useQuery({
    queryKey: ['formularios-secciones', geIds],
    queryFn: async () => {
      const gestionIds = geIds
      if (gestionIds.length === 0) return new Set<string>()
      const supabase = createClient()
      const { data } = await supabase
        .from('formularios_secciones')
        .select('gestion_id')
        .in('gestion_id', gestionIds)
      return new Set((data ?? []).map(s => s.gestion_id))
    },
    enabled: geIds.length > 0,
  })
}

export function useToggleMostrarLT() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, mostrar_lt }: { id: string; mostrar_lt: boolean }) => {
      const supabase = createClient()
      await supabase.from('gestiones_registros').update({ mostrar_lt }).eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-gestion'] })
    },
  })
}

export function useCatalogo() {
  return useQuery({
    queryKey: ['catalogo-gestiones'],
    queryFn: async () => {
      const supabase = createClient()
      const [gesRes, gruRes, catRes] = await Promise.all([
        supabase.from('gestiones').select('id, nombre, categoria_id, aplica_por_iso, tiene_entregable, tipo_ejecucion, gestiones_categorias(id, nombre, gestiones_grupos(nombre))').order('nombre'),
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
    meta: { persist: true },
  })
}
