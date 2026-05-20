'use server'

import { createClient } from '@/lib/supabase/server'
import type { Gestion, DocumentType } from '@/lib/types'

export async function getGestionesAplicables(establecimientoId: string): Promise<Gestion[]> {
  const supabase = await createClient()

  const [estResult, todasResult] = await Promise.all([
    supabase.from('establecimientos').select('tipo_establecimiento_id, aplica_iso_45001').eq('id', establecimientoId).single(),
    supabase.from('gestiones').select('id, nombre, categoria_id, descripcion, created_at, aplica_por_iso, gestiones_categorias(nombre, gestiones_grupos(nombre))').order('nombre'),
  ])

  const establecimiento = estResult.data
  if (!establecimiento) return []

  const tipoId = establecimiento.tipo_establecimiento_id
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
    supabase.from('establecimientos').select('tipo_establecimiento_id, aplica_iso_45001').eq('id', establecimientoId).single(),
    supabase.from('documentos_tipos').select('id, nombre, descripcion, aplica_por_iso, aplica_empresa, aplica_establecimiento, aplica_persona, created_at, frecuencia_dias, tipo_especifico, is_active').eq('is_active', true).eq('aplica_establecimiento', true).order('nombre'),
  ])

  const establecimiento = estResult.data
  if (!establecimiento) return []

  const tipoId = establecimiento.tipo_establecimiento_id
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
