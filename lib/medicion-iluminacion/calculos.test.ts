import { describe, it, expect } from 'vitest'
import {
  indiceLocal,
  numeroMinimoPuntos,
  eMedia,
  eMinima,
  cumpleUniformidad,
  cumpleNivel,
  generalRequeridaLocalizada,
} from './calculos'

// Valores del Punto 1 del instructivo (16 mediciones en lux).
const PUNTO_1 = [200, 250, 250, 200, 95, 100, 90, 80, 68, 76, 90, 80, 80, 85, 100, 100]

describe('indiceLocal', () => {
  it('ejemplo del instructivo: 10 x 40, altura 4 → 2', () => {
    expect(indiceLocal(10, 40, 4)).toBe(2)
  })

  it('denominador 0 (altura 0) → 0', () => {
    expect(indiceLocal(10, 40, 0)).toBe(0)
  })

  it('denominador 0 (largo+ancho 0) → 0', () => {
    expect(indiceLocal(0, 0, 4)).toBe(0)
  })
})

describe('numeroMinimoPuntos', () => {
  it('k = 2 → 16', () => {
    expect(numeroMinimoPuntos(2)).toBe(16)
  })

  it('k = 0.93 → 9', () => {
    expect(numeroMinimoPuntos(0.93)).toBe(9)
  })

  it('k = 3.5 → 36 (tope x = 4)', () => {
    expect(numeroMinimoPuntos(3.5)).toBe(36)
  })

  it('k = 3 exacto → 36', () => {
    expect(numeroMinimoPuntos(3)).toBe(36)
  })

  it('k <= 0 → 0', () => {
    expect(numeroMinimoPuntos(0)).toBe(0)
    expect(numeroMinimoPuntos(-1)).toBe(0)
  })
})

describe('eMedia', () => {
  it('los 16 valores del Punto 1 → 121.5', () => {
    expect(eMedia(PUNTO_1)).toBe(121.5)
  })

  it('lista vacía → 0', () => {
    expect(eMedia([])).toBe(0)
  })
})

describe('eMinima', () => {
  it('los 16 valores del Punto 1 → 68', () => {
    expect(eMinima(PUNTO_1)).toBe(68)
  })

  it('lista vacía → 0', () => {
    expect(eMinima([])).toBe(0)
  })
})

describe('cumpleUniformidad', () => {
  it('Punto 1: E mín 68 ≥ E media/2 (60.75) → true', () => {
    expect(cumpleUniformidad(68, 121.5)).toBe(true)
  })

  it('E mín por debajo de la mitad → false', () => {
    expect(cumpleUniformidad(50, 121.5)).toBe(false)
  })

  it('límite exacto: E mín = E media / 2 → true', () => {
    expect(cumpleUniformidad(60, 120)).toBe(true)
  })
})

describe('cumpleNivel', () => {
  it('E media >= requerido → true', () => {
    expect(cumpleNivel(121.5, 100)).toBe(true)
  })

  it('E media < requerido → false', () => {
    expect(cumpleNivel(95, 100)).toBe(false)
  })

  it('límite exacto → true', () => {
    expect(cumpleNivel(100, 100)).toBe(true)
  })
})

describe('generalRequeridaLocalizada', () => {
  // Tabla 4 del Anexo IV (seed de la migración).
  const tabla4 = [
    { localizada_lux: 250, general_min_lux: 125 },
    { localizada_lux: 500, general_min_lux: 250 },
    { localizada_lux: 1000, general_min_lux: 300 },
    { localizada_lux: 2500, general_min_lux: 500 },
    { localizada_lux: 5000, general_min_lux: 600 },
    { localizada_lux: 10000, general_min_lux: 700 },
  ]

  it('localizada 500 → general 250', () => {
    expect(generalRequeridaLocalizada(500, tabla4)).toBe(250)
  })

  it('localizada 10000 → general 700', () => {
    expect(generalRequeridaLocalizada(10000, tabla4)).toBe(700)
  })

  it('sin coincidencia exacta → null', () => {
    expect(generalRequeridaLocalizada(750, tabla4)).toBeNull()
  })

  it('tabla con records sueltos (string-keyed) también funciona', () => {
    const records: Array<Record<string, unknown>> = [{ localizada_lux: 250, general_min_lux: 125 }]
    expect(generalRequeridaLocalizada(250, records)).toBe(125)
  })

  it('tabla no-array → null', () => {
    expect(generalRequeridaLocalizada(500, undefined as unknown as [])).toBeNull()
  })
})
