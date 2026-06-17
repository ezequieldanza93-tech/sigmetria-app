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

  // Matriz NUEVA de aplicabilidad (documentos_tipos_tipos_establecimiento).
  // Semántica curada en la pantalla del catálogo:
  //   doc SIN filas  = aplica a TODOS los tipos de establecimiento.
  //   doc CON filas  = aplica SOLO a los tipos listados.
  const { data: matriz } = await supabase
    .from('documentos_tipos_tipos_establecimiento')
    .select('documento_tipo_id, tipo_establecimiento_id')

  const restringidos = new Set<string>()       // docs con al menos una fila (= acotados)
  const permitidosParaTipo = new Set<string>() // docs con fila para ESTE tipo
  for (const r of (matriz ?? []) as { documento_tipo_id: string; tipo_establecimiento_id: string }[]) {
    restringidos.add(r.documento_tipo_id)
    if (r.tipo_establecimiento_id === tipoId) permitidosParaTipo.add(r.documento_tipo_id)
  }

  const todos = todosResult.data
  if (!todos) return []

  return (todos as unknown as DocumentType[]).filter(dt =>
    !restringidos.has(dt.id)             // sin restricción → aplica a todos
    || permitidosParaTipo.has(dt.id)     // acotado, pero incluye este tipo
    || (aplicaIso && dt.aplica_por_iso)  // override por ISO 45001
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
export async function getDocTiposAplicablesEmpresa(_empresaId: string): Promise<string[]> {
  // Modelo nuevo: el catálogo curado NO filtra los documentos de nivel empresa
  // por rubro — todos los docs de empresa aplican a toda empresa. Devolver []
  // hace que getLegajoEsperados use la lista curada completa (fallback) para las
  // categorías empresa / empresa_por_establecimiento.
  return []
}
