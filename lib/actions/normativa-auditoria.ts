'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
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
  evidencia_path: string | null
  norma_numero: string | null
  norma_titulo: string | null
  norma_tipo: string | null
  categoria_nombre: string | null
  ambito: string | null
  articulo: string | null
  descripcion_corta: string | null
  descripcion_oficial: string | null
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

export interface NormaNueva {
  id: string
  tipo: string
  numero: string | null
  titulo: string
}

export interface NovedadesNormativas {
  /** ¿Hay al menos una auditoría cerrada contra la cual comparar? */
  tieneAuditoriaCerrada: boolean
  /** Fecha de la última auditoría cerrada (referencia del snapshot comparado). */
  ultimaCerradaFecha: string | null
  /** Normas que hoy aplican y NO estaban en el snapshot de esa auditoría cerrada. */
  normasNuevas: NormaNueva[]
}

/**
 * Detecta normas que aparecieron como aplicables DESPUÉS de la última auditoría
 * cerrada (2A.3): "apareció una norma nueva aplicable a tu establecimiento".
 *
 * Compara la matriz viva (getNormativasAplicables) contra el snapshot de la
 * última auditoría CERRADA. Es una lectura pura: NO modifica ninguna auditoría
 * (el snapshot cerrado queda intacto). Si no hay auditoría cerrada, no hay nada
 * que comparar (la primera auditoría se crea desde cero con el badge existente).
 */
