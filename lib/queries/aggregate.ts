import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { GestionAggregateRow } from '@/components/aggregate/gestiones-aggregate'
import type { SeguimientoAggregateRow } from '@/components/aggregate/seguimiento-aggregate'
import type { IncidenteAggregateRow } from '@/components/aggregate/incidentes-aggregate'
import type { DenunciaAggregateRow } from '@/components/aggregate/denuncias-aggregate'

interface EstabContext {
  id: string
  nombre: string
  empresa_id: string
  empresa_razon_social: string
}

export async function getGestionesAggregate(establecimientos: EstabContext[]): Promise<GestionAggregateRow[]> {
  if (establecimientos.length === 0) return []
  const supabase = await createClient()
  const ids = establecimientos.map(e => e.id)
  const ctxMap = new Map(establecimientos.map(e => [e.id, e]))

  const { data, error } = await supabase
    .from('gestiones_registros')
    .select(`
      id,
      fecha_planificada,
      fecha_ejecutada,
      fecha_vencimiento,
      responsable:personas_directorio!responsable_id(nombre, apellido),
      gestiones_establecimientos!inner(
        establecimiento_id,
        gestiones!inner(
          nombre,
          gestiones_categorias(nombre, gestiones_grupos(nombre))
        )
      )
    `)
    .in('gestiones_establecimientos.establecimiento_id', ids)
    .order('fecha_planificada', { ascending: false })
    .limit(2000)

  if (error || !data) return []

  return (data as unknown as Array<{
    id: string
    fecha_planificada: string
    fecha_ejecutada: string | null
    fecha_vencimiento: string | null
    responsable: { nombre: string; apellido: string } | null
    gestiones_establecimientos: {
      establecimiento_id: string
      gestiones: {
        nombre: string
        gestiones_categorias: {
          nombre: string
          gestiones_grupos: { nombre: string } | null
        } | null
      }
    }
  }>).map(row => {
    const estId = row.gestiones_establecimientos.establecimiento_id
    const ctx = ctxMap.get(estId)
    return {
      registro_id: row.id,
      empresa_id: ctx?.empresa_id ?? '',
      empresa_razon_social: ctx?.empresa_razon_social ?? '—',
      establecimiento_id: estId,
      establecimiento_nombre: ctx?.nombre ?? '—',
      categoria: row.gestiones_establecimientos.gestiones.gestiones_categorias?.nombre ?? null,
      grupo: row.gestiones_establecimientos.gestiones.gestiones_categorias?.gestiones_grupos?.nombre ?? null,
      gestion_nombre: row.gestiones_establecimientos.gestiones.nombre ?? null,
      fecha_planificada: row.fecha_planificada,
      fecha_ejecutada: row.fecha_ejecutada,
      fecha_vencimiento: row.fecha_vencimiento,
      responsable_nombre: row.responsable
        ? `${row.responsable.nombre ?? ''} ${row.responsable.apellido ?? ''}`.trim() || null
        : null,
    }
  })
}

export async function getSeguimientoAggregate(establecimientos: EstabContext[]): Promise<SeguimientoAggregateRow[]> {
  if (establecimientos.length === 0) return []
  const supabase = await createClient()
  const ids = establecimientos.map(e => e.id)
  const ctxMap = new Map(establecimientos.map(e => [e.id, e]))

  // 1. Traemos los registros ejecutados para los establecimientos del scope.
  const { data: regs } = await supabase
    .from('gestiones_registros')
    .select(`
      id,
      fecha_ejecutada,
      gestiones_establecimientos!inner(
        establecimiento_id,
        gestiones!inner(nombre)
      )
    `)
    .not('fecha_ejecutada', 'is', null)
    .in('gestiones_establecimientos.establecimiento_id', ids)
    .limit(5000)

  const regsTyped = (regs ?? []) as unknown as Array<{
    id: string
    gestiones_establecimientos: {
      establecimiento_id: string
      gestiones: { nombre: string } | null
    }
  }>

  if (regsTyped.length === 0) return []

  const regMap = new Map(regsTyped.map(r => [r.id, r]))
  const regIds = regsTyped.map(r => r.id)

  // 2. Traemos las observaciones ligadas a esos registros.
  const { data: obs } = await supabase
    .from('gestiones_observaciones')
    .select(`
      id, registro_gestion_id, descripcion, fecha_planificada, fecha_cierre,
      responsable_id,
      personas_directorio!responsable_id(nombre, apellido)
    `)
    .in('registro_gestion_id', regIds)
    .order('fecha_planificada', { ascending: false })
    .limit(5000)

  const obsTyped = (obs ?? []) as unknown as Array<{
    id: string
    registro_gestion_id: string
    descripcion: string
    fecha_planificada: string
    fecha_cierre: string | null
    personas_directorio: { nombre: string; apellido: string } | null
  }>

  return obsTyped.map(o => {
    const reg = regMap.get(o.registro_gestion_id)
    const estId = reg?.gestiones_establecimientos.establecimiento_id ?? ''
    const ctx = ctxMap.get(estId)
    return {
      id: o.id,
      empresa_id: ctx?.empresa_id ?? '',
      empresa_razon_social: ctx?.empresa_razon_social ?? '—',
      establecimiento_id: estId,
      establecimiento_nombre: ctx?.nombre ?? '—',
      gestion_nombre: reg?.gestiones_establecimientos.gestiones?.nombre ?? null,
      descripcion: o.descripcion,
      fecha_planificada: o.fecha_planificada,
      fecha_cierre: o.fecha_cierre,
      responsable_nombre: o.personas_directorio
        ? `${o.personas_directorio.nombre ?? ''} ${o.personas_directorio.apellido ?? ''}`.trim() || null
        : null,
    }
  })
}

