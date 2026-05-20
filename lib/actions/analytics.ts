'use server'
import { createClient } from '@/lib/supabase/server'

export interface AnalyticsFilters {
  establecimientoIds: string[]
  year: number
  month: number | null
  responsableId: string | null
}

export interface GestionRow {
  id: string
  gestion_establecimiento_id: string
  establecimiento_id: string
  establecimiento_nombre: string
  gestion_nombre: string
  categoria_nombre: string
  index: number | null
  fecha_planificada: string
  fecha_ejecutada: string | null
  responsable_id: string | null
  responsable_nombre: string | null
}

export interface SiniestroRow {
  id: string
  establecimiento_id: string
  tipo: string
  estado: string
  fecha_ocurrencia: string
  dias_perdidos: number | null
}

export interface InspeccionRow {
  id: string
  establecimiento_id: string
  estado: string
  fecha_programada: string
  puntaje: number | null
}

export interface FeedbackRow {
  id: string
  establecimiento_id: string
  tipo: string
  fecha: string
}

export interface ObservacionRow {
  id: string
  registro_gestion_id: string
  fecha_planificada: string
  fecha_cierre: string | null
  nivel: number | null
}

export interface ResponsableOption {
  id: string
  nombre: string
}

export async function getGestionRows(filters: AnalyticsFilters): Promise<GestionRow[]> {
  if (!filters.establecimientoIds.length) return []
  const supabase = await createClient()

  const { data: geData } = await supabase
    .from('gestiones_establecimientos')
    .select('id, establecimiento_id, establecimientos!inner(nombre), gestiones!inner(nombre, gestiones_categorias!inner(nombre))')
    .in('establecimiento_id', filters.establecimientoIds)

  if (!geData?.length) return []

  const geMap = new Map(geData.map(ge => [ge.id, ge]))
  const geIds = geData.map(ge => ge.id)

  let query = supabase
    .from('gestiones_registros')
    .select('id, gestion_establecimiento_id, index, fecha_planificada, fecha_ejecutada, responsable_id, personas_directorio!responsable_id(nombre, apellido)')
    .in('gestion_establecimiento_id', geIds)
    .gte('fecha_planificada', `${filters.year}-01-01`)
    .lte('fecha_planificada', `${filters.year}-12-31`)

  if (filters.month !== null) {
    const m = String(filters.month).padStart(2, '0')
    const lastDay = new Date(filters.year, filters.month, 0).getDate()
    query = query
      .gte('fecha_planificada', `${filters.year}-${m}-01`)
      .lte('fecha_planificada', `${filters.year}-${m}-${lastDay}`)
  }

  if (filters.responsableId) {
    query = query.eq('responsable_id', filters.responsableId)
  }

  const { data: rows } = await query

  return (rows ?? []).map(r => {
    const ge = geMap.get(r.gestion_establecimiento_id)
    const pd = r.personas_directorio as unknown as { nombre: string; apellido: string } | null
    return {
      id: r.id,
      gestion_establecimiento_id: r.gestion_establecimiento_id,
      establecimiento_id: (ge?.establecimiento_id as string) ?? '',
      establecimiento_nombre: (ge?.establecimientos as any)?.nombre ?? '',
      gestion_nombre: (ge?.gestiones as any)?.nombre ?? '',
      categoria_nombre: (ge?.gestiones as any)?.gestiones_categorias?.nombre ?? '',
      index: r.index ?? null,
      fecha_planificada: r.fecha_planificada,
      fecha_ejecutada: r.fecha_ejecutada ?? null,
      responsable_id: r.responsable_id ?? null,
      responsable_nombre: pd ? `${pd.nombre} ${pd.apellido}` : null,
    }
  })
}

export async function getSiniestroRows(filters: AnalyticsFilters): Promise<SiniestroRow[]> {
  if (!filters.establecimientoIds.length) return []
  const supabase = await createClient()

  let query = supabase
    .from('siniestros')
    .select('id, establecimiento_id, tipo, estado, fecha_ocurrencia, dias_perdidos')
    .in('establecimiento_id', filters.establecimientoIds)
    .gte('fecha_ocurrencia', `${filters.year}-01-01`)
    .lte('fecha_ocurrencia', `${filters.year}-12-31`)

  if (filters.month !== null) {
    const m = String(filters.month).padStart(2, '0')
    const lastDay = new Date(filters.year, filters.month, 0).getDate()
    query = query
      .gte('fecha_ocurrencia', `${filters.year}-${m}-01`)
      .lte('fecha_ocurrencia', `${filters.year}-${m}-${lastDay}`)
  }

  const { data } = await query
  return (data ?? []) as SiniestroRow[]
}

