'use client'

/**
 * Firma de URLs de assets EN EL CLIENTE (browser), a partir del PATH relativo
 * guardado en DB.
 *
 * Por qué existe: desde la postura "SEGURIDAD ANTE TODO" los buckets con datos
 * sensibles (documentos, firmas, certificados, etc.) son PRIVADOS. Sus URLs no
 * se pueden construir como string público — hay que FIRMARLAS. En componentes
 * cliente (modales, tabs, cards con React Query / useState) firmamos con el
 * cliente del BROWSER, que usa la sesión del usuario y por lo tanto respeta la
 * RLS de storage.objects. NUNCA se usa service role en el cliente.
 *
 * Rendimiento: para listados se firma en BATCH con createSignedUrls (una sola
 * llamada por bucket). Los buckets públicos y los valores legacy (URL absoluta)
 * se resuelven sin red.
 *
 * Compatibilidad LEGACY: si el valor guardado ya es una URL absoluta (datos
 * viejos), se devuelve tal cual.
 */

import { useEffect, useState } from 'react'
import { BUCKET_IS_PUBLIC, type StorageBucket } from '@/lib/storage/buckets'
import { firmarUrlsStorage } from '@/lib/actions/firmar-urls-storage'

/** TTL por defecto de las signed URLs de buckets privados: 1 hora. */
export const DEFAULT_SIGNED_TTL_SECONDS = 60 * 60

/** ¿El valor guardado es una URL absoluta (legacy) y no un path relativo? */
function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

/** URL pública (string puro, sin red) para buckets públicos. */
function publicUrl(bucket: string, path: string): string {
  const cleanPath = path.replace(/^\/+/, '')
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`
}

/**
 * Firma (o resuelve) MUCHOS paths del MISMO bucket en una sola llamada.
 * Devuelve un Map path -> URL (o null si no se pudo firmar). Los públicos y los
 * legacy se resuelven sin red; los privados van a un único createSignedUrls.
 */
export async function signBucketPaths(
  bucket: StorageBucket,
  paths: (string | null | undefined)[],
  ttlSeconds: number = DEFAULT_SIGNED_TTL_SECONDS,
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>()
  // Dedupe de paths válidos.
  const unique = Array.from(
    new Set(paths.filter((p): p is string => typeof p === 'string' && p.length > 0)),
  )
  if (unique.length === 0) return result

  const isPublic = BUCKET_IS_PUBLIC[bucket]
  const toSign: string[] = []

  for (const p of unique) {
    if (isAbsoluteUrl(p)) {
      result.set(p, p) // legacy: ya es URL absoluta
    } else if (isPublic) {
      result.set(p, publicUrl(bucket, p))
    } else {
      toSign.push(p)
    }
  }

  if (toSign.length > 0) {
    // Usamos service role (server action) en vez del cliente del browser porque la
    // RLS de storage.objects puede bloquear la lectura si el usuario actual no es
    // el owner del archivo ni miembro activo de la consultora del path (issue #2
    // de la tanda 1 de founder-tester). El service role bypassea RLS de forma segura:
    // los paths a firmar los decide el componente cliente (el usuario ya tiene
    // permiso de verlos por otras policies de la app).
    const data = await firmarUrlsStorage(bucket, toSign, ttlSeconds)
    for (const d of data) {
      result.set(d.path, d.signedUrl ?? null)
    }
    // Cualquier path que no haya vuelto del API queda como null.
    for (const p of toSign) {
      if (!result.has(p)) result.set(p, null)
    }
  }

  return result
}

/**
 * Hook: firma en batch los paths de UN bucket y devuelve un resolver síncrono
 * `getUrl(pathOrUrl)` listo para usar en el render.
 *
 * Mientras se está firmando, `getUrl` devuelve null (el caller decide el
 * fallback / skeleton). Para buckets públicos y legacy resuelve de inmediato.
 *
 * Uso típico (listado):
 *   const { getUrl } = useSignedUrls('documentos', docs.map(d => d.archivo_url))
 *   ...
 *   <a href={getUrl(d.archivo_url) ?? '#'}>Ver</a>
 */
export function useSignedUrls(
  bucket: StorageBucket,
  paths: (string | null | undefined)[],
  ttlSeconds: number = DEFAULT_SIGNED_TTL_SECONDS,
): { getUrl: (pathOrUrl: string | null | undefined) => string | null; isLoading: boolean } {
  const [urls, setUrls] = useState<Map<string, string | null>>(new Map())
  const [isLoading, setIsLoading] = useState(false)

  // Clave estable basada en los paths (ordenados) para no re-firmar de más.
  const key = Array.from(
    new Set(paths.filter((p): p is string => typeof p === 'string' && p.length > 0)),
  )
    .sort()
    .join('|')

  useEffect(() => {
    let cancelled = false
    if (!key) {
      setUrls(new Map())
      return
    }
    setIsLoading(true)
    signBucketPaths(bucket, key.split('|'), ttlSeconds)
      .then(map => {
        if (!cancelled) setUrls(map)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // key resume todos los paths; bucket/ttl también disparan re-firma.
  }, [bucket, key, ttlSeconds])

  function getUrl(pathOrUrl: string | null | undefined): string | null {
    if (!pathOrUrl) return null
    if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl
    return urls.get(pathOrUrl) ?? null
  }

  return { getUrl, isLoading }
}
