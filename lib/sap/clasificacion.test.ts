import { describe, it, expect } from 'vitest'
import {
  clasificar,
  usoExiste,
  USOS_CODIGOS,
  type ClasificacionInput,
  type ClasificacionResult,
} from './clasificacion'

// ---------------------------------------------------------------------------
// Helpers de test
// ---------------------------------------------------------------------------

/** Input base mínimo. Por defecto: 0 m², solo PB, sin subsuelo, sin hazards. */
function base(overrides: Partial<ClasificacionInput> = {}): ClasificacionInput {
  return {
    usoCodigo: 'ADMINISTRACION_OFICINAS',
    superficieCubiertaM2: 0,
    pisosElevados: 0,
    tieneSubsuelo: false,
    actividadEnSubsuelo: false,
    ...overrides,
  }
}

/** Atajo: clasifica un uso con overrides. */
function clasif(usoCodigo: string, overrides: Partial<ClasificacionInput> = {}): ClasificacionResult {
  return clasificar(base({ usoCodigo, ...overrides }))
}

// ---------------------------------------------------------------------------
// API básica
// ---------------------------------------------------------------------------

describe('API básica', () => {
  it('USOS_CODIGOS tiene exactamente 43 códigos', () => {
    expect(USOS_CODIGOS).toHaveLength(43)
  })

  it('usoExiste true para uno válido, false para inexistente', () => {
    expect(usoExiste('ADMINISTRACION_OFICINAS')).toBe(true)
    expect(usoExiste('NO_EXISTE_XYZ')).toBe(false)
    expect(usoExiste('')).toBe(false)
  })

  it('clasificar lanza Error con uso inexistente', () => {
    expect(() => clasif('NO_EXISTE_XYZ', { superficieCubiertaM2: 100 })).toThrow(
      /Uso no reconocido/
    )
  })

  it('requiereProfesional: false en G1, true en G2 y G3', () => {
    expect(clasif('ADMINISTRACION_OFICINAS', { superficieCubiertaM2: 400 }).requiereProfesional).toBe(false)
    expect(clasif('ADMINISTRACION_OFICINAS', { superficieCubiertaM2: 700 }).requiereProfesional).toBe(true)
    expect(clasif('ADMINISTRACION_OFICINAS', { superficieCubiertaM2: 1500 }).requiereProfesional).toBe(true)
  })

  it('el motivo siempre menciona el grupo', () => {
    for (const codigo of USOS_CODIGOS) {
      const r = clasif(codigo, { superficieCubiertaM2: 100 })
      expect(r.motivo).toMatch(new RegExp(`Grupo ${r.grupo}`))
    }
  })

  it('grupo siempre es 1, 2 o 3 para cualquier uso', () => {
    for (const codigo of USOS_CODIGOS) {
      const r = clasif(codigo, { superficieCubiertaM2: 100 })
      expect([1, 2, 3]).toContain(r.grupo)
    }
  })
})

// ---------------------------------------------------------------------------
// 1. ADMINISTRACION_OFICINAS
// ---------------------------------------------------------------------------

