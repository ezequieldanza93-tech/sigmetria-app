/**
 * lib/billing/descuento.ts
 *
 * Lógica pura de cálculo de precios del Programa Fundadores.
 * Sin imports de Supabase — testeable de forma aislada.
 */

export interface PrecioCalculado {
  /** Precio sin descuentos (mensual o anual según ciclo) */
  precioBase: number
  /** Precio final aplicando todos los descuentos */
  precioFinal: number
  /** 0 o 20 */
  descuentoAnualPct: number
  /** 0 o 20 */
  descuentoFounderPct: number
  /** precioBase - precioFinal */
  ahorroTotal: number
  /** 0, 20 o 36 */
  ahorroTotalPct: number
}

/**
 * Versión nullable: null para planes "empresa" (precio null).
 */
export type PrecioCalculadoNullable = PrecioCalculado | null

/**
 * Calcula el precio final aplicando descuentos por ciclo anual y/o Fundador.
 *
 * Reglas:
 * - precioListaMensual = null → retorna null (plan "empresa", precio a convenir)
 * - monthly + no founder  → precioFinal = precioListaMensual, sin descuentos
 * - annual  + no founder  → precioFinal = precioListaMensual × 12 × 0.8 (−20%)
 * - annual  + founder     → precioFinal = precioListaMensual × 12 × 0.8 × 0.8 (−36%)
 * - monthly + founder     → throws (Fundador solo aplica a ciclo anual)
 *
 * Verificación annual+founder: calcularPrecioFinal(24000, 'annual', true)
 *   precioBase  = 24000 × 12     = 288 000
 *   precioFinal = 24000 × 12 × 0.64 = 184 320
 *   ahorroTotal = 103 680, ahorroTotalPct = 36
 */
export function calcularPrecioFinal(
  precioListaMensual: number | null,
  ciclo: 'monthly' | 'annual',
  esFounder: boolean,
): PrecioCalculadoNullable {
  if (precioListaMensual === null) return null

  if (ciclo === 'monthly' && esFounder) {
    throw new Error('Fundador solo aplica a ciclo anual')
  }

  const precioBase = ciclo === 'annual'
    ? precioListaMensual * 12
    : precioListaMensual

  let precioFinal: number
  let descuentoAnualPct = 0
  let descuentoFounderPct = 0

  if (ciclo === 'monthly') {
    // Sin descuentos
    precioFinal = precioListaMensual
  } else if (!esFounder) {
    // Anual sin founder: −20%
    descuentoAnualPct = 20
    precioFinal = precioListaMensual * 12 * 0.8
  } else {
    // Anual con founder: −20% anual × −20% founder = −36%
    descuentoAnualPct = 20
    descuentoFounderPct = 20
    precioFinal = precioListaMensual * 12 * 0.8 * 0.8
  }

  const ahorroTotal = precioBase - precioFinal
  const ahorroTotalPct = precioBase > 0
    ? Math.round((ahorroTotal / precioBase) * 100)
    : 0

  return {
    precioBase,
    precioFinal,
    descuentoAnualPct,
    descuentoFounderPct,
    ahorroTotal,
    ahorroTotalPct,
  }
}

/**
 * Genera los registros de cuotas anuales para `payment_installments`.
 *
 * El plan anual se fracciona en 3 cobros:
 *   - Cuota 1: al contratar (inmediata)
 *   - Cuota 2: a los 4 meses
 *   - Cuota 3: a los 8 meses
 *
 * `montoPorCuota` = precioFinal / 3, redondeado a 2 decimales.
 * La última cuota absorbe el centavo sobrante para que la suma == precioFinal exacto.
 */
export function generarCuotasAnuales(
  subscriptionId: string,
  planId: string,
  precioFinal: number,
  desde: Date = new Date(),
): Array<{
  subscription_id: string
  plan_id: string
  ciclo: string
  nro_cuota: number
  total_cuotas: number
  monto: number
  estado: string
  fecha_programada: string
}> {
  const totalCuotas = 3
  const montoPorCuota = Math.round((precioFinal / totalCuotas) * 100) / 100

  // Offsetes en meses para cada cuota
  const offsetMeses = [0, 4, 8]

  return offsetMeses.map((offset, index) => {
    const nroCuota = index + 1
    // Calcular fecha destino sin overflow de día.
    // JS setMonth(n) desborda si el día fuente no existe en el mes destino
    // (ej: 31-jul + 4 meses = 31-nov → JS coerce a 1-dic).
    // Solución: crear siempre desde año/mes y setear el día al mínimo entre
    // el día origen y el último día del mes destino.
    const year = desde.getFullYear()
    const month = desde.getMonth() + offset
    const targetYear = year + Math.floor(month / 12)
    const targetMonth = ((month % 12) + 12) % 12
    const dayOrigen = desde.getDate()
    // Último día del mes destino
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
    const targetDay = Math.min(dayOrigen, lastDay)
    const fecha = new Date(targetYear, targetMonth, targetDay)

    // La última cuota absorbe el sobrante por redondeo
    const monto = nroCuota === totalCuotas
      ? Math.round((precioFinal - montoPorCuota * (totalCuotas - 1)) * 100) / 100
      : montoPorCuota

    return {
      subscription_id: subscriptionId,
      plan_id: planId,
      ciclo: 'annual',
      nro_cuota: nroCuota,
      total_cuotas: totalCuotas,
      monto,
      estado: 'pendiente',
      // Formatear como YYYY-MM-DD en hora local (sin conversión UTC que puede desfasar
      // un día en zonas UTC- o UTC+).
      fecha_programada: [
        String(fecha.getFullYear()),
        String(fecha.getMonth() + 1).padStart(2, '0'),
        String(fecha.getDate()).padStart(2, '0'),
      ].join('-'),
    }
  })
}
