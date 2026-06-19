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
import type { ActionResult } from '@/lib/types'

export async function emitirEvidenciaIluminacion(
  registroId: string,
  rgFechaPlanificada: string,
): Promise<ActionResult<{ pdfUrl: string }>> {
  if (!registroId) return { success: false, error: 'registroId requerido' }

  const supabase = await createClient()

  // ── 1. Resolver el medicionId desde el registro de gestión ──────────────────
  const { data: med, error: medErr } = await supabase
    .from('medicion_iluminacion')
    .select('id')
    .eq('registro_gestion_id', registroId)
    .eq('rg_fecha_planificada', rgFechaPlanificada)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (medErr || !med?.id) {
    return { success: false, error: 'No se encontró la medición de iluminación de este registro' }
  }

  // ── 2. Generar el PDF con el motor Chromium (vectorial) ─────────────────────
  const pdfRes = await generarReporteProtocoloIluminacion(med.id as string)
  if (!pdfRes.success) return { success: false, error: pdfRes.error }
  const buffer = pdfRes.data as Buffer
  const base64 = 'data:application/pdf;base64,' + Buffer.from(buffer).toString('base64')

  // ── 3. Guardar como evidencia de la gestión (sistema existente) ─────────────
  const ev = await guardarEvidenciaProtocolo(registroId, base64, 'mediciones-iluminacion')
  if (!ev.success) return { success: false, error: ev.error }

  // ── 4. Signed URL para descargar/visualizar ─────────────────────────────────
  const { data: signed } = await supabase.storage
    .from('documentos')
    .createSignedUrl(ev.path, 60 * 60)

  return { success: true, data: { pdfUrl: signed?.signedUrl ?? '' } }
}