export async function getIncidentesAggregate(establecimientos: EstabContext[]): Promise<IncidenteAggregateRow[]> {
  if (establecimientos.length === 0) return []
  const supabase = await createClient()
  const ids = establecimientos.map(e => e.id)
  const empresaIds = Array.from(new Set(establecimientos.map(e => e.empresa_id)))
  const ctxMap = new Map(establecimientos.map(e => [e.id, e]))
  const empresaCtxMap = new Map(establecimientos.map(e => [e.empresa_id, e.empresa_razon_social]))

  // Traemos incidentes que pertenecen a estos establecimientos
  // o a las empresas del scope cuando no tienen establecimiento asignado.
  const { data, error } = await supabase
    .from('incidentes')
    .select('id, empresa_id, establecimiento_id, titulo, tipo_incidente, severidad, estado, fecha_incidente, created_at')
    .in('empresa_id', empresaIds)
    .or(`establecimiento_id.in.(${ids.join(',')}),establecimiento_id.is.null`)
    .order('fecha_incidente', { ascending: false })
    .limit(2000)

  if (error || !data) return []

  return (data as Array<{
    id: string
    empresa_id: string
    establecimiento_id: string | null
    titulo: string
    tipo_incidente: string
    severidad: string
    estado: string
    fecha_incidente: string
    created_at: string
  }>).map(row => {
    const ctx = row.establecimiento_id ? ctxMap.get(row.establecimiento_id) : null
    return {
      id: row.id,
      empresa_id: row.empresa_id,
      empresa_razon_social: ctx?.empresa_razon_social ?? empresaCtxMap.get(row.empresa_id) ?? '—',
      establecimiento_id: row.establecimiento_id,
      establecimiento_nombre: ctx?.nombre ?? null,
      titulo: row.titulo,
      tipo_incidente: row.tipo_incidente,
      severidad: row.severidad,
      estado: row.estado,
      fecha_incidente: row.fecha_incidente,
    }
  })
}

export async function getDenunciasAggregate(establecimientos: EstabContext[]): Promise<DenunciaAggregateRow[]> {
  if (establecimientos.length === 0) return []
  const supabase = await createClient()
  const ids = establecimientos.map(e => e.id)
  const empresaIds = Array.from(new Set(establecimientos.map(e => e.empresa_id)))
  const ctxMap = new Map(establecimientos.map(e => [e.id, e]))
  const empresaCtxMap = new Map(establecimientos.map(e => [e.empresa_id, e.empresa_razon_social]))

  const { data, error } = await supabase
    .from('denuncias')
    .select('id, empresa_id, establecimiento_id, titulo, tipo_denuncia, denunciante_tipo, estado, fecha_denuncia, created_at')
    .in('empresa_id', empresaIds)
    .or(`establecimiento_id.in.(${ids.join(',')}),establecimiento_id.is.null`)
    .order('fecha_denuncia', { ascending: false })
    .limit(2000)

  if (error || !data) return []

  return (data as Array<{
    id: string
    empresa_id: string
    establecimiento_id: string | null
    titulo: string
    tipo_denuncia: string
    denunciante_tipo: string
    estado: string
    fecha_denuncia: string
    created_at: string
  }>).map(row => {
    const ctx = row.establecimiento_id ? ctxMap.get(row.establecimiento_id) : null
    return {
      id: row.id,
      empresa_id: row.empresa_id,
      empresa_razon_social: ctx?.empresa_razon_social ?? empresaCtxMap.get(row.empresa_id) ?? '—',
      establecimiento_id: row.establecimiento_id,
      establecimiento_nombre: ctx?.nombre ?? null,
      titulo: row.titulo,
      tipo_denuncia: row.tipo_denuncia,
      denunciante_tipo: row.denunciante_tipo,
      estado: row.estado,
      fecha_denuncia: row.fecha_denuncia,
    }
  })
}
