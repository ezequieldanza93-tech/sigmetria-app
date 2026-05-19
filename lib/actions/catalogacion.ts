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
export interface GestionRow {
  id: string
  nombre: string
  tipos: string[]
  isoMap: Record<string, boolean>
}

export async function getGestionesConTipos(): Promise<GestionRow[]> {
  const { supabase } = await getUser()
  const [gesRes, relRes] = await Promise.all([
    supabase.from('gestiones').select('id, nombre').order('nombre'),
    supabase.from('gestion_tipos_establecimiento').select('gestion_id, tipo_establecimiento_id, aplica_iso_45001'),
  ])
  const idx = new Map<string, string[]>()
  const iso = new Map<string, Record<string, boolean>>()
  for (const r of relRes.data ?? []) {
    const arr = idx.get(r.gestion_id) ?? []
    arr.push(r.tipo_establecimiento_id)
    idx.set(r.gestion_id, arr)
    const map = iso.get(r.gestion_id) ?? {}
    map[r.tipo_establecimiento_id] = r.aplica_iso_45001
    iso.set(r.gestion_id, map)
  }
  return (gesRes.data ?? []).map(g => ({
    id: g.id, nombre: g.nombre,
    tipos: idx.get(g.id) ?? [],
    isoMap: iso.get(g.id) ?? {},
  }))
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

export async function toggleIsoGestionTipo(
  gestionId: string,
  tipoId: string,
  aplicaIso: boolean,
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  const { error } = await supabase
    .from('gestion_tipos_establecimiento')
    .update({ aplica_iso_45001: aplicaIso })
    .eq('gestion_id', gestionId)
    .eq('tipo_establecimiento_id', tipoId)
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
  isoMap: Record<string, boolean>
}

export async function getSeccionesConAspectos(): Promise<SeccionRow[]> {
  const { supabase } = await getUser()
  const [secRes, relRes] = await Promise.all([
    supabase.from('formulario_secciones').select('id, gestion_id, title').order('title'),
    supabase.from('formulario_seccion_aspectos').select('section_id, aspecto_id, aplica_iso_45001'),
  ])
  const idx = new Map<string, string[]>()
  const iso = new Map<string, Record<string, boolean>>()
  for (const r of relRes.data ?? []) {
    const arr = idx.get(r.section_id) ?? []
    arr.push(r.aspecto_id)
    idx.set(r.section_id, arr)
    const map = iso.get(r.section_id) ?? {}
    map[r.aspecto_id] = r.aplica_iso_45001
    iso.set(r.section_id, map)
  }
  return (secRes.data ?? []).map(s => ({
    ...s,
    aspectos: idx.get(s.id) ?? [],
    isoMap: iso.get(s.id) ?? {},
  }))
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

export async function toggleIsoSeccionAspecto(
  sectionId: string,
  aspectoId: string,
  aplicaIso: boolean,
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  const { error } = await supabase
    .from('formulario_seccion_aspectos')
    .update({ aplica_iso_45001: aplicaIso })
    .eq('section_id', sectionId)
    .eq('aspecto_id', aspectoId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

// ─── DOCUMENTACIÓN ↔ TIPOS DE ESTABLECIMIENTO ───
export interface DocumentoRow {
  id: string
  nombre: string
  tipos: string[]
  isoMap: Record<string, boolean>
}

export async function getDocumentoTiposConTipos(): Promise<DocumentoRow[]> {
  const { supabase } = await getUser()
  const [docRes, relRes] = await Promise.all([
    supabase.from('documento_tipos').select('id, nombre').order('nombre'),
    supabase.from('documentacion_tipos_establecimiento').select('documento_tipo_id, tipo_establecimiento_id, aplica_iso_45001'),
  ])
  const idx = new Map<string, string[]>()
  const iso = new Map<string, Record<string, boolean>>()
  for (const r of relRes.data ?? []) {
    const arr = idx.get(r.documento_tipo_id) ?? []
    arr.push(r.tipo_establecimiento_id)
    idx.set(r.documento_tipo_id, arr)
    const map = iso.get(r.documento_tipo_id) ?? {}
    map[r.tipo_establecimiento_id] = r.aplica_iso_45001
    iso.set(r.documento_tipo_id, map)
  }
  return (docRes.data ?? []).map(d => ({
    id: d.id, nombre: d.nombre,
    tipos: idx.get(d.id) ?? [],
    isoMap: iso.get(d.id) ?? {},
  }))
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

// ─── DOCUMENTACIÓN ↔ RUBROS EMPRESA ───
export async function getRubrosEmpresa() {
  const { supabase } = await getUser()
  const { data } = await supabase.from('rubros_empresa').select('id, nombre').eq('is_active', true).order('nombre')
  return data ?? []
}

export interface DocumentoRubroRow {
  id: string
  nombre: string
  rubros: string[]
  isoMap: Record<string, boolean>
}

export async function getDocTiposConRubros(): Promise<DocumentoRubroRow[]> {
  const { supabase } = await getUser()
  const [docRes, relRes] = await Promise.all([
    supabase.from('documento_tipos').select('id, nombre').order('nombre'),
    supabase.from('documentacion_rubros_empresa').select('documento_tipo_id, rubro_empresa_id, aplica_iso_45001'),
  ])
  const idx = new Map<string, string[]>()
  const iso = new Map<string, Record<string, boolean>>()
  for (const r of relRes.data ?? []) {
    const arr = idx.get(r.documento_tipo_id) ?? []
    arr.push(r.rubro_empresa_id)
    idx.set(r.documento_tipo_id, arr)
    const map = iso.get(r.documento_tipo_id) ?? {}
    map[r.rubro_empresa_id] = r.aplica_iso_45001
    iso.set(r.documento_tipo_id, map)
  }
  return (docRes.data ?? []).map(d => ({
    id: d.id, nombre: d.nombre,
    rubros: idx.get(d.id) ?? [],
    isoMap: iso.get(d.id) ?? {},
  }))
}

export async function toggleDocumentoRubro(
  documentoTipoId: string,
  rubroId: string,
  active: boolean,
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  if (active) {
    const { error } = await supabase.from('documentacion_rubros_empresa').upsert(
      { documento_tipo_id: documentoTipoId, rubro_empresa_id: rubroId },
      { onConflict: 'documento_tipo_id,rubro_empresa_id', ignoreDuplicates: true },
    )
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase.from('documentacion_rubros_empresa').delete()
      .eq('documento_tipo_id', documentoTipoId).eq('rubro_empresa_id', rubroId)
    if (error) return { success: false, error: error.message }
  }
  return { success: true, data: null }
}

export async function toggleIsoDocumentoRubro(
  documentoTipoId: string,
  rubroId: string,
  aplicaIso: boolean,
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  const { error } = await supabase
    .from('documentacion_rubros_empresa')
    .update({ aplica_iso_45001: aplicaIso })
    .eq('documento_tipo_id', documentoTipoId)
    .eq('rubro_empresa_id', rubroId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function toggleIsoDocumentoTipo(
  documentoTipoId: string,
  tipoId: string,
  aplicaIso: boolean,
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  const { error } = await supabase
    .from('documentacion_tipos_establecimiento')
    .update({ aplica_iso_45001: aplicaIso })
    .eq('documento_tipo_id', documentoTipoId)
    .eq('tipo_establecimiento_id', tipoId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