describe('1. ADMINISTRACION_OFICINAS', () => {
  it('G1: ≤500 (límite 500)', () => {
    expect(clasif('ADMINISTRACION_OFICINAS', { superficieCubiertaM2: 500 }).grupo).toBe(1)
  })
  it('G2: 501 y 1000', () => {
    expect(clasif('ADMINISTRACION_OFICINAS', { superficieCubiertaM2: 501 }).grupo).toBe(2)
    expect(clasif('ADMINISTRACION_OFICINAS', { superficieCubiertaM2: 1000 }).grupo).toBe(2)
  })
  it('G3: 1001', () => {
    const r = clasif('ADMINISTRACION_OFICINAS', { superficieCubiertaM2: 1001 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds'])
  })
  it('G3: subsuelo con actividad aunque sea ≤500', () => {
    const r = clasif('ADMINISTRACION_OFICINAS', { superficieCubiertaM2: 200, tieneSubsuelo: true, actividadEnSubsuelo: true })
    expect(r.grupo).toBe(3)
    expect(r.motivo).toMatch(/subsuelo/)
  })
  it('subsuelo SIN actividad no sube de grupo', () => {
    expect(clasif('ADMINISTRACION_OFICINAS', { superficieCubiertaM2: 200, tieneSubsuelo: true, actividadEnSubsuelo: false }).grupo).toBe(1)
  })
  it('admite revalida: si', () => {
    expect(clasif('ADMINISTRACION_OFICINAS', { superficieCubiertaM2: 200 }).admiteRevalida).toBe('si')
  })
})

// ---------------------------------------------------------------------------
// 2-3. ACT_RELIGIOSAS / ACT_CULTURALES (≤500 / >500–1500 / >1500)
// ---------------------------------------------------------------------------

describe('2. ACT_RELIGIOSAS', () => {
  it('G1 500, G2 501 y 1500, G3 1501', () => {
    expect(clasif('ACT_RELIGIOSAS', { superficieCubiertaM2: 500 }).grupo).toBe(1)
    expect(clasif('ACT_RELIGIOSAS', { superficieCubiertaM2: 501 }).grupo).toBe(2)
    expect(clasif('ACT_RELIGIOSAS', { superficieCubiertaM2: 1500 }).grupo).toBe(2)
    expect(clasif('ACT_RELIGIOSAS', { superficieCubiertaM2: 1501 }).grupo).toBe(3)
  })
  it('G3 requiere FDS', () => {
    expect(clasif('ACT_RELIGIOSAS', { superficieCubiertaM2: 1600 }).requisitosTecnicos).toEqual(['fds'])
  })
  it('subsuelo act fuerza G3', () => {
    expect(clasif('ACT_RELIGIOSAS', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(3)
  })
})

describe('3. ACT_CULTURALES', () => {
  it('G1 500, G2 1500, G3 1501', () => {
    expect(clasif('ACT_CULTURALES', { superficieCubiertaM2: 500 }).grupo).toBe(1)
    expect(clasif('ACT_CULTURALES', { superficieCubiertaM2: 1500 }).grupo).toBe(2)
    expect(clasif('ACT_CULTURALES', { superficieCubiertaM2: 1501 }).grupo).toBe(3)
  })
  it('G3 sin requisitos', () => {
    expect(clasif('ACT_CULTURALES', { superficieCubiertaM2: 1600 }).requisitosTecnicos).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 4. ACT_ESPECIALES (sin G1)
// ---------------------------------------------------------------------------

describe('4. ACT_ESPECIALES (sin G1)', () => {
  it('nunca devuelve G1', () => {
    expect(clasif('ACT_ESPECIALES', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: PB ≤600 e inflamables ≤200', () => {
    expect(clasif('ACT_ESPECIALES', { superficieCubiertaM2: 600, pisosElevados: 1, litrosInflamables: 200 }).grupo).toBe(2)
  })
  it('G3: 2+ pisos', () => {
    expect(clasif('ACT_ESPECIALES', { superficieCubiertaM2: 100, pisosElevados: 2 }).grupo).toBe(3)
  })
  it('G3: >600', () => {
    expect(clasif('ACT_ESPECIALES', { superficieCubiertaM2: 601 }).grupo).toBe(3)
  })
  it('G3: subsuelo act', () => {
    expect(clasif('ACT_ESPECIALES', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(3)
  })
  it('G3: >200 L inflamables', () => {
    expect(clasif('ACT_ESPECIALES', { superficieCubiertaM2: 100, litrosInflamables: 201 }).grupo).toBe(3)
  })
  it('G3: sustancia QUIMICO', () => {
    const r = clasif('ACT_ESPECIALES', { superficieCubiertaM2: 100, sustanciasPeligrosas: ['QUIMICO'] })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['brigada_emergencias'])
  })
  it('G3 requiere brigada_emergencias', () => {
    expect(clasif('ACT_ESPECIALES', { superficieCubiertaM2: 700 }).requisitosTecnicos).toEqual(['brigada_emergencias'])
  })
})

// ---------------------------------------------------------------------------
// 5. BANCOS
// ---------------------------------------------------------------------------

describe('5. BANCOS', () => {
  it('G1: PB y ≤300', () => {
    expect(clasif('BANCOS', { superficieCubiertaM2: 300, pisosElevados: 0 }).grupo).toBe(1)
  })
  it('G2: ≤3 pisos y ≤1500', () => {
    expect(clasif('BANCOS', { superficieCubiertaM2: 1500, pisosElevados: 3 }).grupo).toBe(2)
    expect(clasif('BANCOS', { superficieCubiertaM2: 400, pisosElevados: 0 }).grupo).toBe(2) // PB pero >300
  })
  it('G2: subsuelo act con 1 subsuelo', () => {
    expect(clasif('BANCOS', { superficieCubiertaM2: 200, pisosElevados: 0, tieneSubsuelo: true, actividadEnSubsuelo: true, cantidadSubsuelos: 1 }).grupo).toBe(2)
  })
  it('G3: 4+ pisos', () => {
    expect(clasif('BANCOS', { superficieCubiertaM2: 100, pisosElevados: 4 }).grupo).toBe(3)
  })
  it('G3: >1500', () => {
    expect(clasif('BANCOS', { superficieCubiertaM2: 1501, pisosElevados: 1 }).grupo).toBe(3)
  })
  it('G3: 2+ subsuelos', () => {
    const r = clasif('BANCOS', { superficieCubiertaM2: 100, cantidadSubsuelos: 2 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds'])
  })
})

// ---------------------------------------------------------------------------
// 6. BARES_RESTAURANTES / 7. CASAS_FIESTAS / 8. CASAS_FIESTAS_INFANTILES
// ---------------------------------------------------------------------------

describe('6. BARES_RESTAURANTES', () => {
  it('G1 500, G2 1000, G3 1001', () => {
    expect(clasif('BARES_RESTAURANTES', { superficieCubiertaM2: 500 }).grupo).toBe(1)
    expect(clasif('BARES_RESTAURANTES', { superficieCubiertaM2: 1000 }).grupo).toBe(2)
    expect(clasif('BARES_RESTAURANTES', { superficieCubiertaM2: 1001 }).grupo).toBe(3)
  })
  it('subsuelo act → G3, sin requisitos', () => {
    const r = clasif('BARES_RESTAURANTES', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual([])
  })
})

describe('7. CASAS_FIESTAS', () => {
  it('G1: PB y ≤300', () => {
    expect(clasif('CASAS_FIESTAS', { superficieCubiertaM2: 300, pisosElevados: 0 }).grupo).toBe(1)
  })
  it('G2: ≤2 pisos o ≤1000', () => {
    expect(clasif('CASAS_FIESTAS', { superficieCubiertaM2: 1000, pisosElevados: 2 }).grupo).toBe(2)
  })
  it('G3: 4+ pisos', () => {
    expect(clasif('CASAS_FIESTAS', { superficieCubiertaM2: 100, pisosElevados: 4 }).grupo).toBe(3)
  })
  it('G3: >1000', () => {
    expect(clasif('CASAS_FIESTAS', { superficieCubiertaM2: 1001 }).grupo).toBe(3)
  })
  it('G3: subsuelo act', () => {
    expect(clasif('CASAS_FIESTAS', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(3)
  })
  it('HUECO NORMATIVO: 3 pisos → G3 conservador', () => {
    const r = clasif('CASAS_FIESTAS', { superficieCubiertaM2: 100, pisosElevados: 3 })
    expect(r.grupo).toBe(3)
    expect(r.motivo).toMatch(/hueco normativo/i)
  })
})

describe('8. CASAS_FIESTAS_INFANTILES (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('CASAS_FIESTAS_INFANTILES', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: ≤2 pisos o ≤700', () => {
    expect(clasif('CASAS_FIESTAS_INFANTILES', { superficieCubiertaM2: 700, pisosElevados: 2 }).grupo).toBe(2)
  })
  it('G3: 3+ pisos', () => {
    expect(clasif('CASAS_FIESTAS_INFANTILES', { superficieCubiertaM2: 100, pisosElevados: 3 }).grupo).toBe(3)
  })
  it('G3: >700', () => {
    expect(clasif('CASAS_FIESTAS_INFANTILES', { superficieCubiertaM2: 701 }).grupo).toBe(3)
  })
  it('G3: subsuelo act', () => {
    expect(clasif('CASAS_FIESTAS_INFANTILES', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 9. CENTROS_EXPOSICIONES / 10. CIRCO_RODANTE
// ---------------------------------------------------------------------------

describe('9. CENTROS_EXPOSICIONES (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('CENTROS_EXPOSICIONES', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: ≤1 piso y ≤1000', () => {
    expect(clasif('CENTROS_EXPOSICIONES', { superficieCubiertaM2: 1000, pisosElevados: 1 }).grupo).toBe(2)
  })
  it('G3: >1000', () => {
    const r = clasif('CENTROS_EXPOSICIONES', { superficieCubiertaM2: 1001, pisosElevados: 1 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds', 'simulacion_evacuacion'])
  })
  it('G3: 2+ pisos', () => {
    expect(clasif('CENTROS_EXPOSICIONES', { superficieCubiertaM2: 100, pisosElevados: 2 }).grupo).toBe(3)
  })
  it('G3: subsuelo act', () => {
    expect(clasif('CENTROS_EXPOSICIONES', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(3)
  })
})

describe('10. CIRCO_RODANTE (solo G3)', () => {
  it('siempre G3 con simulacion_evacuacion', () => {
    const r = clasif('CIRCO_RODANTE', { superficieCubiertaM2: 10 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['simulacion_evacuacion'])
    expect(r.admiteRevalida).toBe('si')
  })
})

// ---------------------------------------------------------------------------
// 11-13. Deportivos / sociales (puro m², sin subsuelo)
// ---------------------------------------------------------------------------

describe('11. CLUB_DEPORTIVO_AIRE_LIBRE', () => {
  it('G1 500, G2 1000, G3 1001', () => {
    expect(clasif('CLUB_DEPORTIVO_AIRE_LIBRE', { superficieCubiertaM2: 500 }).grupo).toBe(1)
    expect(clasif('CLUB_DEPORTIVO_AIRE_LIBRE', { superficieCubiertaM2: 1000 }).grupo).toBe(2)
    expect(clasif('CLUB_DEPORTIVO_AIRE_LIBRE', { superficieCubiertaM2: 1001 }).grupo).toBe(3)
  })
  it('subsuelo act NO sube (no aplica trigger)', () => {
    expect(clasif('CLUB_DEPORTIVO_AIRE_LIBRE', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(1)
  })
})

describe('12. CLUBES_DEPORTES', () => {
  it('G1 500, G2 1500, G3 1501', () => {
    expect(clasif('CLUBES_DEPORTES', { superficieCubiertaM2: 500 }).grupo).toBe(1)
    expect(clasif('CLUBES_DEPORTES', { superficieCubiertaM2: 1500 }).grupo).toBe(2)
    expect(clasif('CLUBES_DEPORTES', { superficieCubiertaM2: 1501 }).grupo).toBe(3)
  })
  it('subsuelo act NO sube', () => {
    expect(clasif('CLUBES_DEPORTES', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(1)
  })
})

describe('13. CLUB_SOCIAL_CUBIERTO', () => {
  it('G1 500, G2 1000, G3 1001', () => {
    expect(clasif('CLUB_SOCIAL_CUBIERTO', { superficieCubiertaM2: 500 }).grupo).toBe(1)
    expect(clasif('CLUB_SOCIAL_CUBIERTO', { superficieCubiertaM2: 1000 }).grupo).toBe(2)
    expect(clasif('CLUB_SOCIAL_CUBIERTO', { superficieCubiertaM2: 1001 }).grupo).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 14. COMERCIO
// ---------------------------------------------------------------------------

describe('14. COMERCIO', () => {
  it('G1: ≤500 sin hazards', () => {
    const r = clasif('COMERCIO', { superficieCubiertaM2: 500 })
    expect(r.grupo).toBe(1)
    expect(r.admiteRevalida).toBe('condicional')
  })
  it('G2: >500–1000', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 501 }).grupo).toBe(2)
    expect(clasif('COMERCIO', { superficieCubiertaM2: 1000 }).grupo).toBe(2)
  })
  it('G2: inflamables ≤200', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 100, litrosInflamables: 200 }).grupo).toBe(2)
  })
  it('G2: litio 20–50', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 100, kgBateriasLitio: 20 }).grupo).toBe(2)
    expect(clasif('COMERCIO', { superficieCubiertaM2: 100, kgBateriasLitio: 50 }).grupo).toBe(2)
  })
  it('litio <20 no fuerza G2 (sigue G1)', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 100, kgBateriasLitio: 10 }).grupo).toBe(1)
  })
  it('G3: >1000', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 1001 }).grupo).toBe(3)
  })
  it('G3: subsuelo act', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(3)
  })
  it('G3: >200 L', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 100, litrosInflamables: 201 }).grupo).toBe(3)
  })
  it('G3: sustancias peligrosas', () => {
    const r = clasif('COMERCIO', { superficieCubiertaM2: 100, sustanciasPeligrosas: ['TOXICO'] })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds'])
  })
  it('G3: litio >50', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 100, kgBateriasLitio: 51 }).grupo).toBe(3)
  })
  it('G3: estaciones EV', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 100, estacionesCargaEv: true }).grupo).toBe(3)
  })
  it('TRAMPA: ≤500 con sustancias → NO G1, sube a G3', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 300, sustanciasPeligrosas: ['QUIMICO'] }).grupo).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 15. DEPOSITO (sin G1)
