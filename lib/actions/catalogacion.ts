'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, user }
}

// ── Tipos de Establecimiento ──
export async function getTiposEstablecimiento() {
  const { supabase } = await getUser()
  const { data } = await supabase.from('tipos_establecimiento').select('id, nombre, codigo').order('nombre')
  return data ?? []
}

// ─── GESTIÓN ↔ TIPOS DE ESTABLECIMIENTO ───
export async function getGestionesConTipos(): Promise<{ id: string; nombre: string; tipos: string[] }[]> {
  const { supabase } = await getUser()
  const [gesRes, relRes] = await Promise.all([
    supabase.from('gestiones').select('id, nombre').order('nombre'),
    supabase.from('gestion_tipos_establecimiento').select('gestion_id, tipo_establecimiento_id'),
  ])
  const idx = new Map<string, string[]>()
  for (const r of relRes.data ?? []) {
    const arr = idx.get(r.gestion_id) ?? []
    arr.push(r.tipo_establecimiento_id)
    idx.set(r.gestion_id, arr)
  }
  return (gesRes.data ?? []).map(g => ({ id: g.id, nombre: g.nombre, tipos: idx.get(g.id) ?? [] }))
}

export async function toggleGestionTipo(
  gestionId: string,
  tipoId: string,
  active: boolean,
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  if (active) {
    const { error } = await supabase.from('gestion_tipos_establecimiento').upsert(
      { gestion_id: gestionId, tipo_establecimiento_id: tipoId },
      { onConflict: 'gestion_id,tipo_establecimiento_id', ignoreDuplicates: true },
    )
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase.from('gestion_tipos_establecimiento').delete()
      .eq('gestion_id', gestionId).eq('tipo_establecimiento_id', tipoId)
    if (error) return { success: false, error: error.message }
  }
  return { success: true, data: null }
}

// ─── SECCIONES ↔ ASPECTOS ───
export async function getAspectos() {
  const { supabase } = await getUser()
  const { data } = await supabase.from('aspectos').select('id, nombre').order('nombre')
  return data ?? []
}

export async function getSeccionesConAspectos(): Promise<
  { id: string; gestion_id: string; title: string; aspectos: string[] }[]
> {
  const { supabase } = await getUser()
  const [secRes, relRes] = await Promise.all([
    supabase.from('formulario_secciones').select('id, gestion_id, title').order('title'),
    supabase.from('formulario_seccion_aspectos').select('section_id, aspecto_id'),
  ])
  const idx = new Map<string, string[]>()
  for (const r of relRes.data ?? []) {
    const arr = idx.get(r.section_id) ?? []
    arr.push(r.aspecto_id)
    idx.set(r.section_id, arr)
  }
  return (secRes.data ?? []).map(s => ({ ...s, aspectos: idx.get(s.id) ?? [] }))
}

export async function toggleSeccionAspecto(
  sectionId: string,
  aspectoId: string,
  active: boolean,
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  if (active) {
    const { error } = await supabase.from('formulario_seccion_aspectos').upsert(
      { section_id: sectionId, aspecto_id: aspectoId },
      { onConflict: 'section_id,aspecto_id', ignoreDuplicates: true },
    )
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase.from('formulario_seccion_aspectos').delete()
      .eq('section_id', sectionId).eq('aspecto_id', aspectoId)
    if (error) return { success: false, error: error.message }
  }
  return { success: true, data: null }
}

// ─── DOCUMENTACIÓN ↔ TIPOS DE ESTABLECIMIENTO ───
export async function getDocumentoTiposConTipos(): Promise<
  { id: string; nombre: string; tipos: string[] }[]
> {
  const { supabase } = await getUser()
  const [docRes, relRes] = await Promise.all([
    supabase.from('documento_tipos').select('id, nombre').order('nombre'),
    supabase.from('documentacion_tipos_establecimiento').select('documento_tipo_id, tipo_establecimiento_id'),
  ])
  const idx = new Map<string, string[]>()
  for (const r of relRes.data ?? []) {
    const arr = idx.get(r.documento_tipo_id) ?? []
    arr.push(r.tipo_establecimiento_id)
    idx.set(r.documento_tipo_id, arr)
  }
  return (docRes.data ?? []).map(d => ({ id: d.id, nombre: d.nombre, tipos: idx.get(d.id) ?? [] }))
}

export async function toggleDocumentoTipo(
  documentoTipoId: string,
  tipoId: string,
  active: boolean,
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  if (active) {
    const { error } = await supabase.from('documentacion_tipos_establecimiento').upsert(
      { documento_tipo_id: documentoTipoId, tipo_establecimiento_id: tipoId },
      { onConflict: 'documento_tipo_id,tipo_establecimiento_id', ignoreDuplicates: true },
    )
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase.from('documentacion_tipos_establecimiento').delete()
      .eq('documento_tipo_id', documentoTipoId).eq('tipo_establecimiento_id', tipoId)
    if (error) return { success: false, error: error.message }
  }
  return { success: true, data: null }
}
