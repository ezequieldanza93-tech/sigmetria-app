/**
 * Cálculos PUROS del Protocolo de Medición de Ruido (SRT 85/2012 — Res 295/03 Anexo V).
 *
 * Funciones sin efectos secundarios: las comparten la UI (wizard en vivo) y, más
 * adelante, el generador de PDF oficial. NO importan nada de Supabase, React ni
 * el DOM — son matemática pura sobre los datos del instructivo.
 *
 * Referencias del instructivo (criterio 85 dBA / 3 dB de tasa de cambio):
 *  - Tiempo máximo de exposición permitido (Tmax) en horas para un nivel LAeq.
 *  - Dosis acumulada D: suma de fracciones tiempo_expuesto / Tmax por período.
 *    Solo computan los períodos con LAeq ≥ 80 dBA (debajo de 80 no se considera).
 *  - Cumplimiento de dosis: D ≤ 1 (100%).
 *  - Cumplimiento de pico: Lcpico ≤ 140 dBC (sin pico declarado → cumple).
 *  - Ruido estable: variación (max - min) de niveles ≤ 5 dBA.
 */

/**
 * Tiempo máximo de exposición permitido (horas) para un nivel LAeq dado.
 *   Tmax = 8 / 2^((LAeq - 85) / 3)
 * Base: 85 dBA para 8 h, con tasa de cambio de 3 dB (cada +3 dBA halva el tiempo).
 *
 * Ejemplos:
 *   tiempoMaxPermitido(85)  = 8
 *   tiempoMaxPermitido(88)  = 4
 *   tiempoMaxPermitido(91)  = 2
 *   tiempoMaxPermitido(94)  = 1
 *   tiempoMaxPermitido(82)  = 16
 *   tiempoMaxPermitido(100) = 0.25
 */
export function tiempoMaxPermitido(laeq: number): number {
  return 8 / Math.pow(2, (laeq - 85) / 3)
}

/** Período de exposición para el cálculo de dosis (método sonómetro). */
export interface PeriodoExposicion {
  laeq_dba: number
  tiempo_exposicion_horas: number
}

/**
 * Dosis acumulada de ruido (D, adimensional; D = 1 ⇔ 100%).
 *   D = Σ ( tiempo_exposicion_horas / Tmax(LAeq) )  para cada período con LAeq ≥ 80.
 *
 * Los períodos con LAeq < 80 dBA NO se computan (no aportan dosis significativa
 * según el instructivo). La suma se hace sobre la lista provista.
 *
 * Ejemplo:
 *   dosis([{88,1},{91,1},{82,4},{87,2}]) ≈ 1.397
 *     88 → 1/4   = 0.25
 *     91 → 1/2   = 0.5
 *     82 → 4/16  = 0.25
 *     87 → 2/5.0397 ≈ 0.3969
 */
export function dosis(periodos: PeriodoExposicion[]): number {
  if (!Array.isArray(periodos)) return 0
  return periodos.reduce((acc, p) => {
    if (p.laeq_dba < 80) return acc
    const tmax = tiempoMaxPermitido(p.laeq_dba)
    if (!Number.isFinite(tmax) || tmax <= 0) return acc
    return acc + p.tiempo_exposicion_horas / tmax
  }, 0)
}

/**
 * Dosis expresada en porcentaje.
 *   dosisPct(D) = D · 100
 */
export function dosisPct(D: number): number {
  return D * 100
}

/**
 * Cumplimiento de dosis: D ≤ 1 (100%).
 */
export function cumpleDosis(D: number): boolean {
  return D <= 1
}

/**
 * Cumplimiento de nivel pico (Lcpico): ≤ 140 dBC.
 * Si no hay pico declarado (null) → se considera cumplido (no aplica el criterio).
 */
export function cumplePico(lcpico: number | null): boolean {
  return lcpico == null ? true : lcpico <= 140
}

/**
 * Ruido estable: la variación entre el máximo y el mínimo de los niveles
 * medidos es ≤ 5 dBA. Lista vacía → true (no hay variación).
 *
 * Ejemplos:
 *   ruidoEstable([80, 84]) = true   (4 ≤ 5)
 *   ruidoEstable([80, 86]) = false  (6 > 5)
 */
export function ruidoEstable(niveles: number[]): boolean {
  if (!Array.isArray(niveles) || niveles.length === 0) return true
  return Math.max(...niveles) - Math.min(...niveles) <= 5
}
