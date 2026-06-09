import { describe, it, expect } from 'vitest'
import { raMaxTT, cumpleToma, RA_MAX_DEFAULT_TT } from './calculos'

describe('raMaxTT', () => {
  it('sin dato de IΔn → 40 Ω (caso por defecto)', () => {
    expect(raMaxTT()).toBe(40)
    expect(raMaxTT(null)).toBe(40)
    expect(raMaxTT(undefined)).toBe(40)
  })

  it('IΔn ≤ 300 mA → 40 Ω', () => {
    expect(raMaxTT(30)).toBe(40)
    expect(raMaxTT(100)).toBe(40)
    expect(raMaxTT(300)).toBe(40)
  })

  it('IΔn = 500 mA → 100 Ω (50 V / 0.5 A)', () => {
    expect(raMaxTT(500)).toBe(100)
  })

  it('valor inválido o ≤ 0 → caso por defecto', () => {
    expect(raMaxTT(0)).toBe(RA_MAX_DEFAULT_TT)
    expect(raMaxTT(-5)).toBe(RA_MAX_DEFAULT_TT)
    expect(raMaxTT(Number.NaN)).toBe(RA_MAX_DEFAULT_TT)
  })
})

describe('cumpleToma', () => {
  it('medido < exigido → cumple', () => {
    expect(cumpleToma(15, 40)).toBe(true)
  })

  it('medido = exigido → cumple (límite inclusivo)', () => {
    expect(cumpleToma(40, 40)).toBe(true)
  })

  it('medido > exigido → no cumple', () => {
    expect(cumpleToma(55, 40)).toBe(false)
  })

  it('falta el medido o el exigido → null', () => {
    expect(cumpleToma(null, 40)).toBeNull()
    expect(cumpleToma(15, null)).toBeNull()
    expect(cumpleToma(undefined, undefined)).toBeNull()
    expect(cumpleToma(Number.NaN, 40)).toBeNull()
  })
})
