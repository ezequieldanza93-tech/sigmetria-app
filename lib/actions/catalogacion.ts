'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, user }
}

export async function getTiposEstablecimiento() {
  const { supabase } = await getUser()
  const { data } = await supabase.from('establecimientos_tipos').select('id, nombre, codigo').order('nombre')
  return data ?? []
}

// ─── GESTIÓN ↔ TIPOS DE ESTABLECIMIENTO ───
export interface GestionRow {
  id: string
  nombre: string
  tipos: string[]
  aplicaPorIso: boolean
}

export async function getGestionesConTipos(): Promise<GestionRow[]> {
  const { supabase } = await getUser()
  const [gesRes, relRes] = await Promise.all([
    supabase.from('gestiones').select('id, nombre, aplica_por_iso').order('nombre'),
    supabase.from('gestiones_tipos_establecimiento').select('gestion_id, tipo_establecimiento_id'),
  ])
  const idx = new Map<string, string[]>()
  for (const r of relRes.data ?? []) {
    const arr = idx.get(r.gestion_id) ?? []
    arr.push(r.tipo_establecimiento_id)
    idx.set(r.gestion_id, arr)
  }
  return (gesRes.data ?? []).map(g => ({
    id: g.id, nombre: g.nombre,
    tipos: idx.get(g.id) ?? [],
    aplicaPorIso: g.aplica_por_iso,
  }))
}

export async function toggleGestionTipo(gestionId: string, tipoId: string, active: boolean): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  if (active) {
    const { error } = await supabase.from('gestiones_tipos_establecimiento').upsert(
      { gestion_id: gestionId, tipo_establecimiento_id: tipoId },
      { onConflict: 'gestion_id,tipo_establecimiento_id', ignoreDuplicates: true },
    )
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase.from('gestiones_tipos_establecimiento').delete()
      .eq('gestion_id', gestionId).eq('tipo_establecimiento_id', tipoId)
    if (error) return { success: false, error: error.message }
  }
  return { success: true, data: null }
}

export async function toggleGestionAplicaPorIso(gestionId: string, value: boolean): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  const { error } = await supabase.from('gestiones').update({ aplica_por_iso: value }).eq('id', gestionId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

// ─── SECCIONES ↔ ASPECTOS ───
export async function getAspectos() {
  const { supabase } = await getUser()
  const { data } = await supabase.from('aspectos').select('id, nombre').order('nombre')
  return data ?? []
}

export interface SeccionRow {
  id: string
  gestion_id: string
  title: string
  aspectos: string[]
  aplicaPorIso: boolean
}

export async function getSeccionesConAspectos(): Promise<SeccionRow[]> {
  const { supabase } = await getUser()
  const [secRes, relRes] = await Promise.all([
    supabase.from('formularios_secciones').select('id, gestion_id, title, aplica_por_iso').order('title'),
    supabase.from('formularios_secciones_aspectos').select('section_id, aspecto_id'),
  ])
  const idx = new Map<string, string[]>()
  for (const r of relRes.data ?? []) {
    const arr = idx.get(r.section_id) ?? []
    arr.push(r.aspecto_id)
    idx.set(r.section_id, arr)
  }
  return (secRes.data ?? []).map(s => ({
    ...s,
    aspectos: idx.get(s.id) ?? [],
    aplicaPorIso: s.aplica_por_iso,
  }))
}

export async function toggleSeccionAspecto(sectionId: string, aspectoId: string, active: boolean): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  if (active) {
    const { error } = await supabase.from('formularios_secciones_aspectos').upsert(
      { section_id: sectionId, aspecto_id: aspectoId },
      { onConflict: 'section_id,aspecto_id', ignoreDuplicates: true },
    )
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase.from('formularios_secciones_aspectos').delete()
      .eq('section_id', sectionId).eq('aspecto_id', aspectoId)
    if (error) return { success: false, error: error.message }
  }
  return { success: true, data: null }
}

export async function toggleSeccionAplicaPorIso(sectionId: string, value: boolean): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  const { error } = await supabase.from('formularios_secciones').update({ aplica_por_iso: value }).eq('id', sectionId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

// ─── DOCUMENTACIÓN ↔ TIPOS/RUBROS (documentos_tipos_reglas) ───
// ELIMINADO 2026-06-17: estas funciones (getDocumentoTiposConTipos, toggleDocumentoTipo,
// getDocTiposConRubros, toggleDocumentoRubro, etc.) eran código muerto — ninguna UI las
// importaba. La aplicabilidad de documentos ahora vive en la matriz nueva
// documentos_tipos_tipos_establecimiento (curada en la pantalla del catálogo) y la consume
// getLegajoEsperados. La tabla `documentos_tipos_reglas` quedó huérfana → revisar y borrar.
