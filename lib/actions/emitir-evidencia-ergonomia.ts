'use server'

/**
 * emitir-evidencia-ergonomia.ts — Puente entre el motor Chromium y el sistema de evidencia,
 * para el Protocolo de Evaluación Ergonómica (TME) — Res. SRT 886/2015.
 *
 * Clona emitir-evidencia-iluminacion.ts:
 *   1. Resuelve el evaluacionId a partir del registro de gestión (MISMO lookup condicional
 *      que getProtocoloErgonomiaByRegistro: filtra rg_fecha_planificada SOLO si viene; sin
 *      deleted_at).
 *   2. Genera el PDF VECTORIAL con el motor genérico (carátula + protocolo + anexos + logos).
 *   3. Lo guarda como evidencia de la gestión (guardarEvidenciaProtocolo → subfolder
 *      'protocolos-ergonomia').
 *   4. Devuelve un signed URL para descargar/visualizar.
 */

import { createClient } from '@/lib/supabase/server'
import { generarReporteProtocoloErgonomia } from '@/lib/actions/reporte-protocolo-ergonomia'
import { guardarEvidenciaProtocolo } from '@/lib/actions/protocolo-evidencia'
import { getAdjuntosManualesComoAnexos } from '@/lib/pdf/anexos-manuales'
import { armarPdfFinalConAnexos } from '@/lib/pdf/ensamblar-anexos'
import type { ActionResult } from '@/lib/types'

export async function emitirEvidenciaErgonomia(
  registroId: string,
  rgFechaPlanificada: string,
): Promise<ActionResult<{ pdfUrl: string }>> {
  if (!registroId) return { success: false, error: 'registroId requerido' }

  const supabase = await createClient()

  // ── 1. Resolver el evaluacionId desde el registro de gestión ────────────────
  // MISMA lógica que getProtocoloErgonomiaByRegistro (la vista que SÍ funciona):
  // filtrar por rg_fecha_planificada SOLO si viene (las gestiones sin fecha planificada
  // se guardan con rg_fecha_planificada = NULL). Tampoco filtramos por deleted_at.
  let query = supabase
    .from('ergonomia_evaluaciones')
    .select('id')
    .eq('registro_gestion_id', registroId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) query = query.eq('rg_fecha_planificada', rgFechaPlanificada)

  const { data: ev, error: evErr } = await query.maybeSingle()

  if (evErr || !ev?.id) {
    console.error('[PDF-ERGO-EVIDENCIA] evaluación NO encontrada', { registroId, rgFechaPlanificada, evErr: evErr?.message })
    return { success: false, error: 'No se encontró la evaluación ergonómica de este registro' }
  }

  // ── 2. Generar el PDF con el motor genérico (vectorial) ─────────────────────
  console.warn('[PDF-ERGO-EVIDENCIA] evaluación encontrada, generando PDF', { evaluacionId: ev.id })
  const pdfRes = await generarReporteProtocoloErgonomia(ev.id as string)
  if (!pdfRes.success) {
    console.error('[PDF-ERGO-EVIDENCIA] generarReporte falló', { error: pdfRes.error })
    return { success: false, error: pdfRes.error }
  }
  // Fusionar anexos (los de sistema que devuelve el reporte + los adjuntos manuales:
  // encomienda / plano / otro) en el PDF final, con su hoja índice "ANEXOS".
  const anexosManuales = await getAdjuntosManualesComoAnexos(registroId, rgFechaPlanificada)
  const buffer = await armarPdfFinalConAnexos(pdfRes.data.pdf, [...pdfRes.data.anexos, ...anexosManuales])
  const base64 = 'data:application/pdf;base64,' + Buffer.from(buffer).toString('base64')

  // ── 3. Guardar como evidencia de la gestión (sistema existente) ─────────────
  const evi = await guardarEvidenciaProtocolo(registroId, base64, 'protocolos-ergonomia')
  if (!evi.success) {
    console.error('[PDF-ERGO-EVIDENCIA] guardarEvidencia falló', { error: evi.error })
    return { success: false, error: evi.error }
  }
  console.warn('[PDF-ERGO-EVIDENCIA] OK, evidencia guardada', { path: evi.path, bytes: buffer.length })

  // ── 4. Signed URL para descargar/visualizar ─────────────────────────────────
  const { data: signed } = await supabase.storage
    .from('documentos')
    .createSignedUrl(evi.path, 60 * 60)

  return { success: true, data: { pdfUrl: signed?.signedUrl ?? '' } }
}
