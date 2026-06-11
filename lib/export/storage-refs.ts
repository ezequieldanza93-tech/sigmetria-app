/**
 * Extracción de REFERENCIAS a archivos de Storage desde las filas exportadas.
 *
 * Por qué desde las filas (y no desde la tabla `archivos`): así SOLO bajamos
 * binarios de filas que YA pasaron el scoping de empresa (aislamiento tenant).
 * Cada entidad guarda sus archivos en columnas conocidas y en un bucket por
 * convención. Acá mapeamos (entidad → columnas de path → bucket).
 *
 * Lógica PURA: recibe filas, devuelve refs {bucket, path}. La descarga real
 * vive en build-package.ts.
 */

import type { StorageBucket } from '@/lib/storage/buckets'

export interface StorageRef {
  bucket: StorageBucket
  /** Path relativo dentro del bucket (o URL absoluta legacy). */
  path: string
  /** Entidad de origen (para trazabilidad en el manifest). */
  entity: string
}

/**
 * Mapa entidad(file) → { columnas que contienen path, bucket }.
 * Solo entidades con binarios asociados. Verificado contra migraciones:
 *  - incidentes_fotos.url       → bucket 'incidentes'
 *  - denuncias_fotos.url        → bucket 'denuncias'
 *  - documentos_empresa.archivo_url / documentos_establecimientos.archivo_url → 'documentos'
 *  - inspecciones_adjuntos.url  → 'documentos' (adjuntos generales)
 *  - gestiones_registros.evidencia_url → 'documentos'
 *  - gestiones_observaciones.evidencia_cierre_url → 'documentos'
 */
const ENTITY_FILE_COLUMNS: Record<
  string,
  { columns: string[]; bucket: StorageBucket }
> = {
  incidentes_fotos: { columns: ['url'], bucket: 'incidentes' },
  denuncias_fotos: { columns: ['url'], bucket: 'denuncias' },
  documentos_empresa: { columns: ['archivo_url'], bucket: 'documentos' },
  documentos_establecimientos: { columns: ['archivo_url'], bucket: 'documentos' },
  inspecciones_adjuntos: { columns: ['url'], bucket: 'documentos' },
  gestiones_registros: { columns: ['evidencia_url'], bucket: 'documentos' },
  gestiones_observaciones: { columns: ['evidencia_cierre_url'], bucket: 'documentos' },
}

/** ¿El valor es una URL absoluta (legacy) en vez de un path relativo? */
export function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * Extrae las referencias de Storage de un set de filas de una entidad.
 * Ignora valores nulos, vacíos y URLs absolutas legacy (no descargables por
 * path; quedan documentadas como URL en el CSV/JSON).
 */
export function extractStorageRefs(
  entityFile: string,
  rows: Record<string, unknown>[],
): StorageRef[] {
  const def = ENTITY_FILE_COLUMNS[entityFile]
  if (!def) return []
  const refs: StorageRef[] = []
  for (const row of rows) {
    for (const col of def.columns) {
      const raw = row[col]
      if (typeof raw !== 'string' || raw.length === 0) continue
      if (isAbsoluteUrl(raw)) continue // legacy: no es path descargable
      refs.push({ bucket: def.bucket, path: raw, entity: entityFile })
    }
  }
  return refs
}

/** Dedup de refs por (bucket, path). */
export function dedupeRefs(refs: StorageRef[]): StorageRef[] {
  const seen = new Set<string>()
  const out: StorageRef[] = []
  for (const ref of refs) {
    const key = `${ref.bucket}::${ref.path}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ref)
  }
  return out
}
