import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { EstablecimientoStatus } from '@/lib/types'
import type { GestionAggregateRow } from '@/components/aggregate/gestiones-aggregate'
import type { SeguimientoAggregateRow } from '@/components/aggregate/seguimiento-aggregate'

// Estado por defecto cuando la fila no resuelve el establecimiento/empresa
// (no debería pasar con joins !inner, pero el toggle necesita un valor concreto).
const FALLBACK_STATUS: EstablecimientoStatus = 'active'

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
        ),
        establecimientos!inner(
          status,
          empresas!inner(is_active)
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
      // Estado de la entidad cargado para el toggle de la vista (carry-state-in-rows).
      establecimientos: {
        status: EstablecimientoStatus | null
        empresas: { is_active: boolean | null } | null
      } | null
    }
  }>).map(row => {
    const estId = row.gestiones_establecimientos.establecimiento_id
    const ctx = ctxMap.get(estId)
    const estado = row.gestiones_establecimientos.establecimientos
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
      empresa_is_active: estado?.empresas?.is_active ?? true,
      establecimiento_status: estado?.status ?? FALLBACK_STATUS,
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
        gestiones!inner(nombre),
        establecimientos!inner(
          status,
          empresas!inner(is_active)
        )
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
      // Estado de la entidad cargado para el toggle de la vista (carry-state-in-rows).
      establecimientos: {
        status: EstablecimientoStatus | null
        empresas: { is_active: boolean | null } | null
      } | null
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
    // Orden ascendente: las vencidas/próximas a vencer arriba, las de fecha
    // futura al fondo (la vista es de seguimiento — lo urgente primero).
    .order('fecha_planificada', { ascending: true })
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
    const estado = reg?.gestiones_establecimientos.establecimientos
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
      empresa_is_active: estado?.empresas?.is_active ?? true,
      establecimiento_status: estado?.status ?? FALLBACK_STATUS,
    }
  })
}
