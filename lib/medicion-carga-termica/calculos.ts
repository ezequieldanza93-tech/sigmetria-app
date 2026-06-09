/**
 * Cálculos PUROS del Protocolo de Estrés Térmico por Calor / Carga Térmica
 * (SRT 30/2023).
 *
 * Funciones sin efectos secundarios: las comparten la UI (wizard en vivo) y, más
 * adelante, el generador de PDF oficial. NO importan nada de Supabase, React ni
 * el DOM — son matemática pura sobre los datos del instructivo.
 *
 * Referencias del instructivo:
 *  - TGBH (Temperatura de Globo y Bulbo Húmedo): índice de estrés térmico.
 *    Interior:  0.7·tbh + 0.3·tg
 *    Exterior:  0.7·tbh + 0.2·tg + 0.1·tbs  (con carga solar)
 *  - Ponderación temporal: promedio ponderado por tiempo dentro del período de 60 min.
 *  - TGBH efectivo (TGBHef): TGBH ponderado + VAR ponderado (adición por ropa).
 *  - VLP (Valor Límite Permisible, NO aclimatado): 56.7 − 11.5·log10(TM)
 *  - VLA (Valor Límite de Acción, aclimatado):      59.9 − 14.1·log10(TM)
 *  - Régimen trabajo/descanso (f/t): minutos de trabajo cuando se supera el límite.
 */

/**
 * TGBH para ambiente INTERIOR o sin carga solar.
 *   TGBH = 0.7·tbh + 0.3·tg
 * tbh = temperatura de bulbo húmedo natural; tg = temperatura de globo.
 *
 * Ejemplo: tgbhInterior(25, 30) = 0.7·25 + 0.3·30 = 26.5
 */
export function tgbhInterior(tbh: number, tg: number): number {
  return 0.7 * tbh + 0.3 * tg
}

/**
 * TGBH para ambiente EXTERIOR con carga solar.
 *   TGBH = 0.7·tbh + 0.2·tg + 0.1·tbs
 * tbs = temperatura de bulbo seco.
 */
export function tgbhExterior(tbh: number, tg: number, tbs: number): number {
  return 0.7 * tbh + 0.2 * tg + 0.1 * tbs
}

/**
 * Promedio ponderado por tiempo.
 *   Σ(valor·tiempo) / Σtiempo
 * Si la suma de tiempos es 0 (sin tareas con tiempo) → 0 (evita división por cero).
 *
 * Ejemplo: ponderar([{valor:40,tiempo:1},{valor:20,tiempo:1}]) = (40+20)/2 = 30
 */
export function ponderar(items: Array<{ valor: number; tiempo: number }>): number {
  let sumaPesos = 0
  let sumaTiempo = 0
  for (const it of items) {
    if (!Number.isFinite(it.valor) || !Number.isFinite(it.tiempo)) continue
    sumaPesos += it.valor * it.tiempo
    sumaTiempo += it.tiempo
  }
  if (sumaTiempo === 0) return 0
  return sumaPesos / sumaTiempo
}

/**
 * TGBH efectivo = TGBH ponderado + VAR ponderado (adición por ropa).
 */
export function tgbhEf(tgbhPonderado: number, varPonderado: number): number {
  return tgbhPonderado + varPonderado
}

/**
 * Valor Límite Permisible (trabajador NO aclimatado), en °C-TGBH.
 *   VLP = 56.7 − 11.5·log10(TM)
 * TM = tasa metabólica ponderada (W). Si TM ≤ 0 → 0 (no aplica el log).
 *
 * Ejemplo: vlp(207) ≈ 30.1
 */
export function vlp(tm: number): number {
  if (tm <= 0) return 0
  return 56.7 - 11.5 * Math.log10(tm)
}

/**
 * Valor Límite de Acción (trabajador aclimatado), en °C-TGBH.
 *   VLA = 59.9 − 14.1·log10(TM)
 * Si TM ≤ 0 → 0.
 *
 * Ejemplo: vla(207) ≈ 27.2
 */
export function vla(tm: number): number {
  if (tm <= 0) return 0
  return 59.9 - 14.1 * Math.log10(tm)
}

/**
 * Régimen de trabajo/descanso (f/t): minutos de trabajo por hora cuando se supera
 * el límite. Interpola entre el TGBH del puesto y el TGBH de la zona de descanso.
 *   ft = (31.7 − B) / (31.7 − D) · 60
 * B = TGBH de la zona de descanso; D = TGBH (límite) del puesto.
 * Si el denominador es 0 (31.7 = D) → 0 (evita división por cero).
 */
export function regimenFt(B: number, D: number): number {
  const denominador = 31.7 - D
  if (denominador === 0) return 0
  return ((31.7 - B) / denominador) * 60
}

/**
 * ¿El TGBH efectivo supera el VLP (límite del NO aclimatado)?
 */
export function superaVlp(tgbhefValor: number, tm: number): boolean {
  return tgbhefValor > vlp(tm)
}

/**
 * ¿El TGBH efectivo supera el VLA (límite del aclimatado)?
 */
export function superaVla(tgbhefValor: number, tm: number): boolean {
  return tgbhefValor > vla(tm)
}
