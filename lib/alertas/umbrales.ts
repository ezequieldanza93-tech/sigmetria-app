/**
 * Lógica PURA de umbrales de alerta temprana (autocontrol — Art. 4.9).
 *
 * Separada del acceso a DB para poder testearla sin Supabase. Decide, dado un
 * vencimiento y un set de umbrales configurados (ej. 30/15/7 días), qué umbral
 * dispara HOY — y con qué severidad — evitando spamear: dispara UNA sola vez por
 * cruce de umbral (el día exacto en que dias_restantes coincide con un umbral).
 */

export interface UmbralConfig {
  dias_antes: number
  severidad: 'info' | 'warning' | 'critical'
  activo?: boolean
}

export interface UmbralDisparo {
  dias_antes: number
  severidad: 'info' | 'warning' | 'critical'
}

/**
 * Días enteros entre hoy y la fecha de vencimiento (ambos a medianoche).
 * Negativo si ya venció. Determinístico: recibe la referencia "hoy".
 */
export function diasHastaVencimiento(fechaVencimientoISO: string, hoy: Date): number {
  const venc = new Date(fechaVencimientoISO + 'T00:00:00')
  const base = new Date(hoy)
  base.setHours(0, 0, 0, 0)
  return Math.ceil((venc.getTime() - base.getTime()) / 86400000)
}

/**
 * Devuelve el umbral que dispara HOY para un vencimiento dado, o null.
 *
 * Anti-spam: SOLO dispara el día exacto en que `dias_restantes` iguala un umbral
 * configurado y activo (no todos los días dentro de la ventana). Si dos umbrales
 * coincidieran en el mismo día (config inválida), gana el de mayor severidad.
 */
export function umbralQueDispara(
  diasRestantes: number,
  umbrales: UmbralConfig[],
): UmbralDisparo | null {
  const sevRank: Record<UmbralConfig['severidad'], number> = { critical: 0, warning: 1, info: 2 }
  const candidatos = umbrales
    .filter(u => u.activo !== false && u.dias_antes === diasRestantes)
    .sort((a, b) => sevRank[a.severidad] - sevRank[b.severidad])
  const ganador = candidatos[0]
  return ganador ? { dias_antes: ganador.dias_antes, severidad: ganador.severidad } : null
}

/**
 * Agrupa una lista de ítems alertables por consultora para emitir UN aviso por
 * consultora (anti-spam). Devuelve un Map consultora_id → ítems.
 */
export function agruparPorConsultora<T extends { consultora_id: string }>(
  items: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const it of items) {
    const arr = map.get(it.consultora_id) ?? []
    arr.push(it)
    map.set(it.consultora_id, arr)
  }
  return map
}
