'use server'

/**
 * Mapeo actividad económica (CIIU) → tipo de documento.
 *
 * Semántica (clave, espejada de normativa_normas_actividades):
 *   un tipo de documento SIN filas en documentos_tipos_actividades se espera para
 *   TODAS las actividades (comportamiento por defecto); CON filas, solo para esas.
 *   No hay flag aparte: la presencia/ausencia de filas es la regla.
 *
 * Escritura gateada por RLS a public.puede_gestionar_librerias()
 * (super-admin + flag gestiona_librerias_base).
 */

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export interface ActividadCiiuItem {
  id: string
  codigo: string
  nombre: string
  seccion: string | null
}

async function getSupabase() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return supabase
}

// ─── Lectura ────────────────────────────────────────────────

/**
 * Catálogo de actividades económicas (CIIU) activas, ordenadas por código.
 * Cada fila: { id, codigo (2 dígitos = división), nombre, seccion (letra A–U) }.
 */
export async function getActividadesCiiu(): Promise<ActionResult<ActividadCiiuItem[]>> {
  const supabase = await getSupabase()

  const { data, error } = await supabase
    .from('actividades_economicas')
    .select('id, codigo, nombre, seccion')
    .eq('is_active', true)
    .order('codigo', { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as unknown as ActividadCiiuItem[] }
}

/**
 * IDs de las actividades asignadas a un tipo de documento.
 * Lista vacía = el documento se espera para TODAS las actividades.
 */
export async function getActividadesDeDocumentoTipo(
  docTipoId: string
): Promise<ActionResult<string[]>> {
  const supabase = await getSupabase()

  const { data, error } = await supabase
    .from('documentos_tipos_actividades')
    .select('actividad_id')
    .eq('documento_tipo_id', docTipoId)

  if (error) return { success: false, error: error.message }
  const ids = (data ?? []).map((r) => (r as { actividad_id: string }).actividad_id)
  return { success: true, data: ids }
}

// ─── Escritura ───────────────────────────────────────────────

/**
 * Reemplaza el set de actividades de un tipo de documento (borra + inserta).
 * actividadIds vacío → borra todas las filas (= se espera para todas las actividades).
 */
export async function setActividadesDocumentoTipo(
  docTipoId: string,
  actividadIds: string[]
): Promise<ActionResult<null>> {
  const supabase = await getSupabase()

  const { error: deleteError } = await supabase
    .from('documentos_tipos_actividades')
    .delete()
    .eq('documento_tipo_id', docTipoId)

  if (deleteError) return { success: false, error: deleteError.message }

  // Sin actividades = "se espera para todas" → no hay filas que insertar.
  if (actividadIds.length === 0) return { success: true, data: null }

  // Deduplicar por si la UI manda repetidos (la UNIQUE igual lo cubre).
  const unicos = Array.from(new Set(actividadIds))
  const rows = unicos.map((actividad_id) => ({
    documento_tipo_id: docTipoId,
    actividad_id,
  }))

  const { error: insertError } = await supabase
    .from('documentos_tipos_actividades')
    .insert(rows)

  if (insertError) return { success: false, error: insertError.message }
  return { success: true, data: null }
}
