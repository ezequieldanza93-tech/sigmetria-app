import { describe, it, expect } from 'vitest'
import {
  TIPO_ESTABLECIMIENTO_OPTIONS,
  SINIESTRO_TIPO_OPTIONS,
  SINIESTRO_ESTADO_OPTIONS,
  INSPECCION_ESTADO_OPTIONS,
  CAPACITACION_ESTADO_OPTIONS,
  RIESGO_NIVEL_OPTIONS,
  DOCUMENTO_TIPO_OPTIONS,
  PROVINCIAS_AR,
  USER_ROLE_OPTIONS,
} from '@/lib/constants'

describe('TIPO_ESTABLECIMIENTO_OPTIONS', () => {
  it('has all required establishment types', () => {
    const values = TIPO_ESTABLECIMIENTO_OPTIONS.map(o => o.value)
    expect(values).toContain('industria')
    expect(values).toContain('agro')
    expect(values).toContain('construccion')
    expect(values).toContain('comercio')
    expect(values).toContain('otro')
  })

  it('every option has a non-empty label', () => {
    for (const opt of TIPO_ESTABLECIMIENTO_OPTIONS) {
      expect(opt.label).toBeTruthy()
    }
  })
})

describe('SINIESTRO_TIPO_OPTIONS', () => {
  it('includes all siniestro types', () => {
    const values = SINIESTRO_TIPO_OPTIONS.map(o => o.value)
    expect(values).toContain('accidente')
    expect(values).toContain('incidente')
    expect(values).toContain('casi_accidente')
    expect(values).toContain('enfermedad_profesional')
  })
})

describe('SINIESTRO_ESTADO_OPTIONS', () => {
  it('includes all siniestro states', () => {
    const values = SINIESTRO_ESTADO_OPTIONS.map(o => o.value)
    expect(values).toEqual(['pendiente', 'en_investigacion', 'cerrado'])
  })
})

describe('INSPECCION_ESTADO_OPTIONS', () => {
  it('includes all inspeccion states', () => {
    const values = INSPECCION_ESTADO_OPTIONS.map(o => o.value)
    expect(values).toEqual(['programada', 'realizada', 'con_observaciones', 'cancelada'])
  })
})

describe('CAPACITACION_ESTADO_OPTIONS', () => {
  it('includes all capacitacion states', () => {
    const values = CAPACITACION_ESTADO_OPTIONS.map(o => o.value)
    expect(values).toEqual(['programada', 'realizada', 'cancelada'])
  })
})

describe('RIESGO_NIVEL_OPTIONS', () => {
  it('includes all riesgo levels in correct order', () => {
    const values = RIESGO_NIVEL_OPTIONS.map(o => o.value)
    expect(values).toEqual(['bajo', 'medio', 'alto', 'critico'])
  })
})

describe('DOCUMENTO_TIPO_OPTIONS', () => {
  it('includes all documento types', () => {
    const values = DOCUMENTO_TIPO_OPTIONS.map(o => o.value)
    expect(values).toContain('habilitacion')
    expect(values).toContain('seguro')
    expect(values).toContain('certificado')
    expect(values).toContain('otro')
  })
})

describe('PROVINCIAS_AR', () => {
  it('has exactly 24 provinces', () => {
    expect(PROVINCIAS_AR.length).toBe(24)
  })

  it('includes Buenos Aires and CABA', () => {
    expect(PROVINCIAS_AR).toContain('Buenos Aires')
    expect(PROVINCIAS_AR).toContain('Ciudad Autónoma de Buenos Aires')
  })
})

describe('USER_ROLE_OPTIONS', () => {
  it('has all user roles', () => {
    const values = USER_ROLE_OPTIONS.map(o => o.value)
    expect(values).toContain('full_access_main')
    expect(values).toContain('full_access_branch')
    expect(values).toContain('colaborador')
    expect(values).toContain('full_viewer')
    expect(values).toContain('colaborador_viewer')
    expect(values).toContain('visualizador_comentarista')
  })
})
