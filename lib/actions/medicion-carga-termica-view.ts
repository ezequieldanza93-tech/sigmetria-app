'use server'

import { createClient } from '@/lib/supabase/server'
import { getMedicionCargaTermica } from '@/lib/actions/medicion-carga-termica'
import type { ActionResult } from '@/lib/types'

/**
 * Lectura del Protocolo de Estrés Térmico / Carga Térmica (SRT 30/2023) DESDE
 * LA FILA PLANIFICADA, para la vista read-only "Ver reporte" de la Agenda.
 *
 * Mismo patrón que getMedicionPatByRegistro: la Agenda solo conoce el registro
 * planificado (gestiones_registros.id + fecha_planificada). La cabecera referencia
 * su registro en forma SUELTA (registro_gestion_id + rg_fecha_planificada, sin FK
 * dura — tabla gestiones_registros está PARTICIONADA). Resolvemos esa referencia
 * → id de la cabecera, y delegamos en getMedicionCargaTermica para el detalle
 * completo (cabecera + puestos + períodos + tareas + joins).
 *
 * Read-only: ningún write. La RLS de SELECT de medicion_carga_termica
 * (por establecimiento) gobierna el acceso.
 */
export async function getMedicionCargaTermicaByRegistro(
  registroId: string,
  rgFechaPlanificada: string | null,
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!registroId) return { success: false, error: 'Registro requerido' }

  // Resolución de la referencia suelta → id de la cabecera más reciente para ese
  // registro. Acotamos por rg_fecha_planificada cuando la UI lo provee (completa la
  // PK compuesta del registro particionado).
  let query = supabase
    .from('medicion_carga_termica')
    .select('id')
    .eq('registro_gestion_id', registroId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) query = query.eq('rg_fecha_planificada', rgFechaPlanificada)

  const { data, error } = await query.maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'No se encontró el protocolo de carga térmica para este registro' }

  // Detalle completo (cabecera + puestos + períodos + tareas + joins) reusando la
  // lectura existente.
  return getMedicionCargaTermica(data.id as string)
}

/**
 * Lectura del BORRADOR (estado = 'borrador') de carga térmica para RE-HIDRATAR el
 * wizard del ejecutor. Devuelve el detalle completo (mismo shape que
 * getMedicionCargaTermica) o { success: false } si no hay borrador para ese registro.
 *
 * A diferencia de getMedicionCargaTermicaByRegistro (que trae la cabecera más reciente
 * sea cual sea su estado, para la vista read-only), acá filtramos por estado='borrador'
 * para que el modal NO intente re-editar un protocolo ya finalizado. Si el registro solo
 * tiene una medición finalizada, esta función devuelve "no encontrado" y el wizard
 * arranca vacío como en un alta.
 */
export async function getBorradorCargaTermicaByRegistro(
  registroId: string,
  rgFechaPlanificada: string | null,
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!registroId) return { success: false, error: 'Registro requerido' }

  let query = supabase
    .from('medicion_carga_termica')
    .select('id')
    .eq('registro_gestion_id', registroId)
    .eq('estado', 'borrador')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) query = query.eq('rg_fecha_planificada', rgFechaPlanificada)

  const { data, error } = await query.maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Sin borrador' }

  return getMedicionCargaTermica(data.id as string)
}
