'use server'

import { createClient } from '@/lib/supabase/server'
import type { Gestion, DocumentType } from '@/lib/types'

export async function getGestionesAplicables(establecimientoId: string): Promise<Gestion[]> {
  const supabase = await createClient()

  const { data: establecimiento } = await supabase
    .from('establecimientos')
    .select('tipo_establecimiento_id, aplica_iso_45001')
    .eq('id', establecimientoId)
    .single()

  if (!establecimiento) return []

  const tipoId = establecimiento.tipo_establecimiento_id
  const aplicaIso = establecimiento.aplica_iso_45001

  const { data: gestionIds } = await supabase
    .from('gestiones_tipos_establecimiento')
    .select('gestion_id')
    .eq('tipo_establecimiento_id', tipoId)

  const idsPorTipo = new Set((gestionIds ?? []).map(r => r.gestion_id))

  const { data: todas } = await supabase
    .from('gestiones')
    .select('*, gestiones_categorias(nombre, gestiones_grupos(nombre))')
    .order('nombre')

  if (!todas) return []

  return (todas as unknown as Gestion[]).filter(g =>
    idsPorTipo.has(g.id) || (aplicaIso && g.aplica_por_iso)
  )
}

export async function getDocTiposAplicables(establecimientoId: string): Promise<DocumentType[]> {
  const supabase = await createClient()

  const { data: establecimiento } = await supabase
    .from('establecimientos')
    .select('tipo_establecimiento_id, aplica_iso_45001')
    .eq('id', establecimientoId)
    .single()

  if (!establecimiento) return []

  const tipoId = establecimiento.tipo_establecimiento_id
  const aplicaIso = establecimiento.aplica_iso_45001

  const { data: porTipo } = await supabase
    .from('documentacion_tipos_establecimiento')
    .select('documento_tipo_id')
    .eq('tipo_establecimiento_id', tipoId)

  const idsPorTipo = new Set((porTipo ?? []).map(r => r.documento_tipo_id))

  const { data: todos } = await supabase
    .from('documento_tipos')
    .select('*')
    .eq('is_active', true)
    .eq('aplica_establecimiento', true)
    .order('nombre')

  if (!todos) return []

  return (todos as unknown as DocumentType[]).filter(dt =>
    idsPorTipo.has(dt.id) || (aplicaIso && dt.aplica_por_iso)
  )
}

  const { data: porTipo } = await supabase
    .from('establecimientos_tipos_documentos')
    .select('documento_tipo_id')
    .eq('tipo_establecimiento_id', tipoId)

  let porRubro: { documento_tipo_id: string }[] = []
  if (rubroEmpresaId) {
    const { data: d } = await supabase
      .from('empresas_rubros_documentos')
      .select('documento_tipo_id')
      .eq('rubro_empresa_id', rubroEmpresaId)
    porRubro = d ?? []
  }

  const idsPorTipo = new Set((porTipo ?? []).map(r => r.documento_tipo_id))
  const idsPorRubro = new Set(porRubro.map(r => r.documento_tipo_id))

  const { data: todos } = await supabase
    .from('documentos_tipos')
    .select('*')
    .eq('is_active', true)
    .eq('aplica_establecimiento', true)
    .order('nombre')

  if (!todos) return []

  return (todos as unknown as DocumentType[]).filter(dt =>
    idsPorTipo.has(dt.id) ||
    idsPorRubro.has(dt.id) ||
    (aplicaIso && dt.aplica_por_iso)
  )
}
