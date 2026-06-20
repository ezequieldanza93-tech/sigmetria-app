'use server'

/**
 * emitir-evidencia-ruido.ts — Puente entre el motor Chromium y el sistema de evidencia
 * para el Protocolo de Medición de Ruido (Res. SRT 85/2012).
 *
 * Réplica de emitir-evidencia-iluminacion.ts:
 *   1. Resuelve el medicionId a partir del registro de gestión (mismo lookup condicional
 *      que getMedicionRuidoByRegistro: filtra rg_fecha_planificada SOLO si viene; sin deleted_at).
 *   2. Genera el PDF VECTORIAL con el motor genérico (carátula + protocolo + anexos + logos).
 *   3. Lo guarda como EVIDENCIA de la gestión (guardarEvidenciaProtocolo →
 *      gestiones_registros.evidencia_url), subfolder 'mediciones-ruido'.
 *   4. Devuelve un signed URL para descargar/visualizar.
 */

import { createClient } from '@/lib/supabase/server'
import { generarReporteProtocoloRuido } from '@/lib/actions/reporte-protocolo-ruido'
import { guardarEvidenciaProtocolo } from '@/lib/actions/protocolo-evidencia'
import { mergeAdjuntosManuales } from '@/lib/pdf/anexos-manuales'
import type { ActionResult } from '@/lib/types'

export async function emitirEvidenciaRuido(
  registroId: string,
  rgFechaPlanificada: string,
): Promise<ActionResult<{ pdfUrl: string }>> {
  if (!registroId) return { success: false, error: 'registroId requerido' }

  const supabase = await createClient()

  // ── 1. Resolver el medicionId desde el registro de gestión ──────────────────
  // MISMA lógica que getMedicionRuidoByRegistro: filtrar por rg_fecha_planificada SOLO
  // si viene (las gestiones sin fecha planificada se guardan con rg_fecha_planificada =
  // NULL). Tampoco filtramos por deleted_at (la vista de referencia no lo hace).
  let medQuery = supabase
    .from('medicion_ruido')
    .select('id')
    .eq('registro_gestion_id', registroId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) medQuery = medQuery.eq('rg_fecha_planificada', rgFechaPlanificada)

  const { data: med, error: medErr } = await medQuery.maybeSingle()

  if (medErr || !med?.id) {
    console.error('[PDF-EVIDENCIA-RUIDO] medición NO encontrada', { registroId, rgFechaPlanificada, medErr: medErr?.message })
    return { success: false, error: 'No se encontró la medición de ruido de este registro' }
  }

  // ── 2. Generar el PDF con el motor genérico (vectorial) ─────────────────────
  console.warn('[PDF-EVIDENCIA-RUIDO] medición encontrada, generando PDF', { medicionId: med.id })
  const pdfRes = await generarReporteProtocoloRuido(med.id as string)
  if (!pdfRes.success) {
    console.error('[PDF-EVIDENCIA-RUIDO] generarReporte falló', { error: pdfRes.error })
    return { success: false, error: pdfRes.error }
  }
  // Fusionar adjuntos manuales (encomienda / plano / otro) si los hay (best-effort).
  const buffer = await mergeAdjuntosManuales(pdfRes.data as Buffer, registroId, rgFechaPlanificada)
  const base64 = 'data:application/pdf;base64,' + Buffer.from(buffer).toString('base64')

  // ── 3. Guardar como evidencia de la gestión (sistema existente) ─────────────
  const ev = await guardarEvidenciaProtocolo(registroId, base64, 'mediciones-ruido')
  if (!ev.success) {
    console.error('[PDF-EVIDENCIA-RUIDO] guardarEvidencia falló', { error: ev.error })
    return { success: false, error: ev.error }
  }
  console.warn('[PDF-EVIDENCIA-RUIDO] OK, evidencia guardada', { path: ev.path, bytes: buffer.length })

  // ── 4. Signed URL para descargar/visualizar ─────────────────────────────────
  const { data: signed } = await supabase.storage
    .from('documentos')
    .createSignedUrl(ev.path, 60 * 60)

  return { success: true, data: { pdfUrl: signed?.signedUrl ?? '' } }
}
