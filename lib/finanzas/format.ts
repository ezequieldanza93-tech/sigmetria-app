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
 * Monedas que en la práctica NO usan decimales (la unidad fraccionaria está en
 * desuso o no existe). Decisión de negocio (Ezequiel, 2026): para estas se
 * muestran/cargan montos SIN decimales.
 */
const MONEDAS_SIN_DECIMALES = new Set(['ARS', 'CLP', 'COP', 'PYG', 'JPY'])

/**
 * Cantidad de decimales a usar para una moneda dada.
 * ARS/CLP/COP/PYG/JPY → 0 (centavos en desuso); resto → 2.
 * @param moneda código ISO 4217
 */
export function decimalesPorMoneda(moneda: string): number {
  return MONEDAS_SIN_DECIMALES.has(moneda.toUpperCase()) ? 0 : 2
}

/**
 * Formatea un monto como moneda. Ej: formatMonto(1500.5, 'ARS') → "$ 1.501" (es-AR);
 * formatMonto(1500.5, 'USD') → "US$ 1.500,50". Decimales según la moneda.
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
  const decimales = decimalesPorMoneda(moneda)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(valor)
  } catch {
    // moneda/locale inválidos → fallback sin símbolo, número plano localizado.
    return new Intl.NumberFormat(FIN_LOCALE_DEFAULT, {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(valor)
  }
}

/**
 * Parsea lo que el usuario escribe en un input de monto a un `number`.
 *
 * - Para monedas SIN decimales (ARS, etc.): se queda solo con los dígitos →
 *   "$ 1.500" / "1500" → 1500.
 * - Para monedas CON decimales: toma los dígitos y ubica el separador decimal
 *   por POSICIÓN (los últimos N dígitos son la parte fraccionaria), de modo que
 *   sea agnóstico al locale ("1.500,50" y "1,500.50" rinden 1500.5).
 *
 * Devuelve `NaN` si no hay dígitos (input vacío) — el caller decide qué hacer.
 */
export function parseMontoInput(str: string, moneda: string = FIN_MONEDA_DEFAULT): number {
  const decimales = decimalesPorMoneda(moneda)
  const digitos = (str ?? '').replace(/\D/g, '')
  if (digitos === '') return NaN
  if (decimales === 0) return Number(digitos)
  return Number(digitos) / 10 ** decimales
}

/**
 * Formatea un `number` para MOSTRARLO dentro de un input de monto: símbolo de
 * moneda + separador de miles + decimales según la moneda. Reusa `formatMonto`,
 * por lo que respeta la regla currency-aware de decimales.
 * Devuelve cadena vacía si el valor no es finito (input vacío).
 */
export function formatMontoInput(
  value: number,
  moneda: string = FIN_MONEDA_DEFAULT,
  locale: string = FIN_LOCALE_DEFAULT,
): string {
  if (!Number.isFinite(value)) return ''
  return formatMonto(value, moneda, locale)
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
