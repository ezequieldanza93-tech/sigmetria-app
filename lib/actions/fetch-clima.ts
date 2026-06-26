'use server'

import { mapWmoACielo, type ClimaActual } from '@/lib/clima'

function redondear1(valor: unknown): number | null {
  if (typeof valor !== 'number' || Number.isNaN(valor)) return null
  return Math.round(valor * 10) / 10
}

/**
 * Obtiene el clima actual desde Open-Meteo (sin API key).
 * Degradado: ante cualquier fallo o timeout retorna { error }.
 */
export async function fetchClima(
  lat: number,
  lng: number
): Promise<{ success: true; data: ClimaActual } | { error: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&wind_speed_unit=kmh&timezone=auto`

    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      return { error: 'No se pudo obtener el clima actual.' }
    }

    const json = await res.json()
    const current = json?.current
    const daily = json?.daily

    if (!current) {
      return { error: 'Respuesta de clima sin datos actuales.' }
    }

    const wmoCode =
      typeof current.weather_code === 'number' ? current.weather_code : null

    const data: ClimaActual = {
      tempActual: redondear1(current.temperature_2m),
      tempMax: redondear1(daily?.temperature_2m_max?.[0]),
      tempMin: redondear1(daily?.temperature_2m_min?.[0]),
      humedad: redondear1(current.relative_humidity_2m),
      presion: redondear1(current.surface_pressure),
      viento: redondear1(current.wind_speed_10m),
      wmoCode,
      cielo: mapWmoACielo(wmoCode),
    }

    return { success: true, data }
  } catch {
    return { error: 'No se pudo obtener el clima actual.' }
  } finally {
    clearTimeout(timeout)
  }
}
