'use server'

import { createClient } from '@/lib/supabase/server'
import { getMedicionIluminacion } from '@/lib/actions/medicion-iluminacion'
import type { ActionResult } from '@/lib/types'

/**
 * Lectura del Protocolo de Medición de Iluminación (SRT 84/2012) DESDE LA FILA
 * PLANIFICADA, para la vista read-only "Ver reporte" de la Agenda.
 *
 * Mismo patrón que getMedicionCargaTermicaByRegistro: la Agenda solo conoce el
 * registro planificado (gestiones_registros.id + fecha_planificada). La cabecera
 * referencia su registro en forma SUELTA (registro_gestion_id + rg_fecha_planificada,
 * sin FK dura — tabla gestiones_registros está PARTICIONADA). Resolvemos esa
 * referencia → id de la cabecera, y delegamos en getMedicionIluminacion para el
 * detalle completo (cabecera + puntos + celdas + joins).
 *
 * Read-only: ningún write.
 */
export async function getMedicionIluminacionByRegistro(
  registroId: string,
  rgFechaPlanificada: string | null,
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!registroId) return { success: false, error: 'Registro requerido' }

  let query = supabase
    .from('medicion_iluminacion')
    .select('id')
    .eq('registro_gestion_id', registroId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) query = query.eq('rg_fecha_planificada', rgFechaPlanificada)

  const { data, error } = await query.maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'No se encontró el protocolo de iluminación para este registro' }

  return getMedicionIluminacion(data.id as string)
}
