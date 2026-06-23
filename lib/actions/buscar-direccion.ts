'use server'

/**
 * Autocompletado de direcciones vía Nominatim (OpenStreetMap). Server-side para
 * cumplir la política de Nominatim (User-Agent identificable) y no exponer al cliente.
 * Sin API key ni billing — mismo proveedor que lib/geocoding.ts.
 *
 * Sesga a Argentina (countrycodes=ar). NUNCA tira: ante cualquier error devuelve [].
 */

export interface SugerenciaDireccion {
  label: string // texto legible para mostrar / guardar como domicilio
  lat: number
  lon: number
  /** Código postal si Nominatim lo devuelve (no siempre disponible). */
  postcode?: string
  /** Provincia (address.state). */
  provincia?: string
  /** Localidad: city > town > village > municipality. */
  localidad?: string
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function buscarDirecciones(
  query: string,
  nearLat?: number | null,
  nearLon?: number | null,
): Promise<SugerenciaDireccion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 4) return []

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1` +
      `&countrycodes=ar&q=${encodeURIComponent(trimmed)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Sigmetria-HyS/1.0' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []

    const data = (await res.json()) as {
      display_name?: string
      lat?: string
      lon?: string
      address?: {
        postcode?: string
        state?: string
        city?: string
        town?: string
        village?: string
        municipality?: string
        county?: string
      }
    }[]
    if (!Array.isArray(data)) return []

    const results = data
      .map((d) => ({
        label: (d.display_name ?? '').trim(),
        lat: parseFloat(d.lat ?? ''),
        lon: parseFloat(d.lon ?? ''),
        postcode: d.address?.postcode?.trim() || undefined,
        provincia: d.address?.state?.trim() || undefined,
        localidad: (
          d.address?.city ??
          d.address?.town ??
          d.address?.village ??
          d.address?.municipality ??
          d.address?.county
        )?.trim() || undefined,
      }))
      .filter((d) => d.label && !Number.isNaN(d.lat) && !Number.isNaN(d.lon))

    if (nearLat != null && nearLon != null) {
      results.sort((a, b) =>
        haversineKm(nearLat, nearLon, a.lat, a.lon) - haversineKm(nearLat, nearLon, b.lat, b.lon)
      )
    }

    return results
  } catch {
    return []
  }
}
