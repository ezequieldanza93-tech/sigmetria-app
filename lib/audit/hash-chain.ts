/**
 * Cadena de custodia — algoritmo de hash chain del audit_log (Art. 4.2 Res. SRT 48/2025).
 *
 * Espejo en TypeScript de las funciones SQL `fn_audit_canonical` y `fn_verify_audit_chain`
 * (migración 20260702000001_audit_trazabilidad_srt.sql). Sirve para:
 *   1. Documentar y fijar el contrato del payload canónico.
 *   2. Verificar el encadenado de forma independiente (defensa en profundidad).
 *   3. Tests deterministas sin base de datos.
 *
 * IMPORTANTE — paridad TS↔SQL:
 *   Los campos ESCALARES (seq, tabla, accion, ids, fecha, origen) se serializan idéntico en
 *   ambos lados. Los campos JSONB (datos_antes / datos_nuevo) NO pueden byte-matchearse desde
 *   el cliente, porque Postgres normaliza las claves de un jsonb (orden por longitud y bytes)
 *   distinto a `JSON.stringify`. Por eso el verificador AUTORITATIVO de cadenas con payload
 *   jsonb es `public.fn_verify_audit_chain(consultora_id)` en la base. Esta lib verifica el
 *   ALGORITMO de encadenado y los campos escalares.
 */

import { createHash } from 'node:crypto'

export const GENESIS = 'GENESIS'

export type AuditOrigen = 'humano' | 'automatizado' | 'sistema'

export interface CanonicalFields {
  seq: number | bigint
  tabla: string | null
  accion: string | null
  registroId: string | null
  userId: string | null
  consultoraId: string | null
  /** ISO/timestamptz tal como lo devuelve Postgres o un Date. Se normaliza a UTC con µs. */
  createdAt: string | Date
  traceId: string | null
  origen: string | null
  /** texto jsonb ya serializado por la DB, o null. NO lo reconstruyas desde un objeto JS. */
  datosAntesText?: string | null
  datosNuevoText?: string | null
}

/**
 * Normaliza una fecha al formato exacto de `to_char(... 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`:
 * `2026-07-02T12:00:00.123456Z` (UTC, 6 dígitos de microsegundos).
 */
export function formatCreatedAtUTC(value: string | Date): string {
  if (value instanceof Date) {
    const iso = value.toISOString() // ...mmmZ (3 decimales)
    return iso.replace(/\.(\d{3})Z$/, '.$1000Z').replace('Z', 'Z')
  }
  // string desde Postgres: "2026-07-02 12:00:00.123456+00" | ISO | sin fracción
  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|([+-]\d{2})(?::?(\d{2}))?)?$/,
  )
  if (!m) {
    // último recurso: parsear como Date (pierde µs reales más allá de ms)
    return formatCreatedAtUTC(new Date(value))
  }
  const [, y, mo, d, h, mi, s, frac = '', offH, offM] = m
  let date = `${y}-${mo}-${d}T${h}:${mi}:${s}`
  // si hay offset distinto de UTC, convertir
  if (offH && offH !== '+00') {
    const ms = Date.parse(value)
    if (!Number.isNaN(ms)) {
      const iso = new Date(ms).toISOString().replace('Z', '')
      date = iso.slice(0, 19)
    }
  }
  const micros = (frac + '000000').slice(0, 6)
  void offM
  return `${date}.${micros}Z`
}

/** Construye el payload canónico (mismo formato pipe-delimitado que fn_audit_canonical). */
export function buildCanonical(f: CanonicalFields): string {
  return [
    String(f.seq),
    f.tabla ?? '',
    f.accion ?? '',
    f.registroId ?? '',
    f.userId ?? '',
    f.consultoraId ?? '',
    formatCreatedAtUTC(f.createdAt),
    f.traceId ?? '',
    f.origen ?? '',
    f.datosAntesText ?? '',
    f.datosNuevoText ?? '',
  ].join('|')
}

/** sha256 hex de un string. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/** hash encadenado: sha256( (hashPrev||'GENESIS') || canonical ). */
export function computeEntryHash(hashPrev: string | null | undefined, canonical: string): string {
  return sha256Hex((hashPrev ?? GENESIS) + canonical)
}

export interface ChainRow {
  seq: number | bigint
  hashPrev: string | null
  hash: string | null
  /** payload canónico de esta fila (escalares; ver nota de paridad jsonb). */
  canonical: string
}

export type ChainVerdict =
  | { estado: 'INTEGRA'; detalle: string }
  | { estado: 'ALTERADA'; primerFalloSeq: number; detalle: string }

/**
 * Verifica una cadena de filas (ordenadas o no por seq). Devuelve INTEGRA o el primer fallo.
 * Comprueba (a) el encadenado hash_prev → hash anterior, y (b) que el hash recomputado coincida.
 */
export function verifyChain(rows: ChainRow[]): ChainVerdict {
  const sorted = [...rows].sort((a, b) => Number(a.seq) - Number(b.seq))
  let prev = GENESIS
  for (const r of sorted) {
    if ((r.hashPrev ?? GENESIS) !== prev) {
      return {
        estado: 'ALTERADA',
        primerFalloSeq: Number(r.seq),
        detalle: `hash_prev no coincide con el hash del registro anterior (esperado ${prev}, almacenado ${r.hashPrev})`,
      }
    }
    const calc = computeEntryHash(r.hashPrev, r.canonical)
    if (calc !== r.hash) {
      return {
        estado: 'ALTERADA',
        primerFalloSeq: Number(r.seq),
        detalle: `contenido alterado: hash recomputado (${calc}) != almacenado (${r.hash})`,
      }
    }
    prev = r.hash as string
  }
  return { estado: 'INTEGRA', detalle: 'La cadena de custodia está íntegra.' }
}
