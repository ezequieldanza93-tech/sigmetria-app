'use server'

/**
 * emitir-evidencia-carga-fuego.ts — Puente entre el motor Chromium y el sistema de
 * evidencia para el INFORME DE CÁLCULO DE CARGA DE FUEGO (Dec. 351/79, Anexo VII).
 *
 * Réplica de emitir-evidencia-ruido.ts:
 *   1. Resuelve el calculoId a partir del registro de gestión (mismo lookup condicional
 *      que getCalculoCargaFuegoByRegistro: filtra rg_fecha_planificada SOLO si viene;
 *      order created_at desc, limit 1).
 *   2. Genera el PDF VECTORIAL con el motor genérico (carátula + cuerpo CF + anexos + logos).
 *   3. Lo guarda como EVIDENCIA de la gestión (guardarEvidenciaProtocolo →
 *      gestiones_registros.evidencia_url), subfolder 'calculos-carga-fuego'.
 *   4. Devuelve un signed URL para descargar/visualizar.
 */

import { createClient } from '@/lib/supabase/server'
import { generarReporteProtocoloCargaFuego } from '@/lib/actions/reporte-protocolo-carga-fuego'
import { guardarEvidenciaProtocolo } from '@/lib/actions/protocolo-evidencia'
import { mergeAdjuntosManuales } from '@/lib/pdf/anexos-manuales'
import type { ActionResult } from '@/lib/types'

export async function emitirEvidenciaCargaFuego(
  registroId: string,
  rgFechaPlanificada: string,
): Promise<ActionResult<{ pdfUrl: string }>> {
  if (!registroId) return { success: false, error: 'registroId requerido' }

  const supabase = await createClient()

  // ── 1. Resolver el calculoId desde el registro de gestión ───────────────────
  // MISMA lógica que getCalculoCargaFuegoByRegistro: filtrar por rg_fecha_planificada
  // SOLO si viene; sin deleted_at; order created_at desc, limit 1.
  let calcQuery = supabase
    .from('calculo_carga_fuego')
    .select('id')
    .eq('registro_gestion_id', registroId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) calcQuery = calcQuery.eq('rg_fecha_planificada', rgFechaPlanificada)

  const { data: calc, error: calcErr } = await calcQuery.maybeSingle()

  if (calcErr || !calc?.id) {
    console.error('[PDF-EVIDENCIA-CF] cálculo NO encontrado', { registroId, rgFechaPlanificada, calcErr: calcErr?.message })
    return { success: false, error: 'No se encontró el cálculo de carga de fuego de este registro' }
  }

  // ── 2. Generar el PDF con el motor genérico (vectorial) ─────────────────────
  console.warn('[PDF-EVIDENCIA-CF] cálculo encontrado, generando PDF', { calculoId: calc.id })
  const pdfRes = await generarReporteProtocoloCargaFuego(calc.id as string)
  if (!pdfRes.success) {
    console.error('[PDF-EVIDENCIA-CF] generarReporte falló', { error: pdfRes.error })
    return { success: false, error: pdfRes.error }
  }
  // Fusionar adjuntos manuales (encomienda / plano / otro) si los hay (best-effort).
  const buffer = await mergeAdjuntosManuales(pdfRes.data as Buffer, registroId, rgFechaPlanificada)
  const base64 = 'data:application/pdf;base64,' + Buffer.from(buffer).toString('base64')

  // ── 3. Guardar como evidencia de la gestión (sistema existente) ─────────────
  const ev = await guardarEvidenciaProtocolo(registroId, base64, 'calculos-carga-fuego')
  if (!ev.success) {
    console.error('[PDF-EVIDENCIA-CF] guardarEvidencia falló', { error: ev.error })
    return { success: false, error: ev.error }
  }
  console.warn('[PDF-EVIDENCIA-CF] OK, evidencia guardada', { path: ev.path, bytes: buffer.length })

  // ── 4. Signed URL para descargar/visualizar ─────────────────────────────────
  const { data: signed } = await supabase.storage
    .from('documentos')
    .createSignedUrl(ev.path, 60 * 60)

  return { success: true, data: { pdfUrl: signed?.signedUrl ?? '' } }
}
