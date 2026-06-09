import { describe, it, expect } from 'vitest'
import {
  coefEquiv,
  equivMadera,
  cargaFuego,
  franjaQf,
  PCI_MADERA_KCAL,
  type MaterialCarga,
} from './calculos'

describe('coefEquiv', () => {
  it('madera (4400 kcal/kg) → 1', () => {
    expect(coefEquiv(PCI_MADERA_KCAL)).toBe(1)
  })

  it('nafta (11000 kcal/kg) → 2.5', () => {
    expect(coefEquiv(11000)).toBe(2.5)
  })

  it('papel/cartón (3900 kcal/kg) ≈ 0.886', () => {
    expect(coefEquiv(3900)).toBeCloseTo(0.886, 3)
  })

  it('valor no finito → 0', () => {
    expect(coefEquiv(NaN)).toBe(0)
    expect(coefEquiv(Infinity)).toBe(0)
  })
})

describe('equivMadera', () => {
  it('madera 2000 kg con C 1.0 → 2000', () => {
    expect(equivMadera(2000, 1.0)).toBe(2000)
  })

  it('gasoil 400 kg con C 2.318 → 927.2', () => {
    expect(equivMadera(400, 2.318)).toBeCloseTo(927.2, 4)
  })

  it('peso o coeficiente no finito → 0', () => {
    expect(equivMadera(NaN, 1)).toBe(0)
    expect(equivMadera(100, NaN)).toBe(0)
  })
})

describe('cargaFuego', () => {
  // Ejemplo del instructivo:
  // cartón 3000 (C 0.886) + madera 2000 (1.0) + PE 800 (2.386) + gasoil 400 (2.318) / 200
  const ejemplo: MaterialCarga[] = [
    { peso: 3000, c: 0.886 },
    { peso: 2000, c: 1.0 },
    { peso: 800, c: 2.386 },
    { peso: 400, c: 2.318 },
  ]

  it('ejemplo del instructivo → ≈ 37.5 kg/m²', () => {
    // Σ = 2658 + 2000 + 1908.8 + 927.2 = 7494 ; 7494 / 200 = 37.47
    expect(cargaFuego(ejemplo, 200)).toBeCloseTo(37.47, 2)
  })

  it('un solo material', () => {
    expect(cargaFuego([{ peso: 2000, c: 1 }], 100)).toBe(20)
  })

  it('lista vacía → 0', () => {
    expect(cargaFuego([], 200)).toBe(0)
  })

  it('superficie 0 → 0 (sin división por cero)', () => {
    expect(cargaFuego(ejemplo, 0)).toBe(0)
  })

  it('superficie negativa o no finita → 0', () => {
    expect(cargaFuego(ejemplo, -50)).toBe(0)
    expect(cargaFuego(ejemplo, NaN)).toBe(0)
  })
})

describe('franjaQf', () => {
  it('Qf del ejemplo (37.47) → "31 a 60"', () => {
    expect(franjaQf(37.47)).toBe('31 a 60')
  })

  it('límites de cada franja', () => {
    expect(franjaQf(0)).toBe('Hasta 15')
    expect(franjaQf(15)).toBe('Hasta 15')
    expect(franjaQf(15.1)).toBe('16 a 30')
    expect(franjaQf(30)).toBe('16 a 30')
    expect(franjaQf(30.1)).toBe('31 a 60')
    expect(franjaQf(60)).toBe('31 a 60')
    expect(franjaQf(60.1)).toBe('61 a 100')
    expect(franjaQf(100)).toBe('61 a 100')
    expect(franjaQf(100.1)).toBe('>100')
    expect(franjaQf(500)).toBe('>100')
  })

  it('valor no finito → "Hasta 15" (fallback seguro)', () => {
    expect(franjaQf(NaN)).toBe('Hasta 15')
  })
})
