'use server'

import { createClient } from '@/lib/supabase/server'
import { getMedicionPat } from '@/lib/actions/medicion-pat'
import type { ActionResult } from '@/lib/types'

/**
 * Lectura del Protocolo de Puesta a Tierra (PAT — SRT 900/2015) DESDE LA FILA
 * PLANIFICADA, para la vista read-only "Ver reporte" de la Agenda.
 *
 * Por qué existe (y no se reusa getMedicionPat a secas): getMedicionPat(medicionId)
 * recibe el id de `medicion_pat`, pero la Agenda solo conoce el registro planificado
 * (gestiones_registros.id + fecha_planificada). La cabecera referencia su registro de
 * forma SUELTA (registro_gestion_id + rg_fecha_planificada, sin FK dura — ver
 * migración 20260624000001_medicion_pat.sql). Acá resolvemos esa referencia suelta
 * → id de la cabecera, y delegamos en getMedicionPat para traer el detalle completo
 * (cabecera + tomas + joins). NO modifica medicion-pat.ts; lo importa y lo reusa.
 *
 * Read-only: ningún write. La RLS de SELECT de medicion_pat (por establecimiento)
 * gobierna el acceso.
 */
export async function getMedicionPatByRegistro(
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
    .from('medicion_pat')
    .select('id')
    .eq('registro_gestion_id', registroId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) query = query.eq('rg_fecha_planificada', rgFechaPlanificada)

  const { data, error } = await query.maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'No se encontró el protocolo de puesta a tierra para este registro' }

  // Detalle completo (cabecera + tomas + joins) reusando la lectura existente.
  return getMedicionPat(data.id as string)
}
