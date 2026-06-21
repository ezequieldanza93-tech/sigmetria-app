/**
 * establecimiento-media.ts — Resuelve la FOTO + el MAPA estático del establecimiento
 * para la carátula de los protocolos (helper compartido por los protocolos del motor
 * genérico: ruido, PAT, carga térmica, ergonomía, carga de fuego).
 *
 * - Foto: `establecimientos.photo_site` resuelto con resolveAssetUrl (soporta paths
 *   relativos y URLs legacy absolutas) → fetch → data URL base64.
 * - Mapa: tiles oficiales de OSM via generarMapaEstaticoDataUrl (lat/long del establecimiento).
 *
 * Best-effort: cualquier falla devuelve el campo en undefined (la carátula lo oculta).
 */

import { createClient } from '@/lib/supabase/server'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import { generarMapaEstaticoDataUrl } from '@/lib/pdf/mapa-estatico'

export interface FotoMapaEstablecimiento {
  fotoEstablecimiento?: string
  mapaEstablecimiento?: string
}

/** Baja una URL y la convierte en data URL base64 (con timeout para no colgar la emisión). */
async function urlADataUrl(url: string | null | undefined, timeoutMs = 8000): Promise<string | undefined> {
  if (!url) return undefined
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return undefined
    const contentType = res.headers.get('content-type') ?? 'image/png'
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:${contentType};base64,${buf.toString('base64')}`
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Resuelve foto + mapa del establecimiento para la carátula. Devuelve ambos campos
 * (o undefined cada uno) listos para setear en los datos del protocolo.
 */
export async function getFotoYMapaEstablecimiento(
  establecimientoId: string | null | undefined,
): Promise<FotoMapaEstablecimiento> {
  const out: FotoMapaEstablecimiento = {}
  if (!establecimientoId) return out
  try {
    const supabase = await createClient()
    const { data: est } = await supabase
      .from('establecimientos')
      .select('photo_site, latitud, longitud')
      .eq('id', establecimientoId)
      .maybeSingle()
    if (!est) return out

    const photoPath = (est.photo_site as string | null) ?? null
    if (photoPath) {
      const fotoUrl = await resolveAssetUrl('establecimientos', photoPath)
      out.fotoEstablecimiento = await urlADataUrl(fotoUrl)
    }

    const lat = est.latitud as number | null
    const lon = est.longitud as number | null
    if (lat != null && lon != null) {
      out.mapaEstablecimiento = await generarMapaEstaticoDataUrl(lat, lon)
    }

    console.warn('[EST-MEDIA]', { establecimientoId, foto: !!out.fotoEstablecimiento, mapa: !!out.mapaEstablecimiento })
  } catch (err) {
    console.error('[EST-MEDIA] fallo al resolver foto/mapa:', err instanceof Error ? err.message : String(err))
  }
  return out
}
