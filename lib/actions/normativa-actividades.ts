'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

// ============================================================
// CIIU manda — Actividades económicas asignadas a una NORMA
//
// SEMÁNTICA (clave): una norma SIN filas en normativa_normas_actividades
// aplica a TODAS las actividades; CON filas, solo a esas. No hay flag aparte.
//
// La RLS de normativa_normas_actividades es el firewall real (espeja
// puede_gestionar_librerias() para base / is_active_member_of() para propias).
// Acá no pre-validamos permisos: dejamos que la RLS rechace lo que no corresponde.
// ============================================================

export interface ActividadCiiu {
  id: string
  codigo: string
  nombre: string
  seccion: string | null
}

const REVALIDATE_PATH = '/dashboard/configuracion/normativa-legal'

/**
 * Catálogo CIIU activo, ordenado por código (división de 2 dígitos).
 * 60 filas aprox. La sección (letra A–U) agrupa divisiones.
 */
export async function getActividadesCiiu(): Promise<ActionResult<ActividadCiiu[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('actividades_economicas')
    .select('id, codigo, nombre, seccion')
    .eq('is_active', true)
    .order('codigo', { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as ActividadCiiu[] }
}

/**
 * IDs de actividades asignadas a una norma. Array vacío = aplica a todas.
 */
export async function getActividadesDeNorma(normaId: string): Promise<ActionResult<string[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('normativa_normas_actividades')
    .select('actividad_id')
    .eq('norma_id', normaId)

  if (error) return { success: false, error: error.message }
  const ids = (data ?? []).map((r) => (r as { actividad_id: string }).actividad_id)
  return { success: true, data: ids }
}

/**
 * Reemplaza el conjunto de actividades de una norma: borra todas las filas
 * existentes e inserta las que vengan. Pasar [] deja la norma "aplica a todas".
 * La RLS controla permisos (base vs propia).
 */
export async function setActividadesNorma(
  normaId: string,
  actividadIds: string[],
): Promise<ActionResult<null>> {
  const supabase = await createClient()

  // Borrar el set actual de esa norma.
  const { error: delError } = await supabase
    .from('normativa_normas_actividades')
    .delete()
    .eq('norma_id', normaId)

  if (delError) return { success: false, error: delError.message }

  // Insertar el nuevo set (deduplicado). Vacío = aplica a todas → no insertamos.
  const unicos = [...new Set(actividadIds)]
  if (unicos.length > 0) {
    const rows = unicos.map((actividad_id) => ({ norma_id: normaId, actividad_id }))
    const { error: insError } = await supabase
      .from('normativa_normas_actividades')
      .insert(rows)

    if (insError) return { success: false, error: insError.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: null }
}
