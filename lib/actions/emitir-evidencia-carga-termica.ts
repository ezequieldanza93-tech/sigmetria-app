'use server'

/**
 * emitir-evidencia-carga-termica.ts — Puente entre el motor Chromium y el sistema de
 * evidencia para el Protocolo de Estrés Térmico por Calor (Res. SRT 30/2023).
 *
 * Réplica de emitir-evidencia-ruido.ts / -iluminacion.ts:
 *   1. Resuelve el medicionId a partir del registro de gestión (MISMO lookup condicional
 *      que getMedicionCargaTermicaByRegistro: filtra rg_fecha_planificada SOLO si viene;
 *      sin deleted_at).
 *   2. Genera el PDF VECTORIAL con el motor genérico (carátula + protocolo + anexos + logos).
 *   3. Lo guarda como EVIDENCIA de la gestión (guardarEvidenciaProtocolo →
 *      gestiones_registros.evidencia_url), subfolder 'mediciones-carga-termica'.
 *   4. Devuelve un signed URL para descargar/visualizar.
 */

import { createClient } from '@/lib/supabase/server'
import { generarReporteProtocoloCargaTermica } from '@/lib/actions/reporte-protocolo-carga-termica'
import { guardarEvidenciaProtocolo } from '@/lib/actions/protocolo-evidencia'
import type { ActionResult } from '@/lib/types'

export async function emitirEvidenciaCargaTermica(
  registroId: string,
  rgFechaPlanificada: string,
): Promise<ActionResult<{ pdfUrl: string }>> {
  if (!registroId) return { success: false, error: 'registroId requerido' }

  const supabase = await createClient()

  // ── 1. Resolver el medicionId desde el registro de gestión ──────────────────
  // MISMA lógica que getMedicionCargaTermicaByRegistro: filtrar por rg_fecha_planificada
  // SOLO si viene (las gestiones sin fecha planificada se guardan con rg_fecha_planificada
  // = NULL). Tampoco filtramos por deleted_at (la vista de referencia no lo hace).
  let medQuery = supabase
    .from('medicion_carga_termica')
    .select('id')
    .eq('registro_gestion_id', registroId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) medQuery = medQuery.eq('rg_fecha_planificada', rgFechaPlanificada)

  const { data: med, error: medErr } = await medQuery.maybeSingle()

  if (medErr || !med?.id) {
    console.error('[PDF-EVIDENCIA-CT] medición NO encontrada', { registroId, rgFechaPlanificada, medErr: medErr?.message })
    return { success: false, error: 'No se encontró la medición de carga térmica de este registro' }
  }

  // ── 2. Generar el PDF con el motor genérico (vectorial) ─────────────────────
  console.warn('[PDF-EVIDENCIA-CT] medición encontrada, generando PDF', { medicionId: med.id })
  const pdfRes = await generarReporteProtocoloCargaTermica(med.id as string)
  if (!pdfRes.success) {
    console.error('[PDF-EVIDENCIA-CT] generarReporte falló', { error: pdfRes.error })
    return { success: false, error: pdfRes.error }
  }
  const buffer = pdfRes.data as Buffer
  const base64 = 'data:application/pdf;base64,' + Buffer.from(buffer).toString('base64')

  // ── 3. Guardar como evidencia de la gestión (sistema existente) ─────────────
  const ev = await guardarEvidenciaProtocolo(registroId, base64, 'mediciones-carga-termica')
  if (!ev.success) {
    console.error('[PDF-EVIDENCIA-CT] guardarEvidencia falló', { error: ev.error })
    return { success: false, error: ev.error }
  }
  console.warn('[PDF-EVIDENCIA-CT] OK, evidencia guardada', { path: ev.path, bytes: buffer.length })

  // ── 4. Signed URL para descargar/visualizar ─────────────────────────────────
  const { data: signed } = await supabase.storage
    .from('documentos')
    .createSignedUrl(ev.path, 60 * 60)

  return { success: true, data: { pdfUrl: signed?.signedUrl ?? '' } }
}