// ---------------------------------------------------------------------------

describe('15. DEPOSITO (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('DEPOSITO', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: ≤1 piso o ≤1000', () => {
    expect(clasif('DEPOSITO', { superficieCubiertaM2: 1000, pisosElevados: 1 }).grupo).toBe(2)
  })
  it('G3: 2+ pisos', () => {
    expect(clasif('DEPOSITO', { superficieCubiertaM2: 100, pisosElevados: 2 }).grupo).toBe(3)
  })
  it('G3: >1000', () => {
    expect(clasif('DEPOSITO', { superficieCubiertaM2: 1001, pisosElevados: 1 }).grupo).toBe(3)
  })
  it('G3: >200 L', () => {
    expect(clasif('DEPOSITO', { superficieCubiertaM2: 100, litrosInflamables: 201 }).grupo).toBe(3)
  })
  it('G3: sustancias', () => {
    expect(clasif('DEPOSITO', { superficieCubiertaM2: 100, sustanciasPeligrosas: ['CORROSIVO'] }).grupo).toBe(3)
  })
  it('revalida condicional', () => {
    expect(clasif('DEPOSITO', { superficieCubiertaM2: 100 }).admiteRevalida).toBe('condicional')
  })
})

// ---------------------------------------------------------------------------
// 16-17. ESCUELAS / ESPECTACULOS (sin G1, revalida no)
// ---------------------------------------------------------------------------

