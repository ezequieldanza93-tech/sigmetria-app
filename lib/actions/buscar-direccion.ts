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
}

export async function buscarDirecciones(query: string): Promise<SugerenciaDireccion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 4) return []

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=0` +
      `&countrycodes=ar&q=${encodeURIComponent(trimmed)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Sigmetria-HyS/1.0' },
      // Cache corta: misma query repetida no re-pega a Nominatim.
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []

    const data = (await res.json()) as { display_name?: string; lat?: string; lon?: string }[]
    if (!Array.isArray(data)) return []

    return data
      .map((d) => ({
        label: (d.display_name ?? '').trim(),
        lat: parseFloat(d.lat ?? ''),
        lon: parseFloat(d.lon ?? ''),
      }))
      .filter((d) => d.label && !Number.isNaN(d.lat) && !Number.isNaN(d.lon))
  } catch {
    return []
  }
}
