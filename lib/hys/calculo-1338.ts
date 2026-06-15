/**
 * Cálculo de horas del servicio de Higiene y Seguridad
 * según Decreto 1338/96, Arts. 4 y 12.
 *
 * Categorías (Art. 12, Anexo I Dec. 351/79):
 *   A — Capítulos 5, 6, 11, 12, 14, 18 al 21 (riesgo bajo)
 *   B — Capítulos 5, 6, 7 y 11 al 21 (riesgo medio)
 *   C — Capítulos 5 al 21 (riesgo alto)
 *
 * CONSTRUCCIÓN: NO se calcula por esta tabla — Res. SRT 231/96.
 */

export type CategoriaHyS = 'A' | 'B' | 'C'

/** Descripción de cada categoría para mostrar en tooltips/help. */
export const CATEGORIAS_HYS: Record<CategoriaHyS, { label: string; descripcion: string }> = {
  A: {
    label: 'Categoría A — Riesgo bajo',
    descripcion: 'Capítulos 5, 6, 11, 12, 14, 18 al 21 del Anexo I del Dec. 351/79.',
  },
  B: {
    label: 'Categoría B — Riesgo medio',
    descripcion: 'Capítulos 5, 6, 7 y 11 al 21 del Anexo I del Dec. 351/79.',
  },
  C: {
    label: 'Categoría C — Riesgo alto',
    descripcion: 'Capítulos 5 al 21 del Anexo I del Dec. 351/79.',
  },
}

/**
 * Tabla Art. 12, Dec. 1338/96.
 * Cada fila: [límite superior de equivalentes (inclusive), horas A, horas B, horas C]
 * Nota: el último tramo (>3000) se modela como límite superior = Infinity.
 */
const TABLA_ART12: Array<[number, number, number, number]> = [
  [15,   0,   2,   4],
  [30,   0,   4,   8],
  [60,   0,   8,  16],
  [100,  1,  16,  28],
  [150,  2,  22,  44],
  [250,  4,  30,  60],
  [350,  8,  45,  78],
  [500, 12,  60,  96],
  [650, 16,  75, 114],
  [850, 20,  90, 132],
  [1100, 24, 105, 150],
  [1400, 28, 120, 168],
  [1900, 32, 135, 186],
  [3000, 36, 150, 204],
  [Infinity, 40, 170, 220],
]

/**
 * Art. 4, Dec. 1338/96.
 * Calcula los trabajadores equivalentes.
 * Operativos = tareas de producción/operación.
 * Administrativos = tareas administrativas (cuentan al 50%).
 */
export function calcularEquivalentes(operativos: number, administrativos: number): number {
  return operativos + 0.5 * administrativos
}

/**
 * Art. 12, Dec. 1338/96.
 * Devuelve las horas profesionales mensuales del servicio de HyS.
 * - Si equivalentes === 0 → 0
 * - Tomá el primer tramo cuyo límite superior ≥ equivalentes.
 */
export function calcularHorasProfesionalHyS(equivalentes: number, categoria: CategoriaHyS): number {
  if (equivalentes <= 0) return 0
  const colIdx = categoria === 'A' ? 1 : categoria === 'B' ? 2 : 3
  const fila = TABLA_ART12.find(([limite]) => limite >= equivalentes)
  return fila ? fila[colIdx] : 0
}

// Tests mentales (validados al momento de escritura):
// calcularEquivalentes(10, 5)               → 12.5
// calcularHorasProfesionalHyS(12.5, 'C')   → 4    (tramo 1–15, col C)
// calcularHorasProfesionalHyS(200, 'B')    → 30   (tramo 151–250, col B)
// calcularHorasProfesionalHyS(0, 'A')      → 0
// calcularHorasProfesionalHyS(5000, 'A')   → 40   (tramo >3000, col A)
