'use client'

export type GeoEstado =
  | 'capturada'
  | 'sin_permiso'
  | 'no_soportado'
  | 'error'
  | 'timeout'

export interface GeoCaptura {
  lat: number | null
  lng: number | null
  accuracy: number | null
  estado: GeoEstado
}

/**
 * Captura la ubicación del dispositivo vía navigator.geolocation.
 *
 * Contrato: NUNCA lanza. Ante cualquier fallo resuelve con lat/lng/accuracy
 * null y el estado correspondiente, de modo que la completación de la gestión
 * nunca se rompe por un problema de geolocalización.
 */
export function useGeoCaptura() {
  function capturarUbicacion(): Promise<GeoCaptura> {
    return new Promise<GeoCaptura>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve({ lat: null, lng: null, accuracy: null, estado: 'no_soportado' })
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            estado: 'capturada',
          })
        },
        (error) => {
          let estado: GeoEstado = 'error'
          if (error.code === error.PERMISSION_DENIED) {
            estado = 'sin_permiso'
          } else if (error.code === error.TIMEOUT) {
            estado = 'timeout'
          }
          resolve({ lat: null, lng: null, accuracy: null, estado })
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      )
    })
  }

  return { capturarUbicacion }
}
