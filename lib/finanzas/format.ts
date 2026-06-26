/**
 * Helpers de formato LOCALE-AWARE para el módulo Finanzas.
 *
 * Escalabilidad multi-país: jamás hardcodear '$' ni 'dd/mm/yyyy'. Todo se deriva
 * de `moneda` (ISO 4217) + `locale` (BCP 47), que vienen de `fin_config`. Los
 * defaults son AR pero son PARAMETRIZABLES.
 *
 * Client-safe: solo usa Intl, sin imports server. Lo pueden consumir tanto las
 * pages (server) como los componentes ('use client').
 */

export const FIN_MONEDA_DEFAULT = 'ARS'
export const FIN_LOCALE_DEFAULT = 'es-AR'

/**
 * Formatea un monto como moneda. Ej: formatMonto(1500.5) → "$ 1.500,50" (es-AR).
 * @param monto valor numérico
 * @param moneda código ISO 4217 (default 'ARS')
 * @param locale BCP 47 (default 'es-AR')
 */
export function formatMonto(
  monto: number,
  moneda: string = FIN_MONEDA_DEFAULT,
  locale: string = FIN_LOCALE_DEFAULT,
): string {
  const valor = Number.isFinite(monto) ? monto : 0
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor)
  } catch {
    // moneda/locale inválidos → fallback sin símbolo, número plano localizado.
    return new Intl.NumberFormat(FIN_LOCALE_DEFAULT, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor)
  }
}

/**
 * Formatea una fecha (string ISO o Date) en formato corto localizado.
 * Ej: formatFechaCorta('2026-08-01') → "1 ago 2026" (es-AR).
 */
export function formatFechaCorta(
  fecha: string | Date,
  locale: string = FIN_LOCALE_DEFAULT,
): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d)
  } catch {
    return new Intl.DateTimeFormat(FIN_LOCALE_DEFAULT, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d)
  }
}

/**
 * Formatea un número sin símbolo de moneda (para km, cantidades, etc.).
 */
export function formatNumero(
  valor: number,
  locale: string = FIN_LOCALE_DEFAULT,
  fractionDigits = 0,
): string {
  const v = Number.isFinite(valor) ? valor : 0
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(v)
  } catch {
    return new Intl.NumberFormat(FIN_LOCALE_DEFAULT, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(v)
  }
}
