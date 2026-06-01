/**
 * Geocoding de direcciones vía Nominatim (OpenStreetMap).
 *
 * Server-side only. Nominatim exige un User-Agent identificable.
 * Política de uso: máx 1 request/segundo (rate limit). Como esto corre
 * de forma puntual al guardar una empresa, no necesitamos throttling propio.
 *
 * NUNCA tira: un fallo de geocoding no debe romper el guardado.
 */

interface NominatimResult {
  lat: string
  lon: string
}

export async function geocodeAddress(
  query: string,
): Promise<{ lat: number; lon: number } | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Sigmetria-HyS/1.0',
      },
    })

    if (!res.ok) return null

    const data = (await res.json()) as NominatimResult[]
    if (!Array.isArray(data) || data.length === 0) return null

    const lat = parseFloat(data[0].lat)
    const lon = parseFloat(data[0].lon)
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null

    return { lat, lon }
  } catch {
    return null
  }
}
