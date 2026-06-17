'use server'

/**
 * Acciones del catálogo GLOBAL de documentos (documentos_tipos).
 * Solo staff/developer puede editar; cualquier miembro autenticado puede leer.
 *
 * Fase 1 — Legajo Técnico:
 *   - Leer el catálogo con los campos nuevos (nivel, vigencia_tipo, jurisdiccion, etc.)
 *   - Actualizar la configuración de un tipo de documento
 *   - Leer/setear la matriz de aplicabilidad por tipo de establecimiento
 *   - Leer los tipos de establecimiento disponibles
 */

import { createClient } from '@/lib/supabase/server'
import type {
  ActionResult,
  DocumentoTipoConfig,
  TipoEstablecimientoItem,
  NivelDocumento,
  VigenciaTipo,
  Jurisdiccion,
  PeriodicidadDocumento,
  PreguntaRiesgoItem,
  NormaItem,
} from '@/lib/types'

async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, user }
}

// ─── Lectura ────────────────────────────────────────────────

/**
 * Devuelve el catálogo completo de tipos de documento con los campos
 * de Fase 1 y los IDs de tipos de establecimiento asociados.
 */
export async function getDocumentosTiposConfig(): Promise<ActionResult<DocumentoTipoConfig[]>> {
  const { supabase } = await getUser()

  const { data: tipos, error } = await supabase
    .from('documentos_tipos')
    .select(
      `id, nombre, descripcion, aplica_empresa, aplica_establecimiento, aplica_empleado,
       pais_id, categoria_legajo, periodicidad, is_active,
       nivel, vigencia_tipo, jurisdiccion, jurisdiccion_provincia, jurisdiccion_municipio,
       requiere_alerta, dias_alerta,
       requiere_pregunta, pregunta_sugerida, pregunta_id, norma_id`
    )
    .order('nombre', { ascending: true })

  if (error) return { success: false, error: error.message }

  // Traer la matriz de aplicabilidad en una sola query
  const { data: matriz, error: matrizError } = await supabase
    .from('documentos_tipos_tipos_establecimiento')
    .select('documento_tipo_id, tipo_establecimiento_id')

  if (matrizError) return { success: false, error: matrizError.message }

  // Indexar la matriz por documento_tipo_id
  const matrizIdx = new Map<string, string[]>()
  for (const fila of matriz ?? []) {
    const list = matrizIdx.get(fila.documento_tipo_id) ?? []
    list.push(fila.tipo_establecimiento_id)
    matrizIdx.set(fila.documento_tipo_id, list)
  }

  const result: DocumentoTipoConfig[] = (tipos ?? []).map(t => ({
    ...(t as {
      id: string
      nombre: string
      descripcion: string | null
      aplica_empresa: boolean
      aplica_establecimiento: boolean
      aplica_empleado: boolean
      pais_id: string | null
      categoria_legajo: string | null
      periodicidad: PeriodicidadDocumento | null
      is_active: boolean
      nivel: NivelDocumento | null
      vigencia_tipo: VigenciaTipo | null
      jurisdiccion: Jurisdiccion | null
      jurisdiccion_provincia: string | null
      jurisdiccion_municipio: string | null
      requiere_alerta: boolean
      dias_alerta: number
      requiere_pregunta: boolean
      pregunta_sugerida: string | null
      pregunta_id: string | null
      norma_id: string | null
    }),
    tipos_establecimiento_ids: matrizIdx.get(t.id) ?? [],
  }))

  return { success: true, data: result }
}

/** Devuelve todos los tipos de establecimiento disponibles. */
export async function getTiposEstablecimiento(): Promise<ActionResult<TipoEstablecimientoItem[]>> {
  const { supabase } = await getUser()

  const { data, error } = await supabase
    .from('establecimientos_tipos')
    .select('id, codigo, nombre')
    .order('nombre', { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as unknown as TipoEstablecimientoItem[] }
}

/** Preguntas de riesgo del alta (para vincular un documento condicional). */
export async function getPreguntasRiesgo(): Promise<ActionResult<PreguntaRiesgoItem[]>> {
  const { supabase } = await getUser()
  const { data, error } = await supabase
    .from('riesgos_preguntas')
    .select('id, codigo, texto')
    .eq('is_active', true)
    .order('codigo', { ascending: true })
  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as unknown as PreguntaRiesgoItem[] }
}

