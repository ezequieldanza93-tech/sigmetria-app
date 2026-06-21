/**
 * anexo-certificado.ts — Resuelve el CERTIFICADO DE CALIBRACIÓN del instrumento como
 * anexo de sistema del PDF (helper compartido por los protocolos instrumentales:
 * ruido, PAT, carga térmica — e iluminación tiene su propia copia inline).
 *
 * Prioridad: el cert EXACTO referenciado por la medición (certificado_id); si no,
 * el último cert vigente (activo) del instrumento. Bucket privado 'certificados',
 * columna certificado_url. Best-effort: si no hay cert o falla, devuelve null.
 */

import { createClient } from '@/lib/supabase/server'
import type { AnexoInput } from '@/lib/pdf/merge-anexos'

export async function getAnexoCertificadoCalibracion(
  certificadoId: string | null | undefined,
  instrumentoId: string | null | undefined,
): Promise<AnexoInput | null> {
  try {
    const supabase = await createClient()

    let certPath: string | null = null
    if (certificadoId) {
      const { data: c } = await supabase
        .from('certificados_calibracion')
        .select('certificado_url')
        .eq('id', certificadoId)
        .maybeSingle()
      certPath = (c?.certificado_url as string | null) ?? null
    }
    if (!certPath && instrumentoId) {
      const { data: certRow } = await supabase
        .from('certificados_calibracion')
        .select('certificado_url')
        .eq('instrumento_id', instrumentoId)
        .eq('activo', true)
        .order('fecha_emision', { ascending: false })
        .limit(1)
        .maybeSingle()
      certPath = (certRow?.certificado_url as string | null) ?? null
    }

    console.warn('[ANEXO-CERT]', { certificadoId, instrumentoId, certPath })
    if (!certPath) return null

    const { data: signed } = await supabase.storage.from('certificados').createSignedUrl(certPath, 600)
    if (!signed?.signedUrl) return null
    const r = await fetch(signed.signedUrl)
    if (!r.ok) return null

    return {
      titulo: 'Certificado de Calibración del Equipo',
      buffer: Buffer.from(await r.arrayBuffer()),
      mime: r.headers.get('content-type') ?? undefined,
      clave: 'certificado',
    }
  } catch (err) {
    console.error('[ANEXO-CERT] fallo al resolver el certificado:', err instanceof Error ? err.message : String(err))
    return null
  }
}

/**
 * Resuelve el PLANO / CROQUIS de mediciones (cargado en la hoja 1 del formulario,
 * persistido en <tabla>.plano_url, bucket privado 'documentos') como anexo de sistema.
 * Best-effort: si no hay plano o falla, devuelve null. Igual que iluminación.
 */
export async function getAnexoPlano(
  planoPath: string | null | undefined,
): Promise<AnexoInput | null> {
  try {
    if (!planoPath) return null
    const supabase = await createClient()
    const { data: signed } = await supabase.storage.from('documentos').createSignedUrl(planoPath, 600)
    if (!signed?.signedUrl) return null
    const r = await fetch(signed.signedUrl)
    if (!r.ok) return null
    return {
      titulo: 'Plano o Croquis de Mediciones',
      buffer: Buffer.from(await r.arrayBuffer()),
      mime: r.headers.get('content-type') ?? undefined,
      clave: 'plano',
    }
  } catch (err) {
    console.error('[ANEXO-PLANO] fallo al resolver el plano:', err instanceof Error ? err.message : String(err))
    return null
  }
}
