'use server'

import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromEstablecimiento } from '@/lib/storage/tenant-path'
import { getNormativasAplicables, type NormaAplicable } from '@/lib/actions/aplicabilidad-normativa'
import type { ActionResult } from '@/lib/types'

// ============================================================
// Auditoría de Requisitos Legales (versionada) — server actions
// ============================================================

export type AuditoriaItemEstado = 'pendiente' | 'cumple' | 'no_cumple' | 'no_aplica'
export type AuditoriaEstado = 'borrador' | 'en_curso' | 'cerrada'

export interface AuditoriaItem {
  id: string
  auditoria_id: string
  norma_id: string | null
  requisito_id: string | null
  estado: AuditoriaItemEstado
  observacion: string | null
  evidencia_url: string | null
  norma_numero: string | null
  norma_titulo: string | null
  norma_tipo: string | null
  categoria_nombre: string | null
  ambito: string | null
  articulo: string | null
  descripcion_corta: string | null
  orden: number | null
}

export interface Auditoria {
  id: string
  establecimiento_id: string
  fecha: string
  estado: AuditoriaEstado
  notas: string | null
  created_at: string
  updated_at: string
}

export interface AuditoriaResumen extends Auditoria {
  total: number
  pendientes: number
  cumple: number
  no_cumple: number
  no_aplica: number
}

export interface NormaMatriz extends NormaAplicable {
  requisitos_count: number
}

/** Matriz legal "viva": normas aplicables + cuántos artículos tiene cada una. */
export async function getMatrizLegal(establecimientoId: string): Promise<ActionResult<NormaMatriz[]>> {
  const supabase = await createClient()
  const normas = await getNormativasAplicables(establecimientoId)
  if (normas.length === 0) return { success: true, data: [] }

  const { data: reqs, error } = await supabase
    .from('normativa_requisitos')
    .select('norma_id')
    .in('norma_id', normas.map((n) => n.id))
  if (error) return { success: false, error: error.message }

  const counts = new Map<string, number>()
  for (const r of (reqs ?? []) as { norma_id: string }[]) {
    counts.set(r.norma_id, (counts.get(r.norma_id) ?? 0) + 1)
  }
  return { success: true, data: normas.map((n) => ({ ...n, requisitos_count: counts.get(n.id) ?? 0 })) }
}

