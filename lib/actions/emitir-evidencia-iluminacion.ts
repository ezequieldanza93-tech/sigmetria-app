'use server'

/**
 * emitir-evidencia-iluminacion.ts — Puente entre el motor Chromium y el sistema de evidencia.
 *
 * Reemplaza la generación client-side (html2canvas) del protocolo de iluminación:
 *   1. Resuelve el medicionId a partir del registro de gestión.
 *   2. Genera el PDF VECTORIAL con el motor Chromium (carátula + protocolo + anexos + logos).
 *   3. Lo guarda como EVIDENCIA de la gestión (mismo sistema que ya usaba el modal:
 *      guardarEvidenciaProtocolo → gestiones_registros.evidencia_url).
 *   4. Devuelve un signed URL para descargar/visualizar.
 *
 * Así la evidencia que ya guardabas pasa a tener el PDF "lindo" (vectorial) en vez del
 * rasterizado de html2canvas, sin cambiar tu flujo de evidencia.
 */

import { createClient } from '@/lib/supabase/server'
import { generarReporteProtocoloIluminacion } from '@/lib/actions/reporte-protocolo-iluminacion'
import { guardarEvidenciaProtocolo } from '@/lib/actions/protocolo-evidencia'
import { getAdjuntosManualesComoAnexos } from '@/lib/pdf/anexos-manuales'
import { armarPdfFinalConAnexos } from '@/lib/pdf/ensamblar-anexos'
import type { ActionResult } from '@/lib/types'

export async function emitirEvidenciaIluminacion(
  registroId: string,
  rgFechaPlanificada: string,
): Promise<ActionResult<{ pdfUrl: string }>> {
  if (!registroId) return { success: false, error: 'registroId requerido' }

  const supabase = await createClient()

  // ── 1. Resolver el medicionId desde el registro de gestión ──────────────────
  // MISMA lógica que getMedicionIluminacionByRegistro (la vista que SÍ funciona):
  // filtrar por rg_fecha_planificada SOLO si viene (las gestiones sin fecha planificada
  // se guardan con rg_fecha_planificada = NULL, así que .eq('','') nunca matchearía).
  // Tampoco filtramos por deleted_at (la vista de referencia no lo hace).
  let medQuery = supabase
    .from('medicion_iluminacion')
    .select('id')
    .eq('registro_gestion_id', registroId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) medQuery = medQuery.eq('rg_fecha_planificada', rgFechaPlanificada)

  const { data: med, error: medErr } = await medQuery.maybeSingle()

  if (medErr || !med?.id) {
    console.error('[PDF-EVIDENCIA] medición NO encontrada', { registroId, rgFechaPlanificada, medErr: medErr?.message })
    return { success: false, error: 'No se encontró la medición de iluminación de este registro' }
  }

  // ── 2. Generar el PDF con el motor Chromium (vectorial) ─────────────────────
  console.warn('[PDF-EVIDENCIA] medición encontrada, generando PDF', { medicionId: med.id })
  const pdfRes = await generarReporteProtocoloIluminacion(med.id as string)
  if (!pdfRes.success) {
    console.error('[PDF-EVIDENCIA] generarReporte falló', { error: pdfRes.error })
    return { success: false, error: pdfRes.error }
  }

  // ── 2b. Ensamblar anexos en UN solo punto ───────────────────────────────────
  // Sistema (cert/plano/observaciones) + manuales (encomienda/plano/otro), ordenados
  // por clave canónica, con la hoja índice "ANEXOS" antepuesta. Best-effort.
  const anexosManuales = await getAdjuntosManualesComoAnexos(registroId, rgFechaPlanificada)
  const buffer = await armarPdfFinalConAnexos(pdfRes.data.pdf, [...pdfRes.data.anexos, ...anexosManuales])
  const base64 = 'data:application/pdf;base64,' + Buffer.from(buffer).toString('base64')

  // ── 3. Guardar como evidencia de la gestión (sistema existente) ─────────────
  const ev = await guardarEvidenciaProtocolo(registroId, base64, 'mediciones-iluminacion')
  if (!ev.success) {
    console.error('[PDF-EVIDENCIA] guardarEvidencia falló', { error: ev.error })
    return { success: false, error: ev.error }
  }
  console.warn('[PDF-EVIDENCIA] OK, evidencia guardada', { path: ev.path, bytes: buffer.length })

  // ── 4. Signed URL para descargar/visualizar ─────────────────────────────────
  const { data: signed } = await supabase.storage
    .from('documentos')
    .createSignedUrl(ev.path, 60 * 60)

  return { success: true, data: { pdfUrl: signed?.signedUrl ?? '' } }
}
