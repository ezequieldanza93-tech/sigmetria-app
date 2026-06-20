'use server'

/**
 * emitir-reporte-iluminacion.ts — Server Action: genera el PDF del Protocolo SRT 84/2012,
 * lo sube a Supabase Storage y devuelve una signed URL para descargar/previsualizar.
 *
 * FASE C — integra el motor Chromium server-side al flujo de ejecución real.
 *
 * ARQUITECTURA:
 *   1. Llama generarReporteProtocoloIluminacion(medicionId) → Buffer del PDF.
 *   2. Resuelve el consultora_id (para construir el path tenant-prefijado).
 *   3. Sube el PDF al bucket privado `documentos` con tenantStoragePath.
 *   4. Persiste el path en medicion_iluminacion.pdf_url (UPDATE).
 *   5. Crea una signed URL (TTL 1 hora) y la devuelve.
 *
 * IDEMPOTENCIA:
 *   Regenera SIEMPRE el PDF (sobreescribe `upsert: true`). Esto garantiza que el
 *   PDF refleja el estado actual de la medición aunque se llame múltiples veces.
 *   Tradeoff: una llamada extra a Chromium, pero el resultado siempre es fresco.
 *
 * CUÁNDO SE GENERA:
 *   On-demand al apretar "Descargar PDF" en el step 'listo' del modal.
 *   NO se genera en handleGuardar para evitar añadir la latencia de Chromium
 *   (cold start Vercel ~2–5 s) al guardado de la medición.
 */

import { createClient } from '@/lib/supabase/server'
import { generarReporteProtocoloIluminacion } from '@/lib/actions/reporte-protocolo-iluminacion'
import { armarPdfFinalConAnexos } from '@/lib/pdf/ensamblar-anexos'
import { tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'

/** TTL de la signed URL del PDF: 1 hora (mismo TTL que el reporte fotográfico). */
const PDF_SIGNED_TTL_SECONDS = 60 * 60

/**
 * Genera el PDF del Protocolo de Medición de Iluminación (Res. SRT 84/2012)
 * para la medición indicada, lo persiste en Storage y devuelve un signed URL.
 *
 * @param medicionId - UUID de la medición en tabla `medicion_iluminacion`
 * @returns { success: true, data: { pdfUrl: string } } o { success: false, error }
 */
export async function emitirReporteIluminacion(
  medicionId: string
): Promise<ActionResult<{ pdfUrl: string }>> {
  if (!medicionId) return { success: false, error: 'medicionId requerido' }

  const supabase = await createClient()

  // ── Auth guard ───────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // ── 1. Leer la cabecera de la medición para obtener establecimiento_id ───────
  const { data: cabecera, error: cabErr } = await supabase
    .from('medicion_iluminacion')
    .select('establecimiento_id, consultora_id')
    .eq('id', medicionId)
    .maybeSingle()

  if (cabErr || !cabecera) {
    return { success: false, error: `Medición no encontrada: ${cabErr?.message ?? 'sin resultado'}` }
  }

  const establecimientoId = cabecera.establecimiento_id as string | null
  // consultora_id puede venir directo de la cabecera (es columna propia de medicion_iluminacion)
  let consultoraId = cabecera.consultora_id as string | null

  // Fallback: resolver desde la jerarquía establecimiento → empresa → consultora
  if (!consultoraId && establecimientoId) {
    const { data: estRow } = await supabase
      .from('establecimientos')
      .select('empresas!inner(consultora_id)')
      .eq('id', establecimientoId)
      .maybeSingle()

    const empresas = estRow?.empresas as { consultora_id: string } | { consultora_id: string }[] | undefined
    if (empresas) {
      const row = Array.isArray(empresas) ? empresas[0] : empresas
      consultoraId = row?.consultora_id ?? null
    }
  }

  if (!consultoraId) {
    return { success: false, error: 'No se pudo resolver la consultora del establecimiento' }
  }

  // ── 2. Generar el PDF (Chromium server-side) ─────────────────────────────────
  const pdfResult = await generarReporteProtocoloIluminacion(medicionId)
  if (!pdfResult.success) {
    return { success: false, error: `Error al generar el PDF: ${pdfResult.error}` }
  }
  // Ensamblar los anexos de sistema + hoja índice "ANEXOS" (sin adjuntos manuales,
  // que dependen del registro de gestión y este bridge trabaja por medicionId).
  const pdfBuffer = await armarPdfFinalConAnexos(pdfResult.data.pdf, pdfResult.data.anexos)

  // ── 3. Subir a Storage (bucket privado `documentos`, path tenant-prefijado) ───
  // Patrón idéntico al reporte fotográfico (crearReporteFotograficoEjecucion).
  // Path: {consultora_id}/protocolos-iluminacion/{medicionId}/protocolo-iluminacion-{medicionId}.pdf
  const fileName = `protocolo-iluminacion-${medicionId}.pdf`
  const storagePath = tenantStoragePath(
    consultoraId,
    'protocolos-iluminacion',
    medicionId,
    fileName
  )

  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from('documentos')
    .upload(storagePath, pdfBuffer, {
      upsert: true,            // Regenera siempre; así refleja cambios post-firma
      contentType: 'application/pdf',
    })

  if (uploadErr) {
    return { success: false, error: `Error al subir el PDF: ${uploadErr.message}` }
  }

  const finalPath = uploadData.path

  // ── 4. Persistir el path en medicion_iluminacion.pdf_url ────────────────────
  const { error: updateErr } = await supabase
    .from('medicion_iluminacion')
    .update({ pdf_url: finalPath })
    .eq('id', medicionId)

  if (updateErr) {
    // No bloqueante: si el UPDATE falla, igual devolvemos el signed URL.
    // El PDF está subido; el path se puede reconciliar manualmente.
    console.error('[emitirReporteIluminacion] No se pudo persistir pdf_url:', updateErr.message)
  }

  // ── 5. Crear signed URL (TTL 1 hora) ────────────────────────────────────────
  const { data: signed, error: signErr } = await supabase.storage
    .from('documentos')
    .createSignedUrl(finalPath, PDF_SIGNED_TTL_SECONDS)

  if (signErr || !signed?.signedUrl) {
    return { success: false, error: `PDF generado y subido, pero no se pudo crear la URL de descarga: ${signErr?.message ?? 'sin URL'}` }
  }

  return { success: true, data: { pdfUrl: signed.signedUrl } }
}
