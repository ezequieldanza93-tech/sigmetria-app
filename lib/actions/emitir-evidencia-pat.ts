'use server'

/**
 * emitir-evidencia-pat.ts — Puente entre el motor Chromium y el sistema de evidencia,
 * para el Protocolo de Puesta a Tierra y Continuidad de las Masas (Res. SRT 900/2015).
 *
 * Clonado de emitir-evidencia-iluminacion.ts:
 *   1. Resuelve el medicionId desde el registro de gestión (mismo lookup condicional que
 *      getMedicionPatByRegistro: filtra rg_fecha_planificada SOLO si viene; sin deleted_at).
 *   2. Genera el PDF VECTORIAL con el motor Chromium (carátula + protocolo + anexos + logos).
 *   3. Lo guarda como EVIDENCIA de la gestión (guardarEvidenciaProtocolo →
 *      gestiones_registros.evidencia_url), subfolder 'mediciones-pat'.
 *   4. Devuelve un signed URL para descargar/visualizar.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { generarReporteProtocoloPat } from '@/lib/actions/reporte-protocolo-pat'
import { guardarEvidenciaProtocolo } from '@/lib/actions/protocolo-evidencia'
import { getAdjuntosManualesComoAnexos } from '@/lib/pdf/anexos-manuales'
import { armarPdfFinalConAnexos } from '@/lib/pdf/ensamblar-anexos'
import type { ActionResult } from '@/lib/types'

export async function emitirEvidenciaPat(
  registroId: string,
  rgFechaPlanificada: string,
): Promise<ActionResult<{ pdfUrl: string }>> {
  if (!registroId) return { success: false, error: 'registroId requerido' }

  const supabase = createServiceClient()

  // ── 1. Resolver el medicionId desde el registro de gestión ──────────────────
  // MISMA lógica que getMedicionPatByRegistro: filtrar por rg_fecha_planificada SOLO
  // si viene (las gestiones sin fecha planificada se guardan con NULL). Sin deleted_at.
  let medQuery = supabase
    .from('medicion_pat')
    .select('id')
    .eq('registro_gestion_id', registroId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) medQuery = medQuery.eq('rg_fecha_planificada', rgFechaPlanificada)

  const { data: med, error: medErr } = await medQuery.maybeSingle()

  if (medErr || !med?.id) {
    console.error('[PDF-EVIDENCIA-PAT] medición NO encontrada', { registroId, rgFechaPlanificada, medErr: medErr?.message })
    return { success: false, error: 'No se encontró la medición de puesta a tierra de este registro' }
  }

  // ── 2. Generar el PDF con el motor Chromium (vectorial) ─────────────────────
  console.warn('[PDF-EVIDENCIA-PAT] medición encontrada, generando PDF', { medicionId: med.id })
  const pdfRes = await generarReporteProtocoloPat(med.id as string)
  if (!pdfRes.success) {
    console.error('[PDF-EVIDENCIA-PAT] generarReporte falló', { error: pdfRes.error })
    return { success: false, error: pdfRes.error }
  }
  // Anexos manuales (encomienda / plano / otro) + anexos de sistema → hoja índice + fusión.
  const anexosManuales = await getAdjuntosManualesComoAnexos(registroId, rgFechaPlanificada)
  const buffer = await armarPdfFinalConAnexos(pdfRes.data.pdf, [...pdfRes.data.anexos, ...anexosManuales])
  const base64 = 'data:application/pdf;base64,' + Buffer.from(buffer).toString('base64')

  // ── 3. Guardar como evidencia de la gestión (sistema existente) ─────────────
  const ev = await guardarEvidenciaProtocolo(registroId, base64, 'mediciones-pat')
  if (!ev.success) {
    console.error('[PDF-EVIDENCIA-PAT] guardarEvidencia falló', { error: ev.error })
    return { success: false, error: ev.error }
  }
  console.warn('[PDF-EVIDENCIA-PAT] OK, evidencia guardada', { path: ev.path, bytes: buffer.length })

  return { success: true, data: { pdfUrl: ev.signedUrl } }
}