export async function getInspeccionRows(filters: AnalyticsFilters): Promise<InspeccionRow[]> {
  if (!filters.establecimientoIds.length) return []
  const supabase = await createClient()

  let query = supabase
    .from('inspecciones')
    .select('id, establecimiento_id, estado, fecha_programada, puntaje')
    .in('establecimiento_id', filters.establecimientoIds)
    .gte('fecha_programada', `${filters.year}-01-01`)
    .lte('fecha_programada', `${filters.year}-12-31`)

  if (filters.month !== null) {
    const m = String(filters.month).padStart(2, '0')
    const lastDay = new Date(filters.year, filters.month, 0).getDate()
    query = query
      .gte('fecha_programada', `${filters.year}-${m}-01`)
      .lte('fecha_programada', `${filters.year}-${m}-${lastDay}`)
  }

  const { data } = await query
  return (data ?? []) as InspeccionRow[]
}

export async function getFeedbackRows(filters: AnalyticsFilters): Promise<FeedbackRow[]> {
  if (!filters.establecimientoIds.length) return []
  const supabase = await createClient()

  let query = supabase
    .from('establecimientos_feedback_clientes')
    .select('id, establecimiento_id, tipo, fecha')
    .in('establecimiento_id', filters.establecimientoIds)
    .gte('fecha', `${filters.year}-01-01`)
    .lte('fecha', `${filters.year}-12-31`)

  if (filters.month !== null) {
    const m = String(filters.month).padStart(2, '0')
    const lastDay = new Date(filters.year, filters.month, 0).getDate()
    query = query
      .gte('fecha', `${filters.year}-${m}-01`)
      .lte('fecha', `${filters.year}-${m}-${lastDay}`)
  }

  const { data } = await query
  return (data ?? []) as FeedbackRow[]
}

export async function getObservacionRows(filters: AnalyticsFilters): Promise<ObservacionRow[]> {
  if (!filters.establecimientoIds.length) return []
  const supabase = await createClient()

  // Step 1: get gestiones_establecimientos for scope
  const { data: geData } = await supabase
    .from('gestiones_establecimientos')
    .select('id')
    .in('establecimiento_id', filters.establecimientoIds)

  const geIds = (geData ?? []).map(g => g.id)
  if (!geIds.length) return []

  // Step 2: get gestiones_registros ids in date range
  let regQuery = supabase
    .from('gestiones_registros')
    .select('id')
    .in('gestion_establecimiento_id', geIds)
    .gte('fecha_planificada', `${filters.year}-01-01`)
    .lte('fecha_planificada', `${filters.year}-12-31`)

  if (filters.month !== null) {
    const m = String(filters.month).padStart(2, '0')
    const lastDay = new Date(filters.year, filters.month, 0).getDate()
    regQuery = regQuery
      .gte('fecha_planificada', `${filters.year}-${m}-01`)
      .lte('fecha_planificada', `${filters.year}-${m}-${lastDay}`)
  }

  const { data: regData } = await regQuery
  const registroIds = (regData ?? []).map(r => r.id)
  if (!registroIds.length) return []

  // Step 3: get observations
  const { data } = await supabase
    .from('gestiones_observaciones')
    .select('id, registro_gestion_id, fecha_planificada, fecha_cierre')
    .in('registro_gestion_id', registroIds)

  return (data ?? []).map(r => ({
    id: r.id,
    registro_gestion_id: r.registro_gestion_id,
    fecha_planificada: r.fecha_planificada,
    fecha_cierre: r.fecha_cierre ?? null,
    nivel: null,
  }))
}

export async function getResponsableOptions(establecimientoIds: string[]): Promise<ResponsableOption[]> {
  if (!establecimientoIds.length) return []
  const supabase = await createClient()

  const { data: geData } = await supabase
    .from('gestiones_establecimientos')
    .select('id')
    .in('establecimiento_id', establecimientoIds)

  const geIds = (geData ?? []).map(g => g.id)
  if (!geIds.length) return []

  const { data } = await supabase
    .from('gestiones_registros')
    .select('responsable_id, personas_directorio!responsable_id(id, nombre, apellido)')
    .in('gestion_establecimiento_id', geIds)
    .not('responsable_id', 'is', null)

  const seen = new Set<string>()
  return (data ?? []).reduce((acc, r) => {
    const pd = r.personas_directorio as unknown as { id: string; nombre: string; apellido: string } | null
    if (pd && !seen.has(pd.id)) {
      seen.add(pd.id)
      acc.push({ id: pd.id, nombre: `${pd.nombre} ${pd.apellido}` })
    }
    return acc
  }, [] as ResponsableOption[])
}
