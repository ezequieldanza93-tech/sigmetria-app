import { describe, it, expect } from 'vitest'
import { toCSV, toJSON, UTF8_BOM } from '@/lib/export/serialize'

describe('toCSV', () => {
  it('returns only the BOM for empty rows', () => {
    expect(toCSV([])).toBe(UTF8_BOM)
  })

  it('emits a header from the union of keys', () => {
    const csv = toCSV([{ a: 1, b: 2 }, { a: 3, c: 4 }])
    const [header] = csv.replace(UTF8_BOM, '').split('\r\n')
    expect(header).toBe('a,b,c')
  })

  it('escapes commas, quotes and newlines (RFC-4180)', () => {
    const csv = toCSV([{ texto: 'hola, "mundo"\nlinea2' }])
    expect(csv).toContain('"hola, ""mundo""\nlinea2"')
  })

  it('serializes nested objects (JSONB) as inline JSON', () => {
    const csv = toCSV([{ historial: [{ estado: 'recibida' }] }])
    expect(csv).toContain('estado')
    expect(csv).toContain('recibida')
  })

  it('renders null/undefined as empty cells', () => {
    const csv = toCSV([{ a: null, b: undefined, c: 'x' }])
    const lines = csv.replace(UTF8_BOM, '').split('\r\n')
    expect(lines[1]).toBe(',,x')
  })
})

describe('toJSON', () => {
  it('produces a parseable array of objects', () => {
    const rows = [{ id: '1', nombre: 'ACME' }]
    const json = toJSON(rows)
    expect(JSON.parse(json)).toEqual(rows)
  })

  it('produces an empty array for no rows', () => {
    expect(JSON.parse(toJSON([]))).toEqual([])
  })
})
