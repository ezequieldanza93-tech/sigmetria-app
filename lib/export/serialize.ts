/**
 * Serialización de filas a formatos de LECTURA MECÁNICA (CSV y JSON).
 *
 * Lógica PURA y testeable. El CSV usa BOM UTF-8 (compatibilidad Excel) y
 * separador coma con escapado RFC-4180. El JSON es un array de objetos.
 */

/** UTF-8 BOM para que Excel detecte la codificación correcta. */
export const UTF8_BOM = '﻿'

type Row = Record<string, unknown>

/** Escapa un valor para CSV (RFC-4180): comillas, comas y saltos de línea. */
function escapeCsv(value: unknown): string {
  if (value == null) return ''
  // Objetos/arrays (ej. JSONB historial_estados) → JSON inline para no perder data.
  const s =
    typeof value === 'object' ? JSON.stringify(value) : String(value)
  return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

/**
 * Convierte filas a CSV. Las columnas se derivan de la UNIÓN de todas las
 * claves presentes (robusto a filas con columnas opcionales distintas).
 */
export function toCSV(rows: Row[]): string {
  if (!rows.length) return UTF8_BOM
  const headerSet = new Set<string>()
  for (const r of rows) for (const k of Object.keys(r)) headerSet.add(k)
  const headers = Array.from(headerSet)
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escapeCsv(r[h])).join(',')),
  ]
  return UTF8_BOM + lines.join('\r\n')
}

/** Convierte filas a JSON (array de objetos) indentado. */
export function toJSON(rows: Row[]): string {
  return JSON.stringify(rows, null, 2)
}