describe('16. ESCUELAS (sin G1, revalida no)', () => {
  it('nunca G1', () => {
    expect(clasif('ESCUELAS', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: ≤3 pisos y ≤1500', () => {
    expect(clasif('ESCUELAS', { superficieCubiertaM2: 1500, pisosElevados: 3 }).grupo).toBe(2)
  })
  it('G3: 4+ pisos', () => {
    const r = clasif('ESCUELAS', { superficieCubiertaM2: 100, pisosElevados: 4 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds', 'simulacion_evacuacion'])
  })
  it('G3: >1500', () => {
    expect(clasif('ESCUELAS', { superficieCubiertaM2: 1501, pisosElevados: 1 }).grupo).toBe(3)
  })
  it('G3: 2+ subsuelos', () => {
    expect(clasif('ESCUELAS', { superficieCubiertaM2: 100, cantidadSubsuelos: 2 }).grupo).toBe(3)
  })
  it('revalida no', () => {
    expect(clasif('ESCUELAS', { superficieCubiertaM2: 100 }).admiteRevalida).toBe('no')
  })
})

describe('17. ESPECTACULOS_CINE_TEATRO (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('ESPECTACULOS_CINE_TEATRO', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: ≤1 piso, ≤600, sin subsuelo act', () => {
    expect(clasif('ESPECTACULOS_CINE_TEATRO', { superficieCubiertaM2: 600, pisosElevados: 1 }).grupo).toBe(2)
  })
  it('G3: 2+ pisos', () => {
    expect(clasif('ESPECTACULOS_CINE_TEATRO', { superficieCubiertaM2: 100, pisosElevados: 2 }).grupo).toBe(3)
  })
  it('G3: >600', () => {
    expect(clasif('ESPECTACULOS_CINE_TEATRO', { superficieCubiertaM2: 601, pisosElevados: 1 }).grupo).toBe(3)
  })
  it('G3: subsuelo act', () => {
    const r = clasif('ESPECTACULOS_CINE_TEATRO', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds', 'simulacion_evacuacion'])
  })
})

// ---------------------------------------------------------------------------
// 18. ESTACION_SERVICIO / 19. ESTADIOS / 20. EVENTOS_NO_MASIVOS
// ---------------------------------------------------------------------------

describe('18. ESTACION_SERVICIO (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('ESTACION_SERVICIO', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: PB y ≤500', () => {
    expect(clasif('ESTACION_SERVICIO', { superficieCubiertaM2: 500, pisosElevados: 0 }).grupo).toBe(2)
  })
  it('G3: pisos elevados ≥1', () => {
    expect(clasif('ESTACION_SERVICIO', { superficieCubiertaM2: 100, pisosElevados: 1 }).grupo).toBe(3)
  })
  it('G3: >500', () => {
    expect(clasif('ESTACION_SERVICIO', { superficieCubiertaM2: 501, pisosElevados: 0 }).grupo).toBe(3)
  })
  it('G3: estaciones EV', () => {
    expect(clasif('ESTACION_SERVICIO', { superficieCubiertaM2: 100, pisosElevados: 0, estacionesCargaEv: true }).grupo).toBe(3)
  })
})

describe('19. ESTADIOS (solo G3)', () => {
  it('siempre G3 con simulacion_evacuacion, revalida no', () => {
    const r = clasif('ESTADIOS', { superficieCubiertaM2: 10 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['simulacion_evacuacion'])
    expect(r.admiteRevalida).toBe('no')
  })
})

describe('20. EVENTOS_NO_MASIVOS (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('EVENTOS_NO_MASIVOS', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: ≤1 piso y ≤500 cubierto', () => {
    expect(clasif('EVENTOS_NO_MASIVOS', { superficieCubiertaM2: 500, pisosElevados: 1 }).grupo).toBe(2)
  })
  it('G2: aire libre ≤1000', () => {
    expect(clasif('EVENTOS_NO_MASIVOS', { superficieCubiertaM2: 100, superficieAireLibreM2: 1000 }).grupo).toBe(2)
  })
  it('G3: 2+ pisos', () => {
    expect(clasif('EVENTOS_NO_MASIVOS', { superficieCubiertaM2: 100, pisosElevados: 2 }).grupo).toBe(3)
  })
  it('G3: >500 cubierto', () => {
    expect(clasif('EVENTOS_NO_MASIVOS', { superficieCubiertaM2: 501, pisosElevados: 1 }).grupo).toBe(3)
  })
  it('G3: subsuelo act', () => {
    expect(clasif('EVENTOS_NO_MASIVOS', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(3)
  })
  it('G3: aire libre >1000', () => {
    const r = clasif('EVENTOS_NO_MASIVOS', { superficieCubiertaM2: 100, superficieAireLibreM2: 1001 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['simulacion_evacuacion'])
  })
})

// ---------------------------------------------------------------------------
// 21. GALERIA_SHOPPING / 22. GARAGES
// ---------------------------------------------------------------------------

describe('21. GALERIA_SHOPPING (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('GALERIA_SHOPPING', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: ≤1 piso y ≤1000, litio ≤50, sin EV', () => {
    expect(clasif('GALERIA_SHOPPING', { superficieCubiertaM2: 1000, pisosElevados: 1, kgBateriasLitio: 50 }).grupo).toBe(2)
  })
  it('G3: 2+ pisos', () => {
    expect(clasif('GALERIA_SHOPPING', { superficieCubiertaM2: 100, pisosElevados: 2 }).grupo).toBe(3)
  })
  it('G3: >1000', () => {
    expect(clasif('GALERIA_SHOPPING', { superficieCubiertaM2: 1001, pisosElevados: 1 }).grupo).toBe(3)
  })
  it('G3: litio >50', () => {
    expect(clasif('GALERIA_SHOPPING', { superficieCubiertaM2: 100, kgBateriasLitio: 51 }).grupo).toBe(3)
  })
  it('G3: estaciones EV', () => {
    const r = clasif('GALERIA_SHOPPING', { superficieCubiertaM2: 100, estacionesCargaEv: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds', 'simulacion_evacuacion'])
  })
})

describe('22. GARAGES', () => {
  it('G1: cubierto ≤500 sin EV', () => {
    expect(clasif('GARAGES', { superficieCubiertaM2: 500 }).grupo).toBe(1)
  })
  it('G1: aire libre ≤1500', () => {
    expect(clasif('GARAGES', { superficieCubiertaM2: 0, superficieAireLibreM2: 1500 }).grupo).toBe(1)
  })
  it('G2: cubierto >500–1000', () => {
    expect(clasif('GARAGES', { superficieCubiertaM2: 501 }).grupo).toBe(2)
    expect(clasif('GARAGES', { superficieCubiertaM2: 1000 }).grupo).toBe(2)
  })
  it('G2: aire libre 1500–5000', () => {
    expect(clasif('GARAGES', { superficieCubiertaM2: 0, superficieAireLibreM2: 5000 }).grupo).toBe(2)
  })
  it('G2: 1 subsuelo', () => {
    expect(clasif('GARAGES', { superficieCubiertaM2: 100, cantidadSubsuelos: 1 }).grupo).toBe(2)
  })
  it('G3: cubierto >1000', () => {
    const r = clasif('GARAGES', { superficieCubiertaM2: 1001 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual([]) // FDS solo si 2+ subsuelos
  })
  it('G3: 2+ subsuelos → FDS', () => {
    const r = clasif('GARAGES', { superficieCubiertaM2: 100, cantidadSubsuelos: 2 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds'])
  })
  it('G3: estaciones EV', () => {
    expect(clasif('GARAGES', { superficieCubiertaM2: 100, estacionesCargaEv: true }).grupo).toBe(3)
  })
  it('G3: aire libre >5000', () => {
    expect(clasif('GARAGES', { superficieCubiertaM2: 0, superficieAireLibreM2: 5001 }).grupo).toBe(3)
  })
  it('revalida condicional', () => {
    expect(clasif('GARAGES', { superficieCubiertaM2: 100 }).admiteRevalida).toBe('condicional')
  })
})

// ---------------------------------------------------------------------------
// 23-25. GERIATRICOS / HOGARES_RESIDENCIAS / HOGAR_NINOS
// ---------------------------------------------------------------------------

describe('23. GERIATRICOS (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('GERIATRICOS', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: ≤1 piso o ≤600', () => {
    expect(clasif('GERIATRICOS', { superficieCubiertaM2: 600, pisosElevados: 1 }).grupo).toBe(2)
  })
  it('G3: 2+ pisos / >600 / subsuelo act', () => {
    expect(clasif('GERIATRICOS', { superficieCubiertaM2: 100, pisosElevados: 2 }).grupo).toBe(3)
    expect(clasif('GERIATRICOS', { superficieCubiertaM2: 601 }).grupo).toBe(3)
    const r = clasif('GERIATRICOS', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds'])
  })
})

describe('24. HOGARES_RESIDENCIAS', () => {
  it('G1: PB y ≤300', () => {
    expect(clasif('HOGARES_RESIDENCIAS', { superficieCubiertaM2: 300, pisosElevados: 0 }).grupo).toBe(1)
  })
  it('G2: ≤1 piso o ≤600', () => {
    expect(clasif('HOGARES_RESIDENCIAS', { superficieCubiertaM2: 600, pisosElevados: 1 }).grupo).toBe(2)
    expect(clasif('HOGARES_RESIDENCIAS', { superficieCubiertaM2: 400, pisosElevados: 0 }).grupo).toBe(2)
  })
  it('G3: 2+ pisos o >600', () => {
    expect(clasif('HOGARES_RESIDENCIAS', { superficieCubiertaM2: 100, pisosElevados: 2 }).grupo).toBe(3)
    expect(clasif('HOGARES_RESIDENCIAS', { superficieCubiertaM2: 601 }).grupo).toBe(3)
  })
})

describe('25. HOGAR_NINOS (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('HOGAR_NINOS', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G3: subsuelo act → FDS', () => {
    const r = clasif('HOGAR_NINOS', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds'])
  })
  it('G3: 2+ pisos sin subsuelo → sin FDS', () => {
    const r = clasif('HOGAR_NINOS', { superficieCubiertaM2: 100, pisosElevados: 2 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual([])
  })
  it('G3: >600', () => {
    expect(clasif('HOGAR_NINOS', { superficieCubiertaM2: 601 }).grupo).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 26. HOTEL / 27. INDUSTRIA
// ---------------------------------------------------------------------------

describe('26. HOTEL (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('HOTEL', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: ≤3 pisos y ≤1500', () => {
    expect(clasif('HOTEL', { superficieCubiertaM2: 1500, pisosElevados: 3 }).grupo).toBe(2)
  })
  it('G3: 4+ pisos → FDS + simulacion', () => {
    const r = clasif('HOTEL', { superficieCubiertaM2: 100, pisosElevados: 4 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds', 'simulacion_evacuacion'])
  })
  it('G3: >1500 / 2+ subsuelos', () => {
    expect(clasif('HOTEL', { superficieCubiertaM2: 1501, pisosElevados: 1 }).grupo).toBe(3)
    expect(clasif('HOTEL', { superficieCubiertaM2: 100, cantidadSubsuelos: 2 }).grupo).toBe(3)
  })
})

describe('27. INDUSTRIA (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('INDUSTRIA', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: ≤1 piso o ≤1000, inflamables ≤200, litio 20–50', () => {
    expect(clasif('INDUSTRIA', { superficieCubiertaM2: 1000, pisosElevados: 1, litrosInflamables: 200, kgBateriasLitio: 50 }).grupo).toBe(2)
  })
  it('G3: 2+ pisos', () => {
    expect(clasif('INDUSTRIA', { superficieCubiertaM2: 100, pisosElevados: 2 }).grupo).toBe(3)
  })
  it('G3: >1000', () => {
    expect(clasif('INDUSTRIA', { superficieCubiertaM2: 1001, pisosElevados: 1 }).grupo).toBe(3)
  })
  it('G3: >200 L', () => {
    expect(clasif('INDUSTRIA', { superficieCubiertaM2: 100, litrosInflamables: 201 }).grupo).toBe(3)
  })
  it('G3: sustancias', () => {
    expect(clasif('INDUSTRIA', { superficieCubiertaM2: 100, sustanciasPeligrosas: ['EXPLOSIVO'] }).grupo).toBe(3)
  })
  it('G3: procesos de soldadura', () => {
    const r = clasif('INDUSTRIA', { superficieCubiertaM2: 100, procesosSoldadura: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['brigada_emergencias'])
  })
  it('G3: litio >50', () => {
    expect(clasif('INDUSTRIA', { superficieCubiertaM2: 100, kgBateriasLitio: 51 }).grupo).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 28. JARDIN_INFANTES / 29. LOCALES_BAILABLES / 30. PENITENCIARIA / 31. POLIGONOS_TIRO
// ---------------------------------------------------------------------------

describe('28. JARDIN_INFANTES (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('JARDIN_INFANTES', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: ≤1 piso y ≤1000', () => {
    expect(clasif('JARDIN_INFANTES', { superficieCubiertaM2: 1000, pisosElevados: 1 }).grupo).toBe(2)
  })
  it('G3: 2+ pisos / >1000 / subsuelo act', () => {
    expect(clasif('JARDIN_INFANTES', { superficieCubiertaM2: 100, pisosElevados: 2 }).grupo).toBe(3)
    expect(clasif('JARDIN_INFANTES', { superficieCubiertaM2: 1001, pisosElevados: 1 }).grupo).toBe(3)
    const r = clasif('JARDIN_INFANTES', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds', 'simulacion_evacuacion'])
  })
})

describe('29. LOCALES_BAILABLES (solo G3)', () => {
  it('siempre G3 con simulacion + FDS', () => {
    const r = clasif('LOCALES_BAILABLES', { superficieCubiertaM2: 10 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds', 'simulacion_evacuacion'])
  })
})

describe('30. PENITENCIARIA (solo G3)', () => {
  it('siempre G3 con simulacion + FDS', () => {
    const r = clasif('PENITENCIARIA', { superficieCubiertaM2: 10 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds', 'simulacion_evacuacion'])
  })
})

describe('31. POLIGONOS_TIRO (solo G3)', () => {
  it('G3 sin subsuelo: simulacion + codigo_edificacion (sin FDS)', () => {
    const r = clasif('POLIGONOS_TIRO', { superficieCubiertaM2: 100, tieneSubsuelo: false })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['simulacion_evacuacion', 'codigo_edificacion'])
  })
  it('G3 con subsuelo: agrega FDS', () => {
    const r = clasif('POLIGONOS_TIRO', { superficieCubiertaM2: 100, tieneSubsuelo: true })
    expect(r.requisitosTecnicos).toEqual(['fds', 'simulacion_evacuacion', 'codigo_edificacion'])
  })
})

// ---------------------------------------------------------------------------
// 32. PREDIOS_DEPORTIVOS / 33. RESIDENCIA_ASISTENCIA / 34. REFUGIOS_NOCTURNOS
// ---------------------------------------------------------------------------

describe('32. PREDIOS_DEPORTIVOS', () => {
  it('G1 500, G2 1000, G3 1001 (sin subsuelo)', () => {
    expect(clasif('PREDIOS_DEPORTIVOS', { superficieCubiertaM2: 500 }).grupo).toBe(1)
    expect(clasif('PREDIOS_DEPORTIVOS', { superficieCubiertaM2: 1000 }).grupo).toBe(2)
    expect(clasif('PREDIOS_DEPORTIVOS', { superficieCubiertaM2: 1001 }).grupo).toBe(3)
  })
  it('subsuelo act NO sube', () => {
    expect(clasif('PREDIOS_DEPORTIVOS', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(1)
  })
})

describe('33. RESIDENCIA_ASISTENCIA (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('RESIDENCIA_ASISTENCIA', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: PB y ≤600', () => {
    expect(clasif('RESIDENCIA_ASISTENCIA', { superficieCubiertaM2: 600, pisosElevados: 0 }).grupo).toBe(2)
  })
  it('G3: 1+ piso', () => {
    const r = clasif('RESIDENCIA_ASISTENCIA', { superficieCubiertaM2: 100, pisosElevados: 1 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds'])
  })
  it('G3: >600 / subsuelo act', () => {
    expect(clasif('RESIDENCIA_ASISTENCIA', { superficieCubiertaM2: 601, pisosElevados: 0 }).grupo).toBe(3)
    expect(clasif('RESIDENCIA_ASISTENCIA', { superficieCubiertaM2: 100, pisosElevados: 0, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(3)
  })
})

describe('34. REFUGIOS_NOCTURNOS (solo G3)', () => {
  it('siempre G3 sin requisitos, revalida no', () => {
    const r = clasif('REFUGIOS_NOCTURNOS', { superficieCubiertaM2: 10 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual([])
    expect(r.admiteRevalida).toBe('no')
  })
})

// ---------------------------------------------------------------------------
// 35. REPRESENTACIONES_EXTRANJERAS / 36. SALAS_JUEGO
// ---------------------------------------------------------------------------

describe('35. REPRESENTACIONES_EXTRANJERAS', () => {
  it('G1 500, G2 501–800', () => {
    expect(clasif('REPRESENTACIONES_EXTRANJERAS', { superficieCubiertaM2: 500 }).grupo).toBe(1)
    expect(clasif('REPRESENTACIONES_EXTRANJERAS', { superficieCubiertaM2: 501 }).grupo).toBe(2)
    expect(clasif('REPRESENTACIONES_EXTRANJERAS', { superficieCubiertaM2: 800 }).grupo).toBe(2)
  })
  it('HUECO NORMATIVO: >800 → G3 conservador', () => {
    const r = clasif('REPRESENTACIONES_EXTRANJERAS', { superficieCubiertaM2: 801 })
    expect(r.grupo).toBe(3)
    expect(r.motivo).toMatch(/hueco normativo/i)
  })
  it('subsuelo act → G3', () => {
    expect(clasif('REPRESENTACIONES_EXTRANJERAS', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(3)
  })
})

describe('36. SALAS_JUEGO', () => {
  it('G1 500, G2 1000, G3 1001', () => {
    expect(clasif('SALAS_JUEGO', { superficieCubiertaM2: 500 }).grupo).toBe(1)
    expect(clasif('SALAS_JUEGO', { superficieCubiertaM2: 1000 }).grupo).toBe(2)
    expect(clasif('SALAS_JUEGO', { superficieCubiertaM2: 1001 }).grupo).toBe(3)
  })
  it('G3: subsuelo act → simulacion + FDS', () => {
    const r = clasif('SALAS_JUEGO', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds', 'simulacion_evacuacion'])
  })
})

// ---------------------------------------------------------------------------
// 37. SANITARIO
// ---------------------------------------------------------------------------

describe('37. SANITARIO', () => {
  it('G1: PB y ≤300, sin internación ni gases', () => {
    expect(clasif('SANITARIO', { superficieCubiertaM2: 300, pisosElevados: 0 }).grupo).toBe(1)
  })
  it('G2: ≤3 pisos o 300–1500', () => {
    expect(clasif('SANITARIO', { superficieCubiertaM2: 1500, pisosElevados: 3 }).grupo).toBe(2)
    expect(clasif('SANITARIO', { superficieCubiertaM2: 400, pisosElevados: 0 }).grupo).toBe(2)
  })
  it('G3: 4+ pisos', () => {
    expect(clasif('SANITARIO', { superficieCubiertaM2: 100, pisosElevados: 4 }).grupo).toBe(3)
  })
  it('G3: >1500', () => {
    expect(clasif('SANITARIO', { superficieCubiertaM2: 1501, pisosElevados: 1 }).grupo).toBe(3)
  })
  it('G3: internación → FDS + brigada', () => {
    const r = clasif('SANITARIO', { superficieCubiertaM2: 100, pisosElevados: 0, tieneInternacion: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds', 'brigada_emergencias'])
  })
  it('G3: gases medicinales → FDS sin brigada', () => {
    const r = clasif('SANITARIO', { superficieCubiertaM2: 100, pisosElevados: 0, gasesMedicinales: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds'])
  })
  it('G3 por m² sin internación → FDS sin brigada', () => {
    const r = clasif('SANITARIO', { superficieCubiertaM2: 1600, pisosElevados: 0 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds'])
  })
  it('TRAMPA: PB ≤300 pero con internación → G3', () => {
    expect(clasif('SANITARIO', { superficieCubiertaM2: 200, pisosElevados: 0, tieneInternacion: true }).grupo).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 38. TALLER_MECANICO / 39. TELEVISION / 40. TRANSPORTE_PUBLICO
// ---------------------------------------------------------------------------

describe('38. TALLER_MECANICO', () => {
  it('G1: ≤500 y no VE', () => {
    expect(clasif('TALLER_MECANICO', { superficieCubiertaM2: 500 }).grupo).toBe(1)
  })
  it('G2: >500–1000, inflamables ≤200, no VE', () => {
    expect(clasif('TALLER_MECANICO', { superficieCubiertaM2: 1000, litrosInflamables: 200 }).grupo).toBe(2)
  })
  it('G3: >1000', () => {
    expect(clasif('TALLER_MECANICO', { superficieCubiertaM2: 1001 }).grupo).toBe(3)
  })
  it('G3: subsuelo act', () => {
    expect(clasif('TALLER_MECANICO', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true }).grupo).toBe(3)
  })
  it('G3: >200 L', () => {
    expect(clasif('TALLER_MECANICO', { superficieCubiertaM2: 100, litrosInflamables: 201 }).grupo).toBe(3)
  })
  it('G3: presta servicio a VE', () => {
    const r = clasif('TALLER_MECANICO', { superficieCubiertaM2: 100, prestaServicioVehiculosElectricos: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds'])
  })
  it('TRAMPA: ≤500 pero presta servicio a VE → no G1', () => {
    expect(clasif('TALLER_MECANICO', { superficieCubiertaM2: 300, prestaServicioVehiculosElectricos: true }).grupo).toBe(3)
  })
})

describe('39. TELEVISION', () => {
  it('G1 500, G2 1000, G3 1001', () => {
    expect(clasif('TELEVISION', { superficieCubiertaM2: 500 }).grupo).toBe(1)
    expect(clasif('TELEVISION', { superficieCubiertaM2: 1000 }).grupo).toBe(2)
    expect(clasif('TELEVISION', { superficieCubiertaM2: 1001 }).grupo).toBe(3)
  })
  it('G3 por m² sin subsuelo → sin FDS', () => {
    expect(clasif('TELEVISION', { superficieCubiertaM2: 1001 }).requisitosTecnicos).toEqual([])
  })
  it('G3 por subsuelo act → FDS', () => {
    const r = clasif('TELEVISION', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds'])
  })
})

describe('40. TRANSPORTE_PUBLICO (solo G3)', () => {
  it('G3 sin subsuelo: simulacion (sin FDS)', () => {
    const r = clasif('TRANSPORTE_PUBLICO', { superficieCubiertaM2: 100, tieneSubsuelo: false })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['simulacion_evacuacion'])
  })
  it('G3 con subsuelo: agrega FDS', () => {
    const r = clasif('TRANSPORTE_PUBLICO', { superficieCubiertaM2: 100, tieneSubsuelo: true })
    expect(r.requisitosTecnicos).toEqual(['fds', 'simulacion_evacuacion'])
  })
})

// ---------------------------------------------------------------------------
// 41-43. USOS_CULT_*
// ---------------------------------------------------------------------------

describe('41. USOS_CULT_MUSICA_VIVO (sin G1)', () => {
  it('nunca G1', () => {
    expect(clasif('USOS_CULT_MUSICA_VIVO', { superficieCubiertaM2: 10 }).grupo).toBe(2)
  })
  it('G2: PB y ≤500', () => {
    expect(clasif('USOS_CULT_MUSICA_VIVO', { superficieCubiertaM2: 500, pisosElevados: 0 }).grupo).toBe(2)
  })
  it('G3: 1+ piso / >500 / subsuelo act', () => {
    expect(clasif('USOS_CULT_MUSICA_VIVO', { superficieCubiertaM2: 100, pisosElevados: 1 }).grupo).toBe(3)
    const r = clasif('USOS_CULT_MUSICA_VIVO', { superficieCubiertaM2: 501, pisosElevados: 0 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['fds'])
  })
})

describe('42. USOS_CULT_ESPACIO_INDEP', () => {
  it('G1: PB y ≤300 → requiereExcepcionTad true', () => {
    const r = clasif('USOS_CULT_ESPACIO_INDEP', { superficieCubiertaM2: 300, pisosElevados: 0 })
    expect(r.grupo).toBe(1)
    expect(r.requiereExcepcionTad).toBe(true)
    expect(r.requiereProfesional).toBe(false)
  })
  it('G2: PB y 301–500 → excepcionTad false', () => {
    const r = clasif('USOS_CULT_ESPACIO_INDEP', { superficieCubiertaM2: 500, pisosElevados: 0 })
    expect(r.grupo).toBe(2)
    expect(r.requiereExcepcionTad).toBe(false)
  })
  it('G3: 1+ piso / >500 / subsuelo act', () => {
    expect(clasif('USOS_CULT_ESPACIO_INDEP', { superficieCubiertaM2: 100, pisosElevados: 1 }).grupo).toBe(3)
    const r = clasif('USOS_CULT_ESPACIO_INDEP', { superficieCubiertaM2: 501, pisosElevados: 0 })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['simulacion_evacuacion'])
    expect(r.requiereExcepcionTad).toBe(false)
  })
})

describe('43. USOS_CULT_OTROS', () => {
  it('G1 500, G2 700, G3 701', () => {
    expect(clasif('USOS_CULT_OTROS', { superficieCubiertaM2: 500 }).grupo).toBe(1)
    expect(clasif('USOS_CULT_OTROS', { superficieCubiertaM2: 700 }).grupo).toBe(2)
    expect(clasif('USOS_CULT_OTROS', { superficieCubiertaM2: 701 }).grupo).toBe(3)
  })
  it('G3: subsuelo act → simulacion', () => {
    const r = clasif('USOS_CULT_OTROS', { superficieCubiertaM2: 100, tieneSubsuelo: true, actividadEnSubsuelo: true })
    expect(r.grupo).toBe(3)
    expect(r.requisitosTecnicos).toEqual(['simulacion_evacuacion'])
  })
})

// ---------------------------------------------------------------------------
// requiereExcepcionTad: solo para USOS_CULT_ESPACIO_INDEP en G1
// ---------------------------------------------------------------------------

describe('requiereExcepcionTad', () => {
  it('es false para todos los usos en G1 excepto USOS_CULT_ESPACIO_INDEP', () => {
    expect(clasif('ADMINISTRACION_OFICINAS', { superficieCubiertaM2: 100 }).requiereExcepcionTad).toBe(false)
    expect(clasif('HOGARES_RESIDENCIAS', { superficieCubiertaM2: 100, pisosElevados: 0 }).requiereExcepcionTad).toBe(false)
    expect(clasif('SANITARIO', { superficieCubiertaM2: 100, pisosElevados: 0 }).requiereExcepcionTad).toBe(false)
  })
  it('es false para USOS_CULT_ESPACIO_INDEP en G2/G3', () => {
    expect(clasif('USOS_CULT_ESPACIO_INDEP', { superficieCubiertaM2: 400, pisosElevados: 0 }).requiereExcepcionTad).toBe(false)
    expect(clasif('USOS_CULT_ESPACIO_INDEP', { superficieCubiertaM2: 600, pisosElevados: 0 }).requiereExcepcionTad).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Robustez defensiva: datos faltantes = condición no cumplida
// ---------------------------------------------------------------------------

describe('robustez defensiva', () => {
  it('litrosInflamables undefined = 0 (no fuerza grupo)', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 100 }).grupo).toBe(1)
  })
  it('sustanciasPeligrosas undefined no fuerza G3', () => {
    expect(clasif('INDUSTRIA', { superficieCubiertaM2: 100, pisosElevados: 0 }).grupo).toBe(2)
  })
  it('sustanciasPeligrosas array vacío no fuerza G3', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 100, sustanciasPeligrosas: [] }).grupo).toBe(1)
  })
  it('sustancias case-insensitive (minúsculas también disparan)', () => {
    expect(clasif('COMERCIO', { superficieCubiertaM2: 100, sustanciasPeligrosas: ['quimico'] }).grupo).toBe(3)
  })
  it('cantidadSubsuelos undefined no rompe BANCOS', () => {
    expect(clasif('BANCOS', { superficieCubiertaM2: 200, pisosElevados: 0 }).grupo).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Usos "solo G3" siempre devuelven 3; usos sin G1 nunca devuelven 1
// ---------------------------------------------------------------------------

describe('invariantes de grupo', () => {
  const SOLO_G3 = [
    'CIRCO_RODANTE',
    'ESTADIOS',
    'LOCALES_BAILABLES',
    'PENITENCIARIA',
    'POLIGONOS_TIRO',
    'REFUGIOS_NOCTURNOS',
    'TRANSPORTE_PUBLICO',
  ]
  const SIN_G1 = [
    'ACT_ESPECIALES',
    'CASAS_FIESTAS_INFANTILES',
    'CENTROS_EXPOSICIONES',
    'DEPOSITO',
    'ESCUELAS',
    'ESPECTACULOS_CINE_TEATRO',
    'ESTACION_SERVICIO',
    'EVENTOS_NO_MASIVOS',
    'GALERIA_SHOPPING',
    'GERIATRICOS',
    'HOGAR_NINOS',
    'HOTEL',
    'INDUSTRIA',
    'JARDIN_INFANTES',
    'RESIDENCIA_ASISTENCIA',
    'USOS_CULT_MUSICA_VIVO',
  ]

  it('usos solo-G3 devuelven 3 con cualquier input chico', () => {
    for (const codigo of SOLO_G3) {
      expect(clasif(codigo, { superficieCubiertaM2: 1 }).grupo).toBe(3)
    }
  })

  it('usos sin G1 nunca devuelven 1 (input mínimo)', () => {
    for (const codigo of SIN_G1) {
      expect(clasif(codigo, { superficieCubiertaM2: 1, pisosElevados: 0 }).grupo).not.toBe(1)
    }
  })
})
