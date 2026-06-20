/**
 * anexos-manuales.ts — Fusiona los ADJUNTOS MANUALES de un protocolo (encomienda /
 * plano / otro, subidos vía lib/actions/protocolo-adjuntos.ts) al PDF de evidencia.
 *
 * NO es un server action ('use server'): es un helper de SERVIDOR que se llama
 * DENTRO de los server actions emitir-evidencia-*.ts, después de generar el PDF
 * base y antes de guardarlo como evidencia.
 *
 * Best-effort: cualquier falla (sin adjuntos, archivo ilegible, error de red al
 * bajar) devuelve el pdfBuffer original sin romper la emisión.
 */

import { createClient } from '@/lib/supabase/server'
import { mergePdfConAnexos, type AnexoInput, type ClaveAnexo } from '@/lib/pdf/merge-anexos'

/** Título legible de la hoja divisoria según el tipo de adjunto. */
const TITULO_POR_TIPO: Record<string, string> = {
  encomienda: 'Encomienda del Colegio Profesional',
  plano: 'Plano o Croquis',
  otro: 'Documento Adjunto',
}

/** Clave de orden canónico según el tipo de adjunto manual. */
const CLAVE_POR_TIPO: Record<string, ClaveAnexo> = {
  encomienda: 'encomienda',
  plano: 'plano',
  otro: 'otro',
}

function tituloAnexo(tipo: string, nombre: string | null): string {
  const base = TITULO_POR_TIPO[tipo] ?? TITULO_POR_TIPO.otro
  return nombre ? `${base} — ${nombre}` : base
}

/**
 * Lee los adjuntos manuales del registro (encomienda / plano / otro), baja cada
 * archivo del bucket privado `documentos` y los devuelve como `AnexoInput[]` (con su
 * clave de orden canónico). NO fusiona nada: deja que el caller decida el ensamblado.
 *
 * Best-effort: cualquier falla devuelve la lista parcial reunida (o vacía).
 */
export async function getAdjuntosManualesComoAnexos(
  registroId: string,
  rgFechaPlanificada: string,
): Promise<AnexoInput[]> {
  try {
    if (!registroId) return []

    const supabase = await createClient()

    let query = supabase
      .from('protocolo_adjuntos')
      .select('tipo, nombre, mime, file_path')
      .eq('registro_gestion_id', registroId)
      .order('created_at', { ascending: true })
    if (rgFechaPlanificada) query = query.eq('rg_fecha_planificada', rgFechaPlanificada)

    const { data, error } = await query
    if (error || !data || data.length === 0) return []

    const rows = data as { tipo: string; nombre: string | null; mime: string | null; file_path: string }[]

    const anexos: AnexoInput[] = []
    for (const r of rows) {
      try {
        const { data: signed } = await supabase.storage
          .from('documentos')
          .createSignedUrl(r.file_path, 60 * 60)
        const signedUrl = signed?.signedUrl
        if (!signedUrl) continue

        const resp = await fetch(signedUrl)
        if (!resp.ok) continue
        const buffer = Buffer.from(await resp.arrayBuffer())
        if (buffer.length === 0) continue

        anexos.push({
          titulo: tituloAnexo(r.tipo, r.nombre),
          buffer,
          mime: r.mime ?? undefined,
          clave: CLAVE_POR_TIPO[r.tipo] ?? 'otro',
        })
      } catch (err) {
        // Adjunto individual ilegible/inaccesible → se saltea.
        console.error('[ANEXOS-MANUALES] no se pudo bajar el adjunto:', r.file_path, err instanceof Error ? err.message : String(err))
      }
    }

    return anexos
  } catch (err) {
    console.error('[ANEXOS-MANUALES] fallo al reunir adjuntos manuales:', err instanceof Error ? err.message : String(err))
    return []
  }
}

/**
 * Lee los adjuntos manuales del registro (orden created_at), baja cada archivo
 * del bucket privado `documentos` y los fusiona al `pdfBuffer` con pdf-lib.
 *
 * @returns el PDF fusionado, o el `pdfBuffer` original si no hay adjuntos o algo falla.
 */
export async function mergeAdjuntosManuales(
  pdfBuffer: Buffer,
  registroId: string,
  rgFechaPlanificada: string,
): Promise<Buffer> {
  try {
    const anexos = await getAdjuntosManualesComoAnexos(registroId, rgFechaPlanificada)
    if (anexos.length === 0) return pdfBuffer
    return await mergePdfConAnexos(pdfBuffer, anexos)
  } catch (err) {
    // Cualquier fallo global → devolvemos el PDF base intacto.
    console.error('[ANEXOS-MANUALES] fallo al fusionar adjuntos manuales:', err instanceof Error ? err.message : String(err))
    return pdfBuffer
  }
}
