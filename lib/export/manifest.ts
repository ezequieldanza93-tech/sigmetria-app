/**
 * Construcción del MANIFEST y checksums del paquete de portabilidad.
 *
 * Por qué existe (Res. SRT 48/2025 — portabilidad): el titular de los datos
 * tiene derecho a recuperarlos en "formato estructurado, de uso común y de
 * lectura mecánica". El manifest describe QUÉ contiene el paquete, las
 * RELACIONES entre archivos (claves foráneas a nivel tabla), la fecha de
 * generación y un checksum SHA-256 de CADA archivo del paquete para verificar
 * integridad post-descarga.
 *
 * Todo acá es LÓGICA PURA y testeable (sin red, sin Supabase, sin Storage):
 * recibe bytes/strings y devuelve estructuras. El armado real del ZIP vive en
 * build-package.ts.
 */

/** SHA-256 hex de un payload binario. Usa Web Crypto (disponible en Node 18+ y Edge). */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  // Copia a un ArrayBuffer "puro" para satisfacer el tipo BufferSource sin
  // depender del SharedArrayBuffer subyacente del Uint8Array recibido.
  const buf = new ArrayBuffer(data.byteLength)
  new Uint8Array(buf).set(data)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

/** Codifica un string UTF-8 a bytes (para checksums de CSV/JSON de texto). */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

/** Entrada de archivo dentro del manifest. */
export interface ManifestFileEntry {
  /** Ruta del archivo dentro del ZIP (ej. "data/incidentes.csv"). */
  path: string
  /** Tipo lógico del contenido. */
  kind: 'csv' | 'json' | 'binary' | 'manifest'
  /** Entidad/tabla de origen (null para binarios o el propio manifest). */
  entity?: string | null
  /** Tamaño en bytes. */
  bytes: number
  /** Checksum SHA-256 en hex. */
  sha256: string
  /** Cantidad de filas (solo CSV/JSON de tablas). */
  rows?: number
}

/** Relación declarada entre dos entidades (clave foránea a nivel tabla). */
export interface ManifestRelation {
  /** Entidad hija. */
  from: string
  /** Entidad padre referenciada. */
  to: string
  /** Columna FK en la entidad hija. */
  via: string
}

/** Alcance del export (qué se pidió). */
export interface ManifestScope {
  empresaId: string
  /** 'completo' o 'parcial'. */
  modo: 'completo' | 'parcial'
  /** Entidades incluidas (si fue parcial por tipo). null = todas. */
  entidades: string[] | null
  /** Rango de fechas aplicado (ISO yyyy-mm-dd) o null. */
  desde: string | null
  hasta: string | null
  /** Formatos incluidos. */
  formatos: ('csv' | 'json')[]
  /** Si se incluyeron los binarios de Storage. */
  incluyeArchivos: boolean
}

export interface ManifestInput {
  empresaNombre: string | null
  scope: ManifestScope
  files: ManifestFileEntry[]
  relations: ManifestRelation[]
  /** ISO timestamp de generación. */
  generadoEn?: string
}

export interface Manifest {
  formato_version: '1.0'
  generador: 'sigmetria-portabilidad'
  norma: 'Res. SRT 48/2025 — Soluciones 4.0 (portabilidad)'
  generado_en: string
  empresa: { id: string; nombre: string | null }
  alcance: ManifestScope
  archivos: ManifestFileEntry[]
  relaciones: ManifestRelation[]
  totales: { archivos: number; bytes: number; filas: number }
  algoritmo_checksum: 'SHA-256'
}

/**
 * Arma el objeto manifest a partir de la lista de archivos y relaciones.
 * Función PURA: no lee el ZIP ni la red. El checksum de cada archivo ya viene
 * calculado en `files`.
 */
export function buildManifest(input: ManifestInput): Manifest {
  const filas = input.files.reduce((acc, f) => acc + (f.rows ?? 0), 0)
  const bytes = input.files.reduce((acc, f) => acc + f.bytes, 0)
  return {
    formato_version: '1.0',
    generador: 'sigmetria-portabilidad',
    norma: 'Res. SRT 48/2025 — Soluciones 4.0 (portabilidad)',
    generado_en: input.generadoEn ?? new Date().toISOString(),
    empresa: { id: input.scope.empresaId, nombre: input.empresaNombre },
    alcance: input.scope,
    archivos: input.files,
    relaciones: input.relations,
    totales: {
      archivos: input.files.length,
      bytes,
      filas,
    },
    algoritmo_checksum: 'SHA-256',
  }
}

/** Serializa el manifest a JSON con indentación (lectura humana + mecánica). */
export function serializeManifest(manifest: Manifest): string {
  return JSON.stringify(manifest, null, 2)
}
