/**
 * Tipos y mapeo de clima (Open-Meteo). Módulo PLANO (sin 'use server'):
 * la server action vive en lib/actions/fetch-clima.ts y un archivo 'use server'
 * solo puede exportar funciones async, así que los tipos y el helper sincrónico
 * viven acá y se importan desde ahí.
 */

export type CieloEstado =
  | 'despejado'
  | 'parcialmente_nublado'
  | 'nublado'
  | 'lluvioso'

export interface ClimaActual {
  tempActual: number | null
  tempMax: number | null
  tempMin: number | null
  humedad: number | null
  presion: number | null
  viento: number | null
  wmoCode: number | null
  cielo: CieloEstado
}

/**
 * Mapea un código WMO de Open-Meteo a un estado de cielo simplificado.
 * Mantiene la misma lógica que components/weather-panel.tsx:
 *   0           => despejado
 *   1, 2        => parcialmente_nublado
 *   3           => nublado
 *   >= 45       => lluvioso
 */
export function mapWmoACielo(code: number | null | undefined): CieloEstado {
  if (code === 0) return 'despejado'
  if (code === 1 || code === 2) return 'parcialmente_nublado'
  if (code === 3) return 'nublado'
  if (typeof code === 'number' && code >= 45) return 'lluvioso'
  return 'despejado'
}
