/**
 * Utilidades de geodistancia. Funciones puras, sin dependencias.
 */

const RADIO_TIERRA_M = 6_371_000 // radio medio de la Tierra en metros

function gradosARadianes(grados: number): number {
  return (grados * Math.PI) / 180
}

/**
 * Distancia entre dos puntos sobre la superficie terrestre, en metros,
 * usando la fórmula de Haversine (asume esfera, error < 0.5% — suficiente
 * para validar presencia en un establecimiento).
 */
export function distanciaMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = gradosARadianes(lat2 - lat1)
  const dLng = gradosARadianes(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(gradosARadianes(lat1)) *
      Math.cos(gradosARadianes(lat2)) *
      Math.sin(dLng / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return RADIO_TIERRA_M * c
}

/**
 * Formatea una distancia en metros a texto legible en español rioplatense.
 * < 1000 m → '120 m'. >= 1000 m → '1,4 km' (coma decimal).
 */
export function formatearDistancia(metros: number): string {
  if (metros < 1000) {
    return `${Math.round(metros)} m`
  }
  const km = metros / 1000
  return `${km.toFixed(1).replace('.', ',')} km`
}
