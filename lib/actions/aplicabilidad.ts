'use server'

import { createClient } from '@/lib/supabase/server'

interface Gestion {
  id: string
  nombre: string
  categoria_gestiones: { nombre: string; grupo_gestiones: { nombre: string } | null } | null
}

interface DocumentType {
  id: string
  nombre: string
  aplica_empresa: boolean
  aplica_establecimiento: boolean
  aplica_empleado: boolean
  aplica_por_iso: boolean
  is_active: boolean
}

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
    .from('gestion_tipos_establecimiento')
    .select('gestion_id')
    .eq('tipo_establecimiento_id', tipoId)

  const idsPorTipo = new Set((gestionIds ?? []).map(r => r.gestion_id))

  const { data: todas } = await supabase
    .from('gestiones')
    .select('id, nombre, aplica_por_iso, categoria_gestiones(nombre, grupo_gestiones(nombre))')
    .order('nombre')

  if (!todas) return []

  return (todas as unknown as (Gestion & { aplica_por_iso: boolean })[]).filter(g =>
    idsPorTipo.has(g.id) || (aplicaIso && g.aplica_por_iso)
  )
}

export async function getDocTiposAplicables(
  establecimientoId: string,
  empresaId?: string,
): Promise<DocumentType[]> {
  const supabase = await createClient()

  const { data: establecimiento } = await supabase
    .from('establecimientos')
    .select('tipo_establecimiento_id, aplica_iso_45001')
    .eq('id', establecimientoId)
    .single()

  if (!establecimiento) return []

  const tipoId = establecimiento.tipo_establecimiento_id
  const aplicaIso = establecimiento.aplica_iso_45001

  let rubroEmpresaId: string | null = null
  if (empresaId) {
    const { data: empresa } = await supabase
      .from('empresas')
      .select('rubro_empresa_id')
      .eq('id', empresaId)
      .single()
    rubroEmpresaId = empresa?.rubro_empresa_id ?? null
  }

  // Get doc IDs by tipo_establecimiento
  const { data: porTipo } = await supabase
    .from('documentacion_tipos_establecimiento')
    .select('documento_tipo_id')
    .eq('tipo_establecimiento_id', tipoId)

  // Get doc IDs by rubro
  let porRubro: { documento_tipo_id: string }[] = []
  if (rubroEmpresaId) {
    const { data: d } = await supabase
      .from('documentacion_rubros_empresa')
      .select('documento_tipo_id')
      .eq('rubro_empresa_id', rubroEmpresaId)
    porRubro = d ?? []
  }

  const idsPorTipo = new Set((porTipo ?? []).map(r => r.documento_tipo_id))
  const idsPorRubro = new Set(porRubro.map(r => r.documento_tipo_id))

  const { data: todos } = await supabase
    .from('documento_tipos')
    .select('id, nombre, aplica_empresa, aplica_establecimiento, aplica_empleado, aplica_por_iso, is_active')
    .eq('is_active', true)
    .eq('aplica_establecimiento', true)
    .order('nombre')

  if (!todos) return []

  const items = todos as unknown as DocumentType[]

  return items.filter(dt =>
    idsPorTipo.has(dt.id) ||
    idsPorRubro.has(dt.id) ||
    (aplicaIso && dt.aplica_por_iso)
  )
}
