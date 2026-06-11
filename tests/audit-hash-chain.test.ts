import { describe, it, expect } from 'vitest'
import {
  GENESIS,
  buildCanonical,
  computeEntryHash,
  sha256Hex,
  verifyChain,
  formatCreatedAtUTC,
  type CanonicalFields,
  type ChainRow,
} from '@/lib/audit/hash-chain'

function fields(seq: number, overrides: Partial<CanonicalFields> = {}): CanonicalFields {
  return {
    seq,
    tabla: 'observaciones_gestiones',
    accion: 'UPDATE',
    registroId: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    consultoraId: '33333333-3333-3333-3333-333333333333',
    createdAt: '2026-07-02 12:00:00.123456+00',
    traceId: '44444444-4444-4444-4444-444444444444',
    origen: 'humano',
    datosAntesText: '{"estado": "abierta"}',
    datosNuevoText: '{"estado": "cerrada"}',
    ...overrides,
  }
}

/** Construye una cadena bien formada a partir de N payloads canónicos. */
function buildChain(canonicals: string[]): ChainRow[] {
  const rows: ChainRow[] = []
  let prev = GENESIS
  canonicals.forEach((canonical, i) => {
    const hash = computeEntryHash(prev, canonical)
    rows.push({ seq: i + 1, hashPrev: prev, hash, canonical })
    prev = hash
  })
  return rows
}

describe('formatCreatedAtUTC — paridad con to_char(... US)', () => {
  it('preserva microsegundos de un timestamptz +00 de Postgres', () => {
    expect(formatCreatedAtUTC('2026-07-02 12:00:00.123456+00')).toBe('2026-07-02T12:00:00.123456Z')
  })

  it('rellena a 6 dígitos cuando faltan microsegundos', () => {
    expect(formatCreatedAtUTC('2026-05-20T12:00:00Z')).toBe('2026-05-20T12:00:00.000000Z')
    expect(formatCreatedAtUTC('2026-05-20 12:00:00.5+00')).toBe('2026-05-20T12:00:00.500000Z')
  })

  it('convierte un Date a UTC con 6 dígitos', () => {
    expect(formatCreatedAtUTC(new Date('2026-07-02T12:00:00.123Z'))).toBe('2026-07-02T12:00:00.123000Z')
  })
})

describe('buildCanonical — formato pipe-delimitado estable', () => {
  it('serializa los campos en el orden y formato esperado', () => {
    expect(buildCanonical(fields(7))).toBe(
      [
        '7',
        'observaciones_gestiones',
        'UPDATE',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333',
        '2026-07-02T12:00:00.123456Z',
        '44444444-4444-4444-4444-444444444444',
        'humano',
        '{"estado": "abierta"}',
        '{"estado": "cerrada"}',
      ].join('|'),
    )
  })

  it('representa nulls como string vacío', () => {
    const c = buildCanonical(fields(1, { traceId: null, datosAntesText: null }))
    const parts = c.split('|')
    expect(parts[7]).toBe('') // trace_id
    expect(parts[9]).toBe('') // datos_antes
  })
})

describe('computeEntryHash', () => {
  it('es determinista y produce sha256 hex (64 chars)', () => {
    const c = buildCanonical(fields(1))
    const h1 = computeEntryHash(GENESIS, c)
    const h2 = computeEntryHash(GENESIS, c)
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('equivale a sha256(prev || canonical)', () => {
    const c = buildCanonical(fields(1))
    expect(computeEntryHash('abc', c)).toBe(sha256Hex('abc' + c))
  })

  it('null/undefined prev usa GENESIS', () => {
    const c = buildCanonical(fields(1))
    expect(computeEntryHash(null, c)).toBe(sha256Hex(GENESIS + c))
    expect(computeEntryHash(undefined, c)).toBe(sha256Hex(GENESIS + c))
  })
})

describe('verifyChain — detección de alteración (cadena de custodia)', () => {
  it('una cadena bien formada es ÍNTEGRA', () => {
    const rows = buildChain([buildCanonical(fields(1)), buildCanonical(fields(2)), buildCanonical(fields(3))])
    expect(verifyChain(rows).estado).toBe('INTEGRA')
  })

  it('detecta alteración de CONTENIDO (payload cambiado tras el hash)', () => {
    const rows = buildChain([buildCanonical(fields(1)), buildCanonical(fields(2)), buildCanonical(fields(3))])
    // Simular que alguien editó datos_nuevo de la fila 2 sin recomputar el hash
    rows[1].canonical = buildCanonical(fields(2, { datosNuevoText: '{"estado": "ALTERADO"}' }))
    const v = verifyChain(rows)
    expect(v.estado).toBe('ALTERADA')
    if (v.estado === 'ALTERADA') expect(v.primerFalloSeq).toBe(2)
  })

  it('detecta ruptura del ENCADENADO (hash_prev manipulado)', () => {
    const rows = buildChain([buildCanonical(fields(1)), buildCanonical(fields(2)), buildCanonical(fields(3))])
    rows[2].hashPrev = 'deadbeef'
    const v = verifyChain(rows)
    expect(v.estado).toBe('ALTERADA')
    if (v.estado === 'ALTERADA') expect(v.primerFalloSeq).toBe(3)
  })

  it('detecta el borrado de un eslabón intermedio', () => {
    const rows = buildChain([buildCanonical(fields(1)), buildCanonical(fields(2)), buildCanonical(fields(3))])
    const tampered = [rows[0], rows[2]] // se borró la fila 2
    const v = verifyChain(tampered)
    expect(v.estado).toBe('ALTERADA')
    if (v.estado === 'ALTERADA') expect(v.primerFalloSeq).toBe(3)
  })

  it('el orden de entrada no importa (ordena por seq)', () => {
    const rows = buildChain([buildCanonical(fields(1)), buildCanonical(fields(2)), buildCanonical(fields(3))])
    const shuffled = [rows[2], rows[0], rows[1]]
    expect(verifyChain(shuffled).estado).toBe('INTEGRA')
  })
})
