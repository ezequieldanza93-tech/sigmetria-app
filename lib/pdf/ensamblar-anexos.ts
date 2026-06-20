/**
 * ensamblar-anexos.ts — Punto ÚNICO de ensamblado de anexos del PDF de un protocolo.
 *
 * Problema que resuelve: antes los anexos se fusionaban en DOS lugares desacoplados
 * (los de sistema —certificado/plano/observaciones— dentro de generarReporte; los
 * manuales —encomienda/plano/otro— después, en emitir-evidencia). Eso hacía imposible
 * armar una hoja índice fiel al orden real.
 *
 * Ahora TODO se ensambla acá:
 *   1. Se reúne la lista completa de anexos (sistema + manuales).
 *   2. Se ordena por una CLAVE CANÓNICA (certificado → encomienda → plano → observaciones → otro).
 *   3. Se genera una hoja índice "ANEXOS" que lista SOLO los presentes, en ese orden.
 *   4. Se fusiona [índice, ...anexos] al PDF base con pdf-lib.
 *
 * Best-effort: si la hoja índice falla al renderizar (Chromium), los anexos se adjuntan
 * igual sin índice; si no hay anexos, se devuelve el PDF base intacto.
 */

import { mergePdfConAnexos, anexoAPdfBuffer, type AnexoInput, type ClaveAnexo } from '@/lib/pdf/merge-anexos'
import { renderHtmlToPdf } from '@/lib/pdf/render-protocolo'

/** Orden de aparición de los anexos en el PDF final (y en la hoja índice). */
const ORDEN_CANONICO: Record<ClaveAnexo, number> = {
  certificado: 1,
  encomienda: 2,
  plano: 3,
  observaciones: 4,
  otro: 5,
}

/** Ordena los anexos por la clave canónica (estable dentro de la misma clave). */
export function ordenarAnexos(anexos: AnexoInput[]): AnexoInput[] {
  return [...anexos].sort(
    (a, b) => ORDEN_CANONICO[a.clave ?? 'otro'] - ORDEN_CANONICO[b.clave ?? 'otro'],
  )
}

/** Escape de HTML para los títulos que van a la hoja índice (incluye comillas:
 *  los títulos de adjuntos manuales llevan el nombre de archivo del usuario). */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Arma el HTML autónomo (A4 portrait, estilo Sigmetría) de la hoja índice "ANEXOS". */
function construirHtmlIndiceAnexos(titulos: string[]): string {
  const items = titulos
    .map(
      (t, i) =>
        `<li><span class="n">${i + 1}</span><span class="t">${esc(t)}</span></li>`,
    )
    .join('')

  return `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800&family=Poppins:wght@400;600&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 18mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Poppins','Segoe UI',sans-serif; color: #333; }
  .ix-head { border-bottom: 2px solid #2E7D33; padding-bottom: 10px; margin-bottom: 18px; }
  .ix-head .kick { font-size: 8pt; letter-spacing: 3px; text-transform: uppercase; color: #9aa39a; }
  .ix-head h1 { font-family: 'Montserrat',sans-serif; font-size: 26pt; font-weight: 800; color: #2E7D33; margin: 3px 0 0; letter-spacing: 1px; }
  .ix-head p { font-size: 9.5pt; color: #777; margin: 6px 0 0; line-height: 1.4; }
  ol.ix-list { list-style: none; margin: 0; padding: 0; }
  ol.ix-list li { display: flex; align-items: center; gap: 13px; padding: 12px 15px; border: 1px solid #E4E8E4; border-radius: 11px; margin-bottom: 9px; break-inside: avoid; page-break-inside: avoid; }
  ol.ix-list li .n { display: inline-flex; align-items: center; justify-content: center; width: 27px; height: 27px; border-radius: 50%; background: #2E7D33; color: #fff; font-family: 'Montserrat',sans-serif; font-weight: 700; font-size: 10.5pt; flex: 0 0 auto; }
  ol.ix-list li .t { font-size: 11pt; font-weight: 600; color: #1f2d1f; }
  .ix-foot { margin-top: 20px; font-size: 8pt; color: #b0b0b0; }
</style></head>
<body>
  <div class="ix-head">
    <div class="kick">Protocolo de Medición</div>
    <h1>ANEXOS</h1>
    <p>Documentos que forman parte integral del presente protocolo. Se adjuntan a continuación, en el mismo orden.</p>
  </div>
  <ol class="ix-list">${items}</ol>
  <div class="ix-foot">Sigmetría — Higiene y Seguridad</div>
</body></html>`
}

/**
 * Ensambla el PDF FINAL: ordena los anexos, antepone la hoja índice "ANEXOS" (que
 * lista solo los presentes, en el orden de adjuntado) y los fusiona al `base`.
 *
 * @param base   PDF del protocolo (cuerpo) ya renderizado.
 * @param anexos Lista completa de anexos (sistema + manuales), en cualquier orden.
 * @returns El PDF fusionado, o `base` intacto si no hay anexos.
 */
export async function armarPdfFinalConAnexos(base: Buffer, anexos: AnexoInput[]): Promise<Buffer> {
  const candidatos = ordenarAnexos(anexos.filter(a => a?.buffer && a.buffer.length > 0))
  if (candidatos.length === 0) return base

  // Validar/preparar cada anexo ANTES de armar el índice: así la hoja índice lista
  // EXACTAMENTE los anexos que terminan en el PDF (un archivo corrupto se excluye de ambos).
  const preparados: AnexoInput[] = []
  for (const ax of candidatos) {
    const pdf = await anexoAPdfBuffer(ax)
    if (pdf) preparados.push({ titulo: ax.titulo, buffer: pdf, mime: 'application/pdf' })
  }
  if (preparados.length === 0) return base

  // Hoja índice "ANEXOS" (best-effort: si Chromium falla, se adjuntan igual sin índice).
  let indice: AnexoInput[] = []
  try {
    const indicePdf = await renderHtmlToPdf(construirHtmlIndiceAnexos(preparados.map(a => a.titulo)))
    indice = [{ titulo: 'Índice de Anexos', buffer: indicePdf, mime: 'application/pdf' }]
  } catch (err) {
    console.error('[ANEXOS] no se pudo generar la hoja índice:', err instanceof Error ? err.message : String(err))
  }

  return mergePdfConAnexos(base, [...indice, ...preparados])
}
