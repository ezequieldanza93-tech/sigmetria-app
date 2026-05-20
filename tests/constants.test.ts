import { describe, it, expect } from 'vitest'
import { SECTORES_PREDEFINIDOS } from '@/lib/constants'

describe('SECTORES_PREDEFINIDOS', () => {
  it('contains at least 5 sectors', () => {
    expect(SECTORES_PREDEFINIDOS.length).toBeGreaterThanOrEqual(5)
  })

  it('contains Administración', () => {
    expect(SECTORES_PREDEFINIDOS).toContain('Administración')
  })

  it('contains Higiene y Seguridad', () => {
    expect(SECTORES_PREDEFINIDOS).toContain('Higiene y Seguridad')
  })
})
