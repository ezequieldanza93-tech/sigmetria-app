/**
 * brand-color.ts — Color de marca de la consultora para los PDF (white-label suave).
 *
 * Decisión Ezequiel (2026-06-26): TODAS las consultoras pueden setear su color
 * (sin gating por plan) y se aplica en TODOS los PDF (protocolos + contrato +
 * presupuesto), reemplazando el verde de Sigmetría.
 *
 * Las columnas viven en `consultoras.color_marca_primario / color_marca_secundario`
 * (hex #RRGGBB, NULL = usar el verde de Sigmetría). Cada generador de PDF resuelve
 * el color con `resolveBrandColor()` y lo pasa a su builder.
 */

/** Verde institucional de Sigmetría (fallback cuando la consultora no setea color). */
export const SIGMETRIA_BRAND = {
  /** Acento principal (headers, títulos, bordes). Equivale a COLORS.verdeOscuro. */
  primario: '#2E7D33',
  /** Acento secundario (realces puntuales). Equivale a COLORS.verde. */
  secundario: '#4CAF50',
} as const

export interface BrandColor {
  primario: string
  secundario: string
}

function limpiarHex(v?: string | null): string | null {
  const s = (v ?? '').trim()
  return /^#[0-9A-Fa-f]{6}$/.test(s) ? s : null
}

/**
 * Resuelve el color de marca con fallback a Sigmetría.
 *  · Si la consultora setea primario pero no secundario → el secundario espeja al
 *    primario (branding mono-color coherente; no mezcla con el verde Sigmetría).
 *  · Si no setea nada → verde Sigmetría en ambos.
 */
export function resolveBrandColor(
  primario?: string | null,
  secundario?: string | null,
): BrandColor {
  const p = limpiarHex(primario)
  const s = limpiarHex(secundario)
  return {
    primario: p ?? SIGMETRIA_BRAND.primario,
    secundario: s ?? (p ?? SIGMETRIA_BRAND.secundario),
  }
}