/** Lista de auditorías del establecimiento, con el tally de estados de cada una. */
export async function getAuditorias(establecimientoId: string): Promise<ActionResult<AuditoriaResumen[]>> {
  const supabase = await createClient()
  const { data: auds, error } = await supabase
    .from('normativa_auditorias')
    .select('id, establecimiento_id, fecha, estado, notas, created_at, updated_at')
    .eq('establecimiento_id', establecimientoId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return { success: false, error: error.message }

  const list = (auds ?? []) as Auditoria[]
  if (list.length === 0) return { success: true, data: [] }

  const { data: items, error: itErr } = await supabase
    .from('normativa_auditoria_items')
    .select('auditoria_id, estado')
    .in('auditoria_id', list.map((a) => a.id))
  if (itErr) return { success: false, error: itErr.message }

  const tally = new Map<string, { total: number; pendientes: number; cumple: number; no_cumple: number; no_aplica: number }>()
  for (const a of list) tally.set(a.id, { total: 0, pendientes: 0, cumple: 0, no_cumple: 0, no_aplica: 0 })
  for (const it of (items ?? []) as { auditoria_id: string; estado: string }[]) {
    const t = tally.get(it.auditoria_id)
    if (!t) continue
    t.total++
    if (it.estado === 'cumple') t.cumple++
    else if (it.estado === 'no_cumple') t.no_cumple++
    else if (it.estado === 'no_aplica') t.no_aplica++
    else t.pendientes++
  }
  return { success: true, data: list.map((a) => ({ ...a, ...tally.get(a.id)! })) }
}

/** Una auditoría con todos sus ítems (artículos), ordenados. */
export async function getAuditoriaDetalle(
  auditoriaId: string,
): Promise<ActionResult<{ auditoria: Auditoria; items: AuditoriaItem[] }>> {
  const supabase = await createClient()
  const { data: aud, error } = await supabase
    .from('normativa_auditorias')
    .select('id, establecimiento_id, fecha, estado, notas, created_at, updated_at')
    .eq('id', auditoriaId)
    .single()
  if (error) return { success: false, error: error.message }

  const { data: items, error: itErr } = await supabase
    .from('normativa_auditoria_items')
    .select('*')
    .eq('auditoria_id', auditoriaId)
    .order('orden', { ascending: true, nullsFirst: false })
  if (itErr) return { success: false, error: itErr.message }

  return { success: true, data: { auditoria: aud as Auditoria, items: (items ?? []) as AuditoriaItem[] } }
}

/**
 * Crea una auditoría nueva congelando (snapshot) las normas aplicables y sus
 * artículos al momento. Si una norma no tiene artículos cargados, igual se incluye
 * como un ítem único (para poder marcarla a nivel norma).
 */
export async function createAuditoria(
  establecimientoId: string,
  notas?: string,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()

  const consultoraId = await consultoraIdFromEstablecimiento(supabase, establecimientoId)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del establecimiento' }

  const normas = await getNormativasAplicables(establecimientoId)
  if (normas.length === 0) {
    return { success: false, error: 'No hay normas aplicables para auditar en este establecimiento.' }
  }

  const { data: reqs, error: reqErr } = await supabase
    .from('normativa_requisitos')
    .select('id, norma_id, articulo, descripcion_corta, orden')
    .in('norma_id', normas.map((n) => n.id))
    .order('orden', { ascending: true, nullsFirst: false })
  if (reqErr) return { success: false, error: reqErr.message }

  const reqsPorNorma = new Map<string, { id: string; articulo: string | null; descripcion_corta: string | null }[]>()
  for (const r of (reqs ?? []) as { id: string; norma_id: string; articulo: string | null; descripcion_corta: string | null }[]) {
    const arr = reqsPorNorma.get(r.norma_id) ?? []
    arr.push({ id: r.id, articulo: r.articulo, descripcion_corta: r.descripcion_corta })
    reqsPorNorma.set(r.norma_id, arr)
  }

  const { data: { user } } = await supabase.auth.getUser()

  const { data: aud, error: audErr } = await supabase
    .from('normativa_auditorias')
    .insert({
      consultora_id: consultoraId,
      establecimiento_id: establecimientoId,
      estado: 'en_curso',
      notas: notas ?? null,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()
  if (audErr) return { success: false, error: audErr.message }

  const itemsToInsert: Record<string, unknown>[] = []
  let ordenGlobal = 0
  for (const n of normas) {
    const rs = reqsPorNorma.get(n.id) ?? []
    const base = {
      auditoria_id: aud.id,
      norma_id: n.id,
      norma_numero: n.numero,
      norma_titulo: n.titulo,
      norma_tipo: n.tipo,
      categoria_nombre: n.categoria_nombre,
      ambito: n.ambito,
    }
    if (rs.length === 0) {
      itemsToInsert.push({ ...base, requisito_id: null, articulo: null, descripcion_corta: null, orden: ordenGlobal++ })
    } else {
      for (const r of rs) {
        itemsToInsert.push({ ...base, requisito_id: r.id, articulo: r.articulo, descripcion_corta: r.descripcion_corta, orden: ordenGlobal++ })
      }
    }
  }

  const { error: insErr } = await supabase.from('normativa_auditoria_items').insert(itemsToInsert)
  if (insErr) {
    // Rollback manual: si fallan los ítems, borramos la cabecera para no dejar una auditoría vacía.
    await supabase.from('normativa_auditorias').delete().eq('id', aud.id)
    return { success: false, error: insErr.message }
  }

  return { success: true, data: { id: aud.id } }
}

export async function updateAuditoriaItem(
  itemId: string,
  patch: { estado?: AuditoriaItemEstado; observacion?: string | null; evidencia_url?: string | null },
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const update: Record<string, unknown> = {}
  if (patch.estado !== undefined) update.estado = patch.estado
  if (patch.observacion !== undefined) update.observacion = patch.observacion
  if (patch.evidencia_url !== undefined) update.evidencia_url = patch.evidencia_url
  if (Object.keys(update).length === 0) return { success: true, data: null }

  const { error } = await supabase.from('normativa_auditoria_items').update(update).eq('id', itemId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function updateAuditoriaEstado(
  auditoriaId: string,
  estado: AuditoriaEstado,
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('normativa_auditorias').update({ estado }).eq('id', auditoriaId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function deleteAuditoria(auditoriaId: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('normativa_auditorias').delete().eq('id', auditoriaId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
