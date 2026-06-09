/**
 * Cálculos PUROS del Cálculo de Carga de Fuego (Dec 351/79 Anexo VII).
 *
 * Funciones sin efectos secundarios: las comparte la UI (wizard en vivo) y, más
 * adelante, el generador de PDF oficial. NO importan nada de Supabase, React ni
 * el DOM — son matemática pura sobre los datos del instructivo.
 *
 * Conceptos del Anexo VII:
 *  - Coeficiente C de un material = PCI(kcal/kg) / 4400, donde 4400 kcal/kg es el
 *    PCI de la madera (material de referencia → C = 1).
 *  - Equivalente en madera de un material = peso(kg) · C.
 *  - Carga de fuego (Qf) de un sector = Σ(peso·C) / superficie(m²)  [kg equiv. madera / m²].
 *  - La franja de Qf clasifica el sector para cruzar contra los cuadros de
 *    resistencia al fuego (F) y potencial extintor.
 */

/** PCI de referencia (madera) en kcal/kg. La madera tiene coeficiente C = 1. */
export const PCI_MADERA_KCAL = 4400

/**
 * Coeficiente C de un material respecto a la madera.
 *   C = pci_kcal / 4400
 * Si pci_kcal no es finito → 0 (sin dato no aporta equivalente).
 *
 * Ejemplo: coefEquiv(4400) = 1 (madera); coefEquiv(11000) = 2.5 (nafta).
 */
export function coefEquiv(pci_kcal: number): number {
  if (!Number.isFinite(pci_kcal)) return 0
  return pci_kcal / PCI_MADERA_KCAL
}

/**
 * Equivalente en madera de un material (kg).
 *   equiv = peso · C
 * Pesos / coeficientes no finitos → 0.
 *
 * Ejemplo: equivMadera(2000, 1) = 2000; equivMadera(400, 2.318) = 927.2
 */
export function equivMadera(peso: number, c: number): number {
  if (!Number.isFinite(peso) || !Number.isFinite(c)) return 0
  return peso * c
}

/** Material de entrada para el cálculo de carga de fuego (peso + coeficiente C). */
export interface MaterialCarga {
  peso: number
  c: number
}

/**
 * Carga de fuego (Qf) de un sector en kg equivalente de madera por m².
 *   Qf = Σ(peso · C) / superficie
 * Si la superficie es 0 o no finita → 0 (evita división por cero).
 *
 * Ejemplo del instructivo:
 *   cartón 3000 (C 0.886) + madera 2000 (1.0) + PE 800 (2.386) + gasoil 400 (2.318)
 *   Σ = 2658 + 2000 + 1908.8 + 927.2 = 7494
 *   Qf = 7494 / 200 ≈ 37.47 kg/m²  → franja '31 a 60'
 */
export function cargaFuego(materiales: MaterialCarga[], superficie: number): number {
  if (!Number.isFinite(superficie) || superficie <= 0) return 0
  const totalEquiv = materiales.reduce((acc, m) => acc + equivMadera(m.peso, m.c), 0)
  return totalEquiv / superficie
}

/**
 * Franja de carga de fuego a la que pertenece un Qf (kg equiv. madera / m²).
 * Las franjas del instructivo son los tramos usados por los cuadros de
 * resistencia al fuego y potencial extintor.
 *
 *   Qf ≤ 15            → 'Hasta 15'
 *   15 < Qf ≤ 30       → '16 a 30'
 *   30 < Qf ≤ 60       → '31 a 60'
 *   60 < Qf ≤ 100      → '61 a 100'
 *   Qf > 100           → '>100'
 *
 * Ejemplo: franjaQf(37.47) = '31 a 60'.
 */
export type FranjaQf = 'Hasta 15' | '16 a 30' | '31 a 60' | '61 a 100' | '>100'

export function franjaQf(qf: number): FranjaQf {
  if (!Number.isFinite(qf) || qf <= 15) return 'Hasta 15'
  if (qf <= 30) return '16 a 30'
  if (qf <= 60) return '31 a 60'
  if (qf <= 100) return '61 a 100'
  return '>100'
}
