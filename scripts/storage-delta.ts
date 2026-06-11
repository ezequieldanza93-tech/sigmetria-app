/**
 * Lógica PURA del espejo incremental de Storage → R2.
 *
 * Aislada de toda I/O (Supabase, AWS CLI, fs) para poder testearla sin red ni
 * credenciales. `backup-external.ts` la usa para decidir QUÉ objetos subir.
 *
 * Regla del incremental: un objeto de Supabase se RE-SUBE a R2 solo si:
 *   - no existe ya en R2 bajo `storage/<bucket>/<path>`, O
 *   - existe pero su tamaño difiere (re-upload, archivo cambió).
 * Todo lo demás se SALTEA (nunca se re-baja de Supabase ni se re-sube a R2).
 */

/** Objeto en el origen (Supabase Storage). */
export interface SourceObject {
  bucket: string
  /** path relativo dentro del bucket */
  path: string
  size: number
}

/** Objeto ya presente en el destino (R2), bajo el prefijo `storage/`. */
export interface RemoteObject {
  /** key completa en R2, ej. `storage/documentos/abc/x.pdf` */
  key: string
  size: number
}

/** La key en R2 para un objeto de Supabase: `storage/<bucket>/<path>`. */
export function storageKeyFor(bucket: string, objectPath: string): string {
  // Normaliza separadores a `/` (por si corre en Windows) y limpia dobles barras.
  const cleanPath = objectPath.replace(/\\/g, '/').replace(/^\/+/, '')
  return `storage/${bucket}/${cleanPath}`
}

/**
 * Calcula el DELTA: qué objetos de Supabase faltan en R2 (o difieren en tamaño).
 *
 * @param source  objetos listados en Supabase ({ bucket, path, size }).
 * @param remote  objetos ya presentes en R2 bajo `storage/` ({ key, size }).
 * @returns       el subconjunto de `source` que hay que subir, en orden estable.
 */
export function computeStorageDelta(
  source: SourceObject[],
  remote: RemoteObject[],
): SourceObject[] {
  // Índice por key → size para lookup O(1).
  const remoteByKey = new Map<string, number>()
  for (const r of remote) remoteByKey.set(r.key, r.size)

  const toUpload: SourceObject[] = []
  for (const obj of source) {
    const key = storageKeyFor(obj.bucket, obj.path)
    const remoteSize = remoteByKey.get(key)
    // Falta en R2, o el tamaño difiere → re-subir.
    if (remoteSize === undefined || remoteSize !== obj.size) {
      toUpload.push(obj)
    }
  }
  return toUpload
}

/** Parsea la salida JSON de `aws s3api list-objects-v2` a RemoteObject[]. */
export function parseListObjectsV2(
  pages: { Contents?: { Key?: string; Size?: number }[] }[],
): RemoteObject[] {
  const out: RemoteObject[] = []
  for (const page of pages) {
    for (const c of page.Contents ?? []) {
      if (typeof c.Key === 'string') {
        out.push({ key: c.Key, size: typeof c.Size === 'number' ? c.Size : 0 })
      }
    }
  }
  return out
}
