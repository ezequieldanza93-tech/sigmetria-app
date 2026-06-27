'use server'

import { createServiceClient } from '@/lib/supabase/service'

/**
 * Firma URLs de storage con service role (bypassea RLS).
 *
 * Útil cuando la RLS de `storage.objects` bloquea la lectura desde el cliente
 * (ej: el usuario que ve no es el owner que subió el archivo original).
 *
 * El service role tiene permiso total sobre storage.objects, así que firmar
 * acá es seguro siempre que:
 *   - Solo se llamen paths que el usuario YA tiene permiso de ver (la decisión
 *     de qué paths firmar se toma en el componente/cliente según la data).
 *   - El TTL sea corto (default 1 hora) para minimizar ventana de exposición.
 */
export async function firmarUrlsStorage(
  bucket: string,
  paths: string[],
  ttlSeconds: number = 60 * 60,
): Promise<Array<{ path: string; signedUrl: string | null }>> {
  const supabase = createServiceClient()
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, ttlSeconds)
  return (data ?? []).map(d => ({
    path: d.path ?? '',
    signedUrl: d.signedUrl ?? null,
  }))
}
