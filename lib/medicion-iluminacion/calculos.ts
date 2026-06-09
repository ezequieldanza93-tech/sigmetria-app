/**
 * Cálculos PUROS del Protocolo de Medición de Iluminación (SRT 84/2012 — Dec 351/79 Anexo IV).
 *
 * Funciones sin efectos secundarios: las comparten la UI (wizard en vivo) y, más
 * adelante, el generador de PDF oficial. NO importan nada de Supabase, React ni
 * el DOM — son matemática pura sobre los datos del instructivo.
 *
 * Referencias del instructivo:
 *  - Índice del local (k): relaciona las dimensiones del local con la altura de montaje.
 *  - N° mínimo de puntos: cantidad de mediciones según el índice del local.
 *  - Uniformidad: E mín debe ser ≥ E media / 2.
 *  - Nivel: E media debe alcanzar el valor requerido.
 *  - Tabla 4: si la iluminación es localizada, la general mínima depende del valor localizado.
 */

/**
 * Índice del local (k).
 *   k = (largo · ancho) / (altura · (largo + ancho))
 * Si el denominador es 0 (altura 0 o largo+ancho 0) → 0 (evita división por cero).
 *
 * Ejemplo del instructivo: indiceLocal(10, 40, 4) = 2
 */
export function indiceLocal(largo: number, ancho: number, altura: number): number {
  const denominador = altura * (largo + ancho)
  if (denominador === 0) return 0
  return (largo * ancho) / denominador
}

/**
 * Número mínimo de puntos de medición a partir del índice del local (k).
 *   x = k ≥ 3 ? 4 : ceil(k)
 *   return (x + 2)²
 * Si k ≤ 0 → 0 (sin local válido, no hay grilla que armar).
 *
 * Ejemplos del instructivo:
 *   numeroMinimoPuntos(2)    = (2 + 2)² = 16
 *   numeroMinimoPuntos(0.93) = (1 + 2)² = 9
 *   numeroMinimoPuntos(3.5)  = (4 + 2)² = 36
 */
export function numeroMinimoPuntos(k: number): number {
  if (k <= 0) return 0
  const x = k >= 3 ? 4 : Math.ceil(k)
  return (x + 2) ** 2
}

/**
 * Iluminancia media (E media): promedio aritmético de los valores medidos en lux.
 * Lista vacía → 0.
 *
 * Ejemplo del instructivo (Punto 1, 16 valores):
 *   eMedia([200,250,250,200,95,100,90,80,68,76,90,80,80,85,100,100]) = 121.5
 */
export function eMedia(valores: number[]): number {
  if (valores.length === 0) return 0
  const suma = valores.reduce((acc, v) => acc + v, 0)
  return suma / valores.length
}

/**
 * Iluminancia mínima (E mín): el menor valor medido en lux.
 * Lista vacía → 0.
 */
export function eMinima(valores: number[]): number {
  if (valores.length === 0) return 0
  return Math.min(...valores)
}

/**
 * Uniformidad: se cumple cuando E mín ≥ E media / 2.
 *
 * Ejemplo del instructivo: cumpleUniformidad(68, 121.5) = true (68 ≥ 60.75).
 */
export function cumpleUniformidad(eMin: number, eMed: number): boolean {
  return eMin >= eMed / 2
}

/**
 * Nivel: se cumple cuando E media ≥ valor requerido (campo 32).
 */
export function cumpleNivel(eMed: number, requerido: number): boolean {
  return eMed >= requerido
}

/** Fila de la Tabla 4 (relación localizada → general mínima). */
export interface FilaTabla4 {
  localizada_lux: number
  general_min_lux: number
}

/**
 * General mínima requerida cuando la iluminación es localizada (Tabla 4 del Anexo IV).
 *
 * Busca en la Tabla 4 la fila cuyo `localizada_lux` coincide con el valor localizado
 * medido/declarado y devuelve su `general_min_lux`. Si no hay coincidencia exacta,
 * devuelve null (la UI puede mostrar "sin referencia").
 *
 * La Tabla 4 puede venir como filas tipadas o como records sueltos (lo que devuelve
 * getDec351Tablas → tabla4 es Array<Record<string, unknown>>); normalizamos a número.
 */
export function generalRequeridaLocalizada(
  localizadaLux: number,
  tabla4: Array<FilaTabla4 | Record<string, unknown>>,
): number | null {
  if (!Array.isArray(tabla4)) return null
  for (const fila of tabla4) {
    const loc = Number((fila as Record<string, unknown>).localizada_lux)
    if (Number.isFinite(loc) && loc === localizadaLux) {
      const gen = Number((fila as Record<string, unknown>).general_min_lux)
      return Number.isFinite(gen) ? gen : null
    }
  }
  return null
}
