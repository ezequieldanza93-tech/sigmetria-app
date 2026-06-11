/**
 * Guardado del paquete de portabilidad en el bucket privado `exports` y
 * emisión de un SIGNED URL temporal (Res. SRT 48/2025 — entrega del link).
 *
 * Server-only. Usa el cliente con SERVICE ROLE para escribir el objeto (el
 * usuario de la sesión puede no tener INSERT directo en storage.objects según
 * el flujo), pero el path SIEMPRE se prefija con {consultora_id} para que la
 * RLS de lectura (migración 20260704000001) aísle por tenant. El signed URL se
 * firma con el mismo cliente y expira por TTL corto.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** TTL por defecto del signed URL de un export: 1 hora. */
export const EXPORT_SIGNED_TTL_SECONDS = 60 * 60

export interface StoredExport {
  /** Path dentro del bucket `exports`. */
  path: string
  /** Signed URL temporal de descarga. */
  signedUrl: string
  /** TTL aplicado (segundos). */
  ttlSeconds: number
  /** Tamaño del paquete (bytes). */
  bytes: number
}

/**
 * Sube el ZIP al bucket `exports` bajo {consultora_id}/{empresa_id}/<filename>
 * y devuelve un signed URL temporal.
 *
 * @param admin  cliente Supabase con service role (escribe el objeto)
 * @param consultoraId  tenant dueño (primer segmento del path → RLS)
 * @param empresaId  empresa exportada
 * @param filename  nombre del archivo (ej. sigmetria_export_*.zip)
 * @param zip  bytes del ZIP
 * @param ttlSeconds  TTL del signed URL
 */
export async function storeExportAndSign(
  admin: SupabaseClient,
  consultoraId: string,
  empresaId: string,
  filename: string,
  zip: Uint8Array,
  ttlSeconds: number = EXPORT_SIGNED_TTL_SECONDS,
): Promise<StoredExport> {
  const stamp = Date.now()
  const path = `${consultoraId}/${empresaId}/${stamp}_${filename}`

  // Copia a ArrayBuffer puro (evita SharedArrayBuffer en el tipo del SDK).
  const buf = new ArrayBuffer(zip.byteLength)
  new Uint8Array(buf).set(zip)

  const { error: upErr } = await admin.storage.from('exports').upload(path, buf, {
    contentType: 'application/zip',
    upsert: true,
  })
  if (upErr) {
    throw new Error(`No se pudo guardar el export en Storage: ${upErr.message}`)
  }

  const { data, error: signErr } = await admin.storage
    .from('exports')
    .createSignedUrl(path, ttlSeconds)
  if (signErr || !data?.signedUrl) {
    throw new Error(`No se pudo firmar el export: ${signErr?.message ?? 'sin URL'}`)
  }

  return { path, signedUrl: data.signedUrl, ttlSeconds, bytes: zip.byteLength }
}
