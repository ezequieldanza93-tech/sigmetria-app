import { createClient } from '@/lib/supabase/server'
import { BUCKET_IS_PUBLIC, type StorageBucket } from '@/lib/storage/upload'

/**
 * Resolución de URLs on-read a partir del PATH relativo guardado en DB.
 *
 * Por qué existe: desde el refactor de pre-lanzamiento la DB guarda el
 * `path` relativo del objeto (no la URL). La URL se deriva en el momento
 * de mostrar el archivo:
 *   - Bucket público  → getPublicUrl(path)            (URL estable, sin token)
 *   - Bucket privado  → createSignedUrl(path, ttl)    (TTL corto, on-demand)
 *
 * Compatibilidad LEGACY: si el valor guardado ya es una URL absoluta
 * (datos viejos cargados antes del refactor), se devuelve tal cual.
 */

/** TTL por defecto de las signed URLs de buckets privados: 1 hora. */
export const DEFAULT_SIGNED_TTL_SECONDS = 60 * 60

/** ¿El valor guardado es una URL absoluta (legacy) y no un path relativo? */
export function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * Resuelve la URL de un único asset a partir de su path (o URL legacy).
 *
 * @param bucket  bucket donde vive el objeto
 * @param pathOrUrl  path relativo guardado en DB, o URL absoluta legacy
 * @param ttlSeconds  TTL para signed URLs de buckets privados
 * @returns URL lista para usar en <img>/<a>, o null si no hay path
 */
export async function resolveAssetUrl(
  bucket: StorageBucket,
  pathOrUrl: string | null | undefined,
  ttlSeconds: number = DEFAULT_SIGNED_TTL_SECONDS,
): Promise<string | null> {
  if (!pathOrUrl) return null

  // Dato legacy: ya es una URL absoluta → devolver tal cual.
  if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl

  const supabase = await createClient()

  if (BUCKET_IS_PUBLIC[bucket]) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(pathOrUrl)
    return data.publicUrl
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(pathOrUrl, ttlSeconds)
  if (error || !data) return null
  return data.signedUrl
}

/**
 * Resuelve muchos assets del MISMO bucket privado en una sola llamada
 * (createSignedUrls batch) para evitar N round-trips. Los públicos y los
 * legacy se resuelven sin llamada a la red.
 *
 * @returns array alineado con `paths` (null donde no se pudo resolver)
 */
export async function resolveAssetUrls(
  bucket: StorageBucket,
  paths: (string | null | undefined)[],
  ttlSeconds: number = DEFAULT_SIGNED_TTL_SECONDS,
): Promise<(string | null)[]> {
  if (paths.length === 0) return []

  const supabase = await createClient()
  const isPublic = BUCKET_IS_PUBLIC[bucket]

  // Resolución sincrónica de públicos y legacy; juntamos los privados nuevos
  // para un único batch de signed URLs.
  const result: (string | null)[] = new Array(paths.length).fill(null)
  const toSign: { index: number; path: string }[] = []

  paths.forEach((p, i) => {
    if (!p) return
    if (isAbsoluteUrl(p)) { result[i] = p; return }
    if (isPublic) {
      result[i] = supabase.storage.from(bucket).getPublicUrl(p).data.publicUrl
      return
    }
    toSign.push({ index: i, path: p })
  })

  if (toSign.length > 0) {
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrls(toSign.map(t => t.path), ttlSeconds)
    if (data) {
      data.forEach((d, k) => {
        const target = toSign[k]
        if (target && d.signedUrl) result[target.index] = d.signedUrl
      })
    }
  }

  return result
}