/** Normas de la matriz legal (para el selector de FK del documento). */
export async function getNormas(): Promise<ActionResult<NormaItem[]>> {
  const { supabase } = await getUser()
  const { data, error } = await supabase
    .from('normativa_normas')
    .select('id, tipo, numero, anio, titulo, estado')
    .order('tipo', { ascending: true })
    .order('numero', { ascending: true })
  if (error) return { success: false, error: error.message }
  const rows = (data ?? []) as unknown as {
    id: string; tipo: string | null; numero: string | null; anio: number | null
    titulo: string | null; estado: string | null
  }[]
  const items: NormaItem[] = rows.map(n => {
    const ref = [n.tipo, [n.numero, n.anio].filter(Boolean).join('/')].filter(Boolean).join(' ')
    const titulo = n.titulo ? ` — ${n.titulo}` : ''
    const estado = n.estado && n.estado !== 'Vigente' ? ` (${n.estado})` : ''
    return { id: n.id, etiqueta: `${ref}${titulo}${estado}`.trim() || 'Norma sin nombre' }
  })
  return { success: true, data: items }
}

// ─── Escritura ───────────────────────────────────────────────

export interface UpdateDocumentoTipoConfigInput {
  nivel?: NivelDocumento | null
  vigencia_tipo?: VigenciaTipo | null
  jurisdiccion?: Jurisdiccion | null
  jurisdiccion_provincia?: string | null
  jurisdiccion_municipio?: string | null
  requiere_alerta?: boolean
  dias_alerta?: number
  periodicidad?: PeriodicidadDocumento | null
  requiere_pregunta?: boolean
  pregunta_sugerida?: string | null
  pregunta_id?: string | null
  norma_id?: string | null
}

/**
 * Actualiza los campos de configuración (Fase 1) de un tipo de documento.
 * Solo staff/developer puede editar el catálogo global (RLS).
 */
export async function updateDocumentoTipoConfig(
  documentoTipoId: string,
  updates: UpdateDocumentoTipoConfigInput
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()

  // Limpieza: si jurisdiccion cambia a nacional, limpiar provincia/municipio
  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
  if (updates.jurisdiccion === 'nacional') {
    patch.jurisdiccion_provincia = null
    patch.jurisdiccion_municipio = null
  }
  if (updates.jurisdiccion === 'provincial') {
    patch.jurisdiccion_municipio = null
  }
  if (updates.jurisdiccion === 'municipal') {
    patch.jurisdiccion_provincia = null
  }

  const { error } = await supabase
    .from('documentos_tipos')
    .update(patch)
    .eq('id', documentoTipoId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

/**
 * Reemplaza la lista de tipos de establecimiento para un documento.
 * Si tipoIds está vacío → borra todas las filas (= aplica a todos).
 * Operación: DELETE existing + INSERT nuevos (en una transacción implícita por RLS).
 */
export async function setAplicabilidadTiposEstablecimiento(
  documentoTipoId: string,
  tipoIds: string[]
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()

  // Borrar filas existentes para este documento_tipo
  const { error: deleteError } = await supabase
    .from('documentos_tipos_tipos_establecimiento')
    .delete()
    .eq('documento_tipo_id', documentoTipoId)

  if (deleteError) return { success: false, error: deleteError.message }

  // Si no hay tipos seleccionados → significa "aplica a todos", no hay filas que insertar
  if (tipoIds.length === 0) return { success: true, data: null }

  const rows = tipoIds.map(tipo_establecimiento_id => ({
    documento_tipo_id: documentoTipoId,
    tipo_establecimiento_id,
  }))

  const { error: insertError } = await supabase
    .from('documentos_tipos_tipos_establecimiento')
    .insert(rows)

  if (insertError) return { success: false, error: insertError.message }
  return { success: true, data: null }
}