export async function getNovedadesNormativas(
  establecimientoId: string,
): Promise<ActionResult<NovedadesNormativas>> {
  const supabase = await createClient()

  const { data: ultima, error: audErr } = await supabase
    .from('normativa_auditorias')
    .select('id, fecha')
    .eq('establecimiento_id', establecimientoId)
    .eq('estado', 'cerrada')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (audErr) return { success: false, error: audErr.message }

  if (!ultima) {
    return { success: true, data: { tieneAuditoriaCerrada: false, ultimaCerradaFecha: null, normasNuevas: [] } }
  }

  // norma_ids congelados en esa auditoría cerrada (snapshot).
  const { data: itemsPrev, error: itErr } = await supabase
    .from('normativa_auditoria_items')
    .select('norma_id')
    .eq('auditoria_id', (ultima as { id: string }).id)
  if (itErr) return { success: false, error: itErr.message }

  const yaAuditadas = new Set(
    ((itemsPrev ?? []) as { norma_id: string | null }[])
      .map((i) => i.norma_id)
      .filter((id): id is string => id !== null),
  )

  // Normas que hoy aplican y NO estaban en el snapshot cerrado.
  const aplicables = await getNormativasAplicables(establecimientoId)
  const normasNuevas: NormaNueva[] = aplicables
    .filter((n) => !yaAuditadas.has(n.id))
    .map((n) => ({ id: n.id, tipo: n.tipo, numero: n.numero, titulo: n.titulo }))

  return {
    success: true,
    data: {
      tieneAuditoriaCerrada: true,
      ultimaCerradaFecha: (ultima as { fecha: string }).fecha,
      normasNuevas,
    },
  }
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
    .select('id, norma_id, articulo, descripcion_corta, descripcion_oficial, orden')
    .in('norma_id', normas.map((n) => n.id))
    .order('orden', { ascending: true, nullsFirst: false })
  if (reqErr) return { success: false, error: reqErr.message }

  type ReqSnap = { id: string; articulo: string | null; descripcion_corta: string | null; descripcion_oficial: string | null }
  const reqsPorNorma = new Map<string, ReqSnap[]>()
  for (const r of (reqs ?? []) as (ReqSnap & { norma_id: string })[]) {
    const arr = reqsPorNorma.get(r.norma_id) ?? []
    arr.push({ id: r.id, articulo: r.articulo, descripcion_corta: r.descripcion_corta, descripcion_oficial: r.descripcion_oficial })
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
      // Default optimista: arranca como "cumple"; el auditor solo cambia los que
      // NO cumplen (o no aplican). Reduce clics en auditorías largas.
      estado: 'cumple' as AuditoriaItemEstado,
      norma_numero: n.numero,
      norma_titulo: n.titulo,
      norma_tipo: n.tipo,
      categoria_nombre: n.categoria_nombre,
      ambito: n.ambito,
    }
    if (rs.length === 0) {
      itemsToInsert.push({ ...base, requisito_id: null, articulo: null, descripcion_corta: null, descripcion_oficial: null, orden: ordenGlobal++ })
    } else {
      for (const r of rs) {
        itemsToInsert.push({ ...base, requisito_id: r.id, articulo: r.articulo, descripcion_corta: r.descripcion_corta, descripcion_oficial: r.descripcion_oficial, orden: ordenGlobal++ })
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

// ── Evidencia como ARCHIVO adjunto ─────────────────────────────────────────
// Se guarda en el bucket privado `documentos` con path por tenant
// {consultora_id}/auditoria/{item_id}/evidencia.{ext} (la RLS per-tenant lo cubre).
const EVIDENCIA_MAX_BYTES = 10 * 1024 * 1024
const EVIDENCIA_MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export async function subirEvidenciaItem(
  itemId: string,
  formData: FormData,
): Promise<ActionResult<{ path: string }>> {
  const supabase = await createClient()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Archivo vacío o inválido' }
  }
  if (file.size > EVIDENCIA_MAX_BYTES) {
    return { success: false, error: 'El archivo supera los 10 MB' }
  }
  const ext = EVIDENCIA_MIME_EXT[file.type]
  if (!ext) {
    return { success: false, error: 'Tipo no permitido (PDF, PNG, JPG o WEBP)' }
  }

  const { data: item, error: itErr } = await supabase
    .from('normativa_auditoria_items')
    .select('id, evidencia_path, auditoria:normativa_auditorias(consultora_id)')
    .eq('id', itemId)
    .single()
  if (itErr || !item) return { success: false, error: 'Ítem no encontrado' }

  const aud = item.auditoria as unknown as { consultora_id: string } | { consultora_id: string }[] | null
  const consultoraId = Array.isArray(aud) ? aud[0]?.consultora_id : aud?.consultora_id
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora' }

  const path = `${consultoraId}/auditoria/${itemId}/evidencia.${ext}`

  const { error: upErr } = await supabase.storage
    .from('documentos')
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
  if (upErr) return { success: false, error: upErr.message }

  // Si había un archivo previo con otra extensión, lo borramos para no dejar huérfanos.
  const prev = (item as { evidencia_path: string | null }).evidencia_path
  if (prev && prev !== path) {
    await supabase.storage.from('documentos').remove([prev])
  }

  const { error: updErr } = await supabase
    .from('normativa_auditoria_items')
    .update({ evidencia_path: path })
    .eq('id', itemId)
  if (updErr) return { success: false, error: updErr.message }

  return { success: true, data: { path } }
}

export async function quitarEvidenciaItem(itemId: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: item } = await supabase
    .from('normativa_auditoria_items')
    .select('evidencia_path')
    .eq('id', itemId)
    .single()
  const path = (item as { evidencia_path: string | null } | null)?.evidencia_path
  if (path) {
    await supabase.storage.from('documentos').remove([path])
  }
  const { error } = await supabase
    .from('normativa_auditoria_items')
    .update({ evidencia_path: null })
    .eq('id', itemId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

/**
 * Agrega un requisito ad-hoc a una auditoría.
 * Crea una norma custom (tipo "Otro") en la librería de la consultora
 * para que sea reutilizable en futuras auditorías.
 */
export async function addAdHocItemToAuditoria(
  auditoriaId: string,
  data: {
    titulo: string
    descripcion?: string
    referencia?: string
  },
): Promise<ActionResult<AuditoriaItem>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const titulo = data.titulo?.trim()
  if (!titulo) return { success: false, error: 'El título del requisito es obligatorio' }

  const { data: auditoria } = await supabase
    .from('normativa_auditorias')
    .select('id, consultora_id, estado')
    .eq('id', auditoriaId)
    .single()

  if (!auditoria) return { success: false, error: 'Auditoría no encontrada' }
  if ((auditoria as { estado: string }).estado === 'cerrada') return { success: false, error: 'La auditoría está cerrada' }

  const consultoraId = (auditoria as { consultora_id: string }).consultora_id
  const normaTitulo = data.referencia?.trim() || 'Requisito propio'

  const { data: norma, error: normaError } = await supabase
    .from('normativa_normas')
    .insert({ consultora_id: consultoraId, tipo: 'Otro', titulo: normaTitulo, estado: 'Vigente' })
    .select('id, tipo, titulo')
    .single()

  if (normaError || !norma) return { success: false, error: normaError?.message ?? 'No se pudo crear la norma' }

  const { data: req, error: reqError } = await supabase
    .from('normativa_requisitos')
    .insert({ norma_id: (norma as { id: string }).id, articulo: titulo, descripcion_corta: data.descripcion?.trim() || null, orden: 1 })
    .select('id')
    .single()

  if (reqError || !req) return { success: false, error: reqError?.message ?? 'No se pudo crear el requisito' }

  const { data: newItem, error: itemError } = await supabase
    .from('normativa_auditoria_items')
    .insert({
      auditoria_id: auditoriaId,
      norma_id: (norma as { id: string }).id,
      requisito_id: (req as { id: string }).id,
      // Coherente con el default optimista: arranca en "cumple".
      estado: 'cumple',
      norma_numero: null,
      norma_titulo: normaTitulo,
      norma_tipo: 'Otro',
      articulo: titulo,
      descripcion_corta: data.descripcion?.trim() || null,
      descripcion_oficial: null,
      orden: 9999,
    })
    .select('*')
    .single()

  if (itemError || !newItem) return { success: false, error: itemError?.message ?? 'No se pudo agregar el requisito' }

  revalidatePath('/dashboard/empresas', 'layout')
  return { success: true, data: newItem as unknown as AuditoriaItem }
}
