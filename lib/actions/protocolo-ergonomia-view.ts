'use server'

import { createClient } from '@/lib/supabase/server'
import { getProtocoloErgonomia } from '@/lib/actions/protocolo-ergonomia'
import type { ActionResult } from '@/lib/types'
import type { ErgonomiaEvaluacionDetalle } from '@/lib/types'

/**
 * Lectura del Protocolo de Ergonomía DESDE LA FILA PLANIFICADA, para la vista
 * read-only "Ver reporte" de la Agenda.
 *
 * Mismo patrón que getMedicionCargaTermicaByRegistro / getMedicionPatByRegistro:
 * la Agenda solo conoce el registro planificado (gestiones_registros.id +
 * fecha_planificada). Resolvemos la referencia suelta → id de la cabecera →
 * delegamos en getProtocoloErgonomia para el detalle completo.
 */
export async function getProtocoloErgonomiaByRegistro(
  registroId: string,
  rgFechaPlanificada: string | null,
): Promise<ActionResult<ErgonomiaEvaluacionDetalle>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!registroId) return { success: false, error: 'Registro requerido' }

  let query = supabase
    .from('ergonomia_evaluaciones')
    .select('id')
    .eq('registro_gestion_id', registroId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) query = query.eq('rg_fecha_planificada', rgFechaPlanificada)

  const { data, error } = await query.maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'No se encontró el protocolo de ergonomía para este registro' }

  return getProtocoloErgonomia(data.id as string)
}
