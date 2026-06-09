/**
 * Cálculos PUROS del Protocolo de Medición de Puesta a Tierra (PAT — SRT 900/2015).
 *
 * Funciones sin efectos secundarios: las comparten la UI (wizard en vivo) y, más
 * adelante, el generador de PDF oficial. NO importan nada de Supabase, React ni
 * el DOM — son matemática pura sobre los datos del protocolo.
 *
 * Referencias del protocolo:
 *  - El valor exigido (Ra máx) de la resistencia de puesta a tierra depende del
 *    dispositivo de protección y de su corriente de actuación. Para un diferencial
 *    de uso general (IΔn ≤ 300 mA), el criterio práctico habitual es Ra ≤ 40 Ω.
 *  - Cumplimiento: la toma cumple cuando el valor medido (Ω) es menor o igual al
 *    valor exigido (Ω).
 */

/** Valor exigido por defecto (Ω) para una toma protegida con diferencial general. */
export const RA_MAX_DEFAULT_TT = 40

/**
 * Resistencia máxima admisible (Ra máx, en Ω) para un esquema TT protegido por
 * diferencial, según su corriente diferencial nominal (IΔn, en mA).
 *
 * Criterio: para diferenciales de uso general (IΔn ≤ 300 mA) el valor de referencia
 * práctico es 40 Ω (Ra ≤ 50 V / IΔn, redondeado al criterio de la SRT). Si no se
 * informa la IΔn, se asume el caso por defecto (≤ 300 mA → 40 Ω).
 *
 * Ejemplos:
 *   raMaxTT()      = 40   (sin dato → caso por defecto)
 *   raMaxTT(30)    = 40
 *   raMaxTT(300)   = 40
 *   raMaxTT(500)   = 100  (50 V / 0.5 A)
 */
export function raMaxTT(idnMa?: number | null): number {
  if (idnMa == null || !Number.isFinite(idnMa) || idnMa <= 0) return RA_MAX_DEFAULT_TT
  if (idnMa <= 300) return RA_MAX_DEFAULT_TT
  // Tensión de contacto límite (50 V) sobre la corriente de actuación (A).
  return 50 / (idnMa / 1000)
}

/**
 * Cumplimiento de una toma: el valor medido (Ω) debe ser ≤ al valor exigido (Ω).
 *
 * Si falta alguno de los dos valores devuelve null (sin dato suficiente para decidir).
 *
 * Ejemplos:
 *   cumpleToma(15, 40) = true
 *   cumpleToma(40, 40) = true
 *   cumpleToma(55, 40) = false
 *   cumpleToma(null, 40) = null
 */
export function cumpleToma(
  valorMedidoOhm: number | null | undefined,
  valorExigidoOhm: number | null | undefined,
): boolean | null {
  if (valorMedidoOhm == null || !Number.isFinite(valorMedidoOhm)) return null
  if (valorExigidoOhm == null || !Number.isFinite(valorExigidoOhm)) return null
  return valorMedidoOhm <= valorExigidoOhm
}
