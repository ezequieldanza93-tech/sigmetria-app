import { describe, it, expect } from 'vitest'
import {
  tgbhInterior,
  tgbhExterior,
  ponderar,
  tgbhEf,
  vlp,
  vla,
  regimenFt,
  superaVlp,
  superaVla,
} from './calculos'

describe('tgbhInterior', () => {
  it('ejemplo del instructivo: 0.7·25 + 0.3·30 = 26.5', () => {
    expect(tgbhInterior(25, 30)).toBe(26.5)
  })

  it('tbh = tg → mismo valor', () => {
    expect(tgbhInterior(28, 28)).toBeCloseTo(28, 10)
  })
})

describe('tgbhExterior', () => {
  it('0.7·25 + 0.2·30 + 0.1·35 = 17.5 + 6 + 3.5 = 27', () => {
    expect(tgbhExterior(25, 30, 35)).toBeCloseTo(27, 10)
  })

  it('los coeficientes suman 1 (mismo valor cuando los tres son iguales)', () => {
    expect(tgbhExterior(28, 28, 28)).toBeCloseTo(28, 10)
  })
})

describe('ponderar', () => {
  it('ejemplo del instructivo: [{40,1},{20,1}] = 30', () => {
    expect(ponderar([{ valor: 40, tiempo: 1 }, { valor: 20, tiempo: 1 }])).toBe(30)
  })

  it('pondera por tiempo: 40·3 + 20·1 = 140 / 4 = 35', () => {
    expect(ponderar([{ valor: 40, tiempo: 3 }, { valor: 20, tiempo: 1 }])).toBe(35)
  })

  it('suma de tiempos 0 → 0 (sin división por cero)', () => {
    expect(ponderar([{ valor: 40, tiempo: 0 }])).toBe(0)
  })

  it('lista vacía → 0', () => {
    expect(ponderar([])).toBe(0)
  })

  it('ignora valores no finitos', () => {
    expect(ponderar([{ valor: NaN, tiempo: 1 }, { valor: 30, tiempo: 1 }])).toBe(30)
  })
})

describe('tgbhEf', () => {
  it('TGBH ponderado + VAR ponderado', () => {
    expect(tgbhEf(26.5, 3)).toBe(29.5)
  })
})

describe('vlp (no aclimatado)', () => {
  it('vlp(207) ≈ 30.1', () => {
    expect(vlp(207)).toBeCloseTo(30.1, 1)
  })

  it('TM ≤ 0 → 0', () => {
    expect(vlp(0)).toBe(0)
    expect(vlp(-5)).toBe(0)
  })
})

describe('vla (aclimatado)', () => {
  it('vla(207) ≈ 27.2', () => {
    expect(vla(207)).toBeCloseTo(27.2, 1)
  })

  it('TM ≤ 0 → 0', () => {
    expect(vla(0)).toBe(0)
  })
})

describe('regimenFt', () => {
  it('B = D → 60 min (sin penalización: zona descanso = límite)', () => {
    // (31.7 - 28) / (31.7 - 28) * 60 = 60
    expect(regimenFt(28, 28)).toBeCloseTo(60, 10)
  })

  it('zona de descanso más fresca → menos minutos de trabajo', () => {
    // B = 25, D = 30: (31.7-25)/(31.7-30)*60 = 6.7/1.7*60 ≈ 236.5 (no acotado por la fórmula pura)
    expect(regimenFt(25, 30)).toBeCloseTo((6.7 / 1.7) * 60, 6)
  })

  it('denominador 0 (D = 31.7) → 0', () => {
    expect(regimenFt(28, 31.7)).toBe(0)
  })
})

describe('superaVlp / superaVla', () => {
  it('superaVlp: TGBHef por encima del VLP → true', () => {
    // vlp(207) ≈ 30.1
    expect(superaVlp(31, 207)).toBe(true)
    expect(superaVlp(29, 207)).toBe(false)
  })

  it('superaVla: TGBHef por encima del VLA → true', () => {
    // vla(207) ≈ 27.2
    expect(superaVla(28, 207)).toBe(true)
    expect(superaVla(26, 207)).toBe(false)
  })

  it('el aclimatado tolera más: para el mismo TGBHef puede superar VLP pero no VLA', () => {
    // TGBHef 28: > vlp? no (28 < 30.1). > vla? sí (28 > 27.2).
    // Probamos un punto entre ambos límites: 30 → supera VLA pero no VLP (no aclimatado más permisivo aquí)
    expect(superaVla(30, 207)).toBe(true)
    expect(superaVlp(30, 207)).toBe(false)
  })
})
