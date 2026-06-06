/**
 * Helper ISOMÓRFICO (server + client) para derivar la URL pública de un asset
 * a partir del PATH relativo guardado en DB.
 *
 * Contexto: desde el refactor de pre-lanzamiento, la DB guarda el `path`
 * relativo del objeto (no la URL). La URL se deriva en el momento de mostrar.
 *
 * Este helper construye la URL PÚBLICA estable de Supabase Storage:
 *   {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
 *
 * Es una transformación de string pura (sin red), por eso sirve tanto en
 * Server Components como en Client Components — clave para no agregar N
 * round-trips en listados que se renderizan en el cliente.
 *
 * Compatibilidad LEGACY: si el valor guardado ya es una URL absoluta
 * (datos viejos), se devuelve tal cual.
 *
 * NOTA sobre buckets privados: para buckets que requieran control de acceso
 * estricto (signed URLs on-read), usar `resolveAssetUrl` de
 * `lib/storage/resolve-url.ts` desde un Server Component / Server Action.
 * Este helper asume lectura pública (la postura actual de la app para los
 * assets de negocio).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

/** ¿El valor guardado es una URL absoluta (legacy) y no un path relativo? */
export function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * Deriva la URL pública de un asset desde su path (o URL legacy).
 *
 * @param bucket  bucket donde vive el objeto
 * @param pathOrUrl  path relativo guardado en DB, o URL absoluta legacy
 * @returns URL lista para <img>/<a>, o null si no hay valor
 */
export function publicAssetUrl(
  bucket: string,
  pathOrUrl: string | null | undefined,
): string | null {
  if (!pathOrUrl) return null
  if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl
  const cleanPath = pathOrUrl.replace(/^\/+/, '')
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`
}
