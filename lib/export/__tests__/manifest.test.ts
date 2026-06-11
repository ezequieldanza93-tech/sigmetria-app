import { describe, it, expect } from 'vitest'
import {
  sha256Hex,
  utf8Bytes,
  buildManifest,
  serializeManifest,
  type ManifestFileEntry,
} from '@/lib/export/manifest'

describe('sha256Hex', () => {
  it('computes the known SHA-256 of an empty input', async () => {
    const hex = await sha256Hex(new Uint8Array(0))
    // SHA-256 del vacío (vector conocido).
    expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('computes the known SHA-256 of "abc"', async () => {
    const hex = await sha256Hex(utf8Bytes('abc'))
    expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('is deterministic for the same input', async () => {
    const a = await sha256Hex(utf8Bytes('sigmetria'))
    const b = await sha256Hex(utf8Bytes('sigmetria'))
    expect(a).toBe(b)
  })

  it('differs for different inputs', async () => {
    const a = await sha256Hex(utf8Bytes('empresa-a'))
    const b = await sha256Hex(utf8Bytes('empresa-b'))
    expect(a).not.toBe(b)
  })
})

describe('buildManifest', () => {
  const files: ManifestFileEntry[] = [
    { path: 'data/empresa.csv', kind: 'csv', entity: 'empresa', bytes: 100, sha256: 'aa', rows: 1 },
    { path: 'data/empresa.json', kind: 'json', entity: 'empresa', bytes: 120, sha256: 'bb', rows: 1 },
    { path: 'archivos/documentos/foo.pdf', kind: 'binary', entity: 'documentos_empresa', bytes: 5000, sha256: 'cc' },
  ]

  it('aggregates totals correctly', () => {
    const m = buildManifest({
      empresaNombre: 'ACME SA',
      scope: {
        empresaId: 'emp-1',
        modo: 'completo',
        entidades: null,
        desde: null,
        hasta: null,
        formatos: ['csv', 'json'],
        incluyeArchivos: true,
      },
      files,
      relations: [{ from: 'establecimientos', to: 'empresa', via: 'empresa_id' }],
      generadoEn: '2026-07-04T00:00:00.000Z',
    })
    expect(m.totales.archivos).toBe(3)
    expect(m.totales.bytes).toBe(5220)
    expect(m.totales.filas).toBe(2) // binario no suma filas
    expect(m.empresa.nombre).toBe('ACME SA')
    expect(m.algoritmo_checksum).toBe('SHA-256')
    expect(m.relaciones).toHaveLength(1)
  })

  it('preserves the requested scope', () => {
    const m = buildManifest({
      empresaNombre: null,
      scope: {
        empresaId: 'emp-2',
        modo: 'parcial',
        entidades: ['inspecciones'],
        desde: '2026-01-01',
        hasta: '2026-12-31',
        formatos: ['csv'],
        incluyeArchivos: false,
      },
      files: [],
      relations: [],
    })
    expect(m.alcance.modo).toBe('parcial')
    expect(m.alcance.entidades).toEqual(['inspecciones'])
    expect(m.alcance.desde).toBe('2026-01-01')
  })

  it('serializes to valid JSON', () => {
    const m = buildManifest({
      empresaNombre: 'X',
      scope: {
        empresaId: 'e',
        modo: 'completo',
        entidades: null,
        desde: null,
        hasta: null,
        formatos: ['json'],
        incluyeArchivos: true,
      },
      files,
      relations: [],
    })
    const str = serializeManifest(m)
    expect(() => JSON.parse(str)).not.toThrow()
    expect(JSON.parse(str).generador).toBe('sigmetria-portabilidad')
  })
})
