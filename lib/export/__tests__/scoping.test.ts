import { describe, it, expect } from 'vitest'
import {
  buildEstablecimientoScope,
  filterByEstablecimiento,
  filterByParent,
  filterByDateRange,
  parseExportScope,
} from '@/lib/export/scoping'

describe('buildEstablecimientoScope', () => {
  it('builds a set of establecimiento ids', () => {
    const set = buildEstablecimientoScope([{ id: 'e1' }, { id: 'e2' }])
    expect(set.has('e1')).toBe(true)
    expect(set.has('e2')).toBe(true)
    expect(set.size).toBe(2)
  })
})

describe('filterByEstablecimiento — AISLAMIENTO multi-tenant', () => {
  it('keeps only rows whose establecimiento_id is allowed', () => {
    const allowed = buildEstablecimientoScope([{ id: 'eA1' }, { id: 'eA2' }])
    const rows = [
      { id: '1', establecimiento_id: 'eA1' }, // empresa A
      { id: '2', establecimiento_id: 'eB1' }, // empresa B (NO debe colarse)
      { id: '3', establecimiento_id: 'eA2' }, // empresa A
    ]
    const filtered = filterByEstablecimiento(rows, allowed)
    expect(filtered.map(r => r.id)).toEqual(['1', '3'])
    // El establecimiento de la empresa B quedó EXCLUIDO.
    expect(filtered.some(r => r.establecimiento_id === 'eB1')).toBe(false)
  })

  it('drops rows with null or missing establecimiento_id', () => {
    const allowed = buildEstablecimientoScope([{ id: 'e1' }])
    const rows = [
      { id: '1', establecimiento_id: null },
      { id: '2' },
      { id: '3', establecimiento_id: 'e1' },
    ]
    expect(filterByEstablecimiento(rows, allowed).map(r => r.id)).toEqual(['3'])
  })
})

describe('filterByParent', () => {
  it('keeps only children of allowed parents', () => {
    const parents = new Set(['p1', 'p2'])
    const rows = [
      { id: 'f1', incidente_id: 'p1' },
      { id: 'f2', incidente_id: 'pX' }, // padre ajeno
      { id: 'f3', incidente_id: 'p2' },
    ]
    expect(filterByParent(rows, 'incidente_id', parents).map(r => r.id)).toEqual(['f1', 'f3'])
  })
})

describe('filterByDateRange', () => {
  const rows = [
    { id: '1', fecha: '2025-06-01' },
    { id: '2', fecha: '2026-03-15' },
    { id: '3', fecha: '2026-12-31' },
    { id: '4', fecha: '2027-01-01' },
  ]

  it('returns all rows when no range given', () => {
    expect(filterByDateRange(rows, 'fecha', null, null)).toHaveLength(4)
  })

  it('filters by [desde, hasta] inclusive', () => {
    const r = filterByDateRange(rows, 'fecha', '2026-01-01', '2026-12-31')
    expect(r.map(x => x.id)).toEqual(['2', '3'])
  })

  it('filters by only desde', () => {
    const r = filterByDateRange(rows, 'fecha', '2026-12-31', null)
    expect(r.map(x => x.id)).toEqual(['3', '4'])
  })

  it('drops rows with null/invalid dates when a range is active', () => {
    const r = filterByDateRange([{ id: 'x', fecha: null }], 'fecha', '2026-01-01', null)
    expect(r).toHaveLength(0)
  })
})

describe('parseExportScope', () => {
  it('defaults to completo / both formats / archivos included', () => {
    const s = parseExportScope(new URLSearchParams(''))
    expect(s.modo).toBe('completo')
    expect(s.formatos).toEqual(['csv', 'json'])
    expect(s.incluyeArchivos).toBe(true)
    expect(s.async).toBe(false)
  })

  it('marks parcial when a date range is given', () => {
    const s = parseExportScope(new URLSearchParams('desde=2026-01-01&hasta=2026-12-31'))
    expect(s.modo).toBe('parcial')
    expect(s.desde).toBe('2026-01-01')
    expect(s.hasta).toBe('2026-12-31')
  })

  it('parses entidades and marks parcial', () => {
    const s = parseExportScope(new URLSearchParams('entidades=inspecciones,riesgos'))
    expect(s.modo).toBe('parcial')
    expect(s.entidades).toEqual(['inspecciones', 'riesgos'])
  })

  it('parses single formats', () => {
    expect(parseExportScope(new URLSearchParams('formato=csv')).formatos).toEqual(['csv'])
    expect(parseExportScope(new URLSearchParams('formato=json')).formatos).toEqual(['json'])
  })

  it('respects archivos=0 and async=1', () => {
    const s = parseExportScope(new URLSearchParams('archivos=0&async=1'))
    expect(s.incluyeArchivos).toBe(false)
    expect(s.async).toBe(true)
  })

  it('rejects invalid date format', () => {
    expect(() => parseExportScope(new URLSearchParams('desde=01-01-2026'))).toThrow()
  })

  it('rejects desde after hasta', () => {
    expect(() =>
      parseExportScope(new URLSearchParams('desde=2026-12-31&hasta=2026-01-01')),
    ).toThrow()
  })

  it('rejects unknown entidades', () => {
    expect(() => parseExportScope(new URLSearchParams('entidades=tabla_inexistente'))).toThrow()
  })

  it('rejects invalid formato', () => {
    expect(() => parseExportScope(new URLSearchParams('formato=xml'))).toThrow()
  })
})
