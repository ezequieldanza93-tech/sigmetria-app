import { describe, it, expect } from 'vitest'
import { calcularPrecioFinal, generarCuotasAnuales } from './descuento'

describe('calcularPrecioFinal', () => {
  // Caso 1: monthly sin founder — sin descuentos
  it('monthly sin founder: precioFinal == lista, descuentos = 0', () => {
    const result = calcularPrecioFinal(24000, 'monthly', false)
    expect(result).not.toBeNull()
    expect(result!.precioBase).toBe(24000)
    expect(result!.precioFinal).toBe(24000)
    expect(result!.descuentoAnualPct).toBe(0)
    expect(result!.descuentoFounderPct).toBe(0)
    expect(result!.ahorroTotal).toBe(0)
    expect(result!.ahorroTotalPct).toBe(0)
  })

  // Caso 2: annual sin founder — descuento 20%
  it('annual sin founder: precioFinal = 24000×12×0.8 = 230400', () => {
    const result = calcularPrecioFinal(24000, 'annual', false)
    expect(result).not.toBeNull()
    expect(result!.precioBase).toBe(288000)
    expect(result!.precioFinal).toBe(230400)
    expect(result!.descuentoAnualPct).toBe(20)
    expect(result!.descuentoFounderPct).toBe(0)
    expect(result!.ahorroTotal).toBe(57600)
    expect(result!.ahorroTotalPct).toBe(20)
  })

  // Caso 3: annual con founder — descuento 36%
  it('annual con founder: precioFinal = 184320, ahorroTotalPct = 36', () => {
    const result = calcularPrecioFinal(24000, 'annual', true)
    expect(result).not.toBeNull()
    expect(result!.precioBase).toBe(288000)
    expect(result!.precioFinal).toBe(184320)
    expect(result!.descuentoAnualPct).toBe(20)
    expect(result!.descuentoFounderPct).toBe(20)
    expect(result!.ahorroTotal).toBe(103680)
    expect(result!.ahorroTotalPct).toBe(36)
  })

  // Caso 4: monthly con founder — debe tirar error
  it('monthly con founder: throws', () => {
    expect(() => calcularPrecioFinal(24000, 'monthly', true)).toThrow(
      'Fundador solo aplica a ciclo anual',
    )
  })

  // Caso 5: null precio — retorna null (plan "empresa")
  it('precioListaMensual null: retorna null', () => {
    expect(calcularPrecioFinal(null, 'annual', false)).toBeNull()
    expect(calcularPrecioFinal(null, 'monthly', false)).toBeNull()
  })

  // Caso 6: valores numéricos sanos — sin negativos ni NaN
  it('no produce valores negativos ni NaN', () => {
    const casos: Array<[number, 'monthly' | 'annual', boolean]> = [
      [1000, 'monthly', false],
      [1000, 'annual', false],
      [1000, 'annual', true],
      [0, 'monthly', false],
      [0, 'annual', false],
    ]
    for (const [precio, ciclo, esFounder] of casos) {
      const r = calcularPrecioFinal(precio, ciclo, esFounder)
      if (r === null) continue
      expect(isNaN(r.precioFinal)).toBe(false)
      expect(isNaN(r.ahorroTotal)).toBe(false)
      expect(isNaN(r.ahorroTotalPct)).toBe(false)
      expect(r.precioFinal).toBeGreaterThanOrEqual(0)
      expect(r.ahorroTotal).toBeGreaterThanOrEqual(0)
      expect(r.ahorroTotalPct).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('generarCuotasAnuales', () => {
  it('genera 3 cuotas con suma correcta', () => {
    const subId = '00000000-0000-0000-0000-000000000001'
    const planId = '00000000-0000-0000-0000-000000000002'
    // Usar constructor local (año, mes 0-indexed, día) para evitar el UTC midnight
    // shift en zonas horarias UTC- o UTC+.
    const desde = new Date(2026, 6, 1) // 1 de julio de 2026 en hora local
    const cuotas = generarCuotasAnuales(subId, planId, 184320, desde)

    expect(cuotas).toHaveLength(3)
    expect(cuotas[0].nro_cuota).toBe(1)
    expect(cuotas[1].nro_cuota).toBe(2)
    expect(cuotas[2].nro_cuota).toBe(3)

    // Los offsets en meses (cuota 1: jul, cuota 2: nov, cuota 3: mar)
    expect(cuotas[0].fecha_programada).toBe('2026-07-01')
    expect(cuotas[1].fecha_programada).toBe('2026-11-01')
    expect(cuotas[2].fecha_programada).toBe('2027-03-01')

    // La suma debe ser exactamente precioFinal
    const total = cuotas.reduce((acc, c) => acc + c.monto, 0)
    expect(Math.round(total * 100)).toBe(Math.round(184320 * 100))
  })

  it('cada cuota tiene subscription_id y plan_id correctos', () => {
    const subId = 'sub-abc'
    const planId = 'plan-xyz'
    const cuotas = generarCuotasAnuales(subId, planId, 9000)
    cuotas.forEach(c => {
      expect(c.subscription_id).toBe(subId)
      expect(c.plan_id).toBe(planId)
      expect(c.ciclo).toBe('annual')
      expect(c.total_cuotas).toBe(3)
      expect(c.estado).toBe('pendiente')
    })
  })
})
