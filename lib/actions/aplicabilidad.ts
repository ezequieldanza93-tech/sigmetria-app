'use server'

import { createClient } from '@/lib/supabase/server'
import type { Gestion, DocumentType } from '@/lib/types'

export async function getGestionesAplicables(establecimientoId: string): Promise<Gestion[]> {
  const supabase = await createClient()

  const [estResult, todasResult] = await Promise.all([
    supabase.from('establecimientos').select('tipo_id, aplica_iso_45001').eq('id', establecimientoId).single(),
    supabase.from('gestiones').select('id, nombre, categoria_id, descripcion, created_at, aplica_por_iso, gestiones_categorias(nombre, gestiones_grupos(nombre))').order('nombre'),
  ])

  const establecimiento = estResult.data
  if (!establecimiento) return []

  // La columna del tipo de establecimiento es `tipo_id` (no tipo_establecimiento_id,
  // que es la columna FK en la tabla junction gestiones_tipos_establecimiento).
  const tipoId = establecimiento.tipo_id
  const aplicaIso = establecimiento.aplica_iso_45001

  const { data: gestionIds } = await supabase
    .from('gestiones_tipos_establecimiento')
    .select('gestion_id')
    .eq('tipo_establecimiento_id', tipoId)

  const idsPorTipo = new Set((gestionIds ?? []).map(r => r.gestion_id))

  const todas = todasResult.data
  if (!todas) return []

  return (todas as unknown as Gestion[]).filter(g =>
    idsPorTipo.has(g.id) || (aplicaIso && g.aplica_por_iso)
  )
}

export async function getDocTiposAplicables(establecimientoId: string): Promise<DocumentType[]> {
  const supabase = await createClient()

  const [estResult, todosResult] = await Promise.all([
    supabase.from('establecimientos').select('tipo_id, aplica_iso_45001').eq('id', establecimientoId).single(),
    supabase.from('documentos_tipos').select('id, nombre, descripcion, aplica_empresa, aplica_establecimiento, aplica_empleado, aplica_por_iso, is_active, periodicidad, categoria_legajo').eq('is_active', true).eq('aplica_establecimiento', true).order('nombre'),
  ])

  const establecimiento = estResult.data
  if (!establecimiento) return []

  const tipoId = establecimiento.tipo_id
  const aplicaIso = establecimiento.aplica_iso_45001

  const { data: porTipo } = await supabase
    .from('documentos_tipos_reglas')
    .select('documento_tipo_id')
    .eq('tipo_establecimiento_id', tipoId)

  const idsPorTipo = new Set((porTipo ?? []).map(r => r.documento_tipo_id))

  const todos = todosResult.data
  if (!todos) return []

  return (todos as unknown as DocumentType[]).filter(dt =>
    idsPorTipo.has(dt.id) || (aplicaIso && dt.aplica_por_iso)
  )
}

/**
 * Devuelve los `documento_tipo_id` aplicables a una EMPRESA según su rubro.
 *
 * Lee `empresas.rubro_id` y filtra `documentos_tipos_reglas` por
 * `rubro_empresa_id` (dimensión empresa del CHECK exactly_one_dimension).
 *
 * Devuelve solo el conjunto de ids — el consumidor (getLegajoEsperados) lo
 * intersecta con su catálogo curado por categoría y aplica el fallback.
 *
 * Si la empresa no tiene `rubro_id`, devuelve [] (sin rubro no hay filtro
 * posible → el consumidor cae a la lista curada completa).
 */
export async function getDocTiposAplicablesEmpresa(empresaId: string): Promise<string[]> {
  const supabase = await createClient()

  const { data: empresa } = await supabase
    .from('empresas')
    .select('rubro_id')
    .eq('id', empresaId)
    .single()

  const rubroId = empresa?.rubro_id
  if (!rubroId) return []

  const { data: porRubro } = await supabase
    .from('documentos_tipos_reglas')
    .select('documento_tipo_id')
    .eq('rubro_empresa_id', rubroId)

  return Array.from(new Set((porRubro ?? []).map(r => r.documento_tipo_id as string)))
}
