/**
 * Países (ISO 3166-1 alpha-2). La bandera se renderiza con la librería
 * flag-icons (SVG/CSS), que se ve a color en todos los sistemas incluido
 * Windows. Clase: `fi fi-{codigo en minúscula}` sobre un <span>.
 */

export interface Pais {
  codigo: string
  nombre: string
  activo: boolean
}

/**
 * Devuelve la className de flag-icons para un código ISO alpha-2.
 * Ej: 'AR' → 'fi fi-ar'. Requiere importar 'flag-icons/css/flag-icons.min.css'.
 */
export function banderaClase(codigo: string): string {
  if (!codigo || !/^[A-Za-z]{2}$/.test(codigo.trim())) return 'fi'
  return `fi fi-${codigo.trim().toLowerCase()}`
}

/**
 * Convierte un código ISO alpha-2 (ej. 'AR') en su emoji de bandera (ej. 🇦🇷).
 * Cada letra se mapea a su Regional Indicator Symbol:
 *   codePoint = 0x1F1E6 + (letra - 'A')
 * Devuelve string vacío si el código no es válido (2 letras A-Z).
 */
export function banderaEmoji(codigo: string): string {
  if (!codigo) return ''
  const cc = codigo.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ''
  const A = 'A'.charCodeAt(0)
  const base = 0x1f1e6
  return String.fromCodePoint(
    base + (cc.charCodeAt(0) - A),
    base + (cc.charCodeAt(1) - A),
  )
}
