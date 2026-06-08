import { describe, it, expect } from 'vitest'
import {
  tiempoMaxPermitido,
  dosis,
  dosisPct,
  cumpleDosis,
  cumplePico,
  ruidoEstable,
} from './calculos'

describe('tiempoMaxPermitido', () => {
  it('85 dBA → 8 h (base del criterio)', () => {
    expect(tiempoMaxPermitido(85)).toBe(8)
  })

  it('88 dBA → 4 h (+3 dB halva)', () => {
    expect(tiempoMaxPermitido(88)).toBe(4)
  })

  it('91 dBA → 2 h', () => {
    expect(tiempoMaxPermitido(91)).toBe(2)
  })

  it('94 dBA → 1 h', () => {
    expect(tiempoMaxPermitido(94)).toBe(1)
  })

  it('82 dBA → 16 h (-3 dB duplica)', () => {
    expect(tiempoMaxPermitido(82)).toBe(16)
  })

  it('100 dBA → 0.25 h', () => {
    expect(tiempoMaxPermitido(100)).toBeCloseTo(0.25, 10)
  })
})

describe('dosis', () => {
  const periodos = [
    { laeq_dba: 88, tiempo_exposicion_horas: 1 },
    { laeq_dba: 91, tiempo_exposicion_horas: 1 },
    { laeq_dba: 82, tiempo_exposicion_horas: 4 },
    { laeq_dba: 87, tiempo_exposicion_horas: 2 },
  ]

  it('suma de fracciones de los 4 períodos ≈ 1.38', () => {
    expect(dosis(periodos)).toBeCloseTo(1.38, 1)
  })

  it('esa dosis NO cumple (> 1)', () => {
    expect(cumpleDosis(dosis(periodos))).toBe(false)
  })

  it('ignora períodos por debajo de 80 dBA', () => {
    // Solo el de 88 dBA computa (1/4 = 0.25); el de 70 no aporta.
    const mix = [
      { laeq_dba: 88, tiempo_exposicion_horas: 1 },
      { laeq_dba: 70, tiempo_exposicion_horas: 8 },
    ]
    expect(dosis(mix)).toBeCloseTo(0.25, 10)
  })

  it('lista vacía → 0', () => {
    expect(dosis([])).toBe(0)
  })
})

describe('dosisPct', () => {
  it('D · 100', () => {
    expect(dosisPct(1)).toBe(100)
    expect(dosisPct(0.5)).toBe(50)
  })
})

describe('cumpleDosis', () => {
  it('D = 1 (límite exacto) → true', () => {
    expect(cumpleDosis(1)).toBe(true)
  })

  it('D < 1 → true', () => {
    expect(cumpleDosis(0.8)).toBe(true)
  })

  it('D > 1 → false', () => {
    expect(cumpleDosis(1.38)).toBe(false)
  })
})

describe('cumplePico', () => {
  it('140 dBC (límite exacto) → true', () => {
    expect(cumplePico(140)).toBe(true)
  })

  it('141 dBC → false', () => {
    expect(cumplePico(141)).toBe(false)
  })

  it('sin pico declarado (null) → true', () => {
    expect(cumplePico(null)).toBe(true)
  })
})

describe('ruidoEstable', () => {
  it('[80, 84] → true (variación 4 ≤ 5)', () => {
    expect(ruidoEstable([80, 84])).toBe(true)
  })

  it('[80, 86] → false (variación 6 > 5)', () => {
    expect(ruidoEstable([80, 86])).toBe(false)
  })

  it('límite exacto: variación = 5 → true', () => {
    expect(ruidoEstable([80, 85])).toBe(true)
  })

  it('lista vacía → true', () => {
    expect(ruidoEstable([])).toBe(true)
  })
})
